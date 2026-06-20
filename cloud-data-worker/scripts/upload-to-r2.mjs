#!/usr/bin/env node
/**
 * Nahraje současné JSON data do R2 bucketu "choirpresenter-data".
 *
 * Použití (z cloud-data-worker/):
 *   node scripts/upload-to-r2.mjs
 *
 * Co dělá:
 * 1. Walking přes ../electron-next-app/api/{Bibles,Messages,SongBooks}/
 * 2. Pro každý JSON: spočítá sha256 hash + size
 * 3. Postaví manifest.json se seznamem všech souborů + verzí (= today ISO)
 * 4. Nahraje VŠE do R2 přes `wrangler r2 object put`
 *
 * Vyžaduje: wrangler CLI authenticated (`wrangler login`)
 *           a R2 bucket "choirpresenter-data" už vytvořený.
 */

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const APP_ROOT = path.join(ROOT, "..", "electron-next-app");
const BUCKET = "choirpresenter-data";

// Mapování: lokální src dir → R2 key prefix.
// Jen JSON soubory. Per-soubor JSONy (pl-texts/) jdou jako data/messages/texts/{name}.json.
const MAPPINGS = [
  {
    srcDir: path.join(APP_ROOT, "api/Bibles"),
    keyPrefix: "data/bibles/",
    filter: (n) => n.endsWith(".json"),
  },
  {
    srcDir: path.join(APP_ROOT, "api/Messages"),
    keyPrefix: "data/messages/",
    filter: (n) => n === "pl-titles.json",
    rename: () => "titles.json",
  },
  {
    srcDir: path.join(APP_ROOT, "api/Messages/pl-texts"),
    keyPrefix: "data/messages/texts/",
    filter: (n) => n.endsWith(".json") && n !== "index.json",
  },
  {
    srcDir: path.join(APP_ROOT, "api/SongBooks"),
    keyPrefix: "data/songs/",
    filter: (n) => n.endsWith("-converted.json"),
  },
];

// Používáme MD5 (= R2 ETag), aby manifesty z upload-script a Worker auto-refresh
// měly konzistentní formát hash. MD5 zde je jen pro diff detekci, ne crypto.
function md5File(file) {
  const h = createHash("md5");
  h.update(fs.readFileSync(file));
  return h.digest("hex");
}

function collectFiles() {
  const files = [];
  for (const m of MAPPINGS) {
    if (!fs.existsSync(m.srcDir)) {
      console.warn(`Skipping missing dir: ${m.srcDir}`);
      continue;
    }
    for (const name of fs.readdirSync(m.srcDir)) {
      if (!m.filter(name)) continue;
      const srcPath = path.join(m.srcDir, name);
      const stat = fs.statSync(srcPath);
      if (!stat.isFile()) continue;
      const outName = m.rename ? m.rename(name) : name;
      const key = m.keyPrefix + outName;
      files.push({
        localPath: srcPath,
        key,
        size: stat.size,
        hash: md5File(srcPath),
      });
    }
  }
  return files;
}

function uploadOne(file) {
  // wrangler r2 object put <bucket>/<key> --file=<path> --content-type=application/json
  const cmd = `npx wrangler r2 object put "${BUCKET}/${file.key}" --file="${file.localPath}" --content-type="application/json" --remote`;
  execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] });
}

function uploadManifest(manifest) {
  const tmp = path.join(ROOT, ".manifest.tmp.json");
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2));
  try {
    const cmd = `npx wrangler r2 object put "${BUCKET}/manifest.json" --file="${tmp}" --content-type="application/json" --remote`;
    execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] });
  } finally {
    fs.unlinkSync(tmp);
  }
}

// Worker URL pro fetch remote manifestu (pro differential upload).
// Override přes env: WORKER_URL=https://your-worker.workers.dev
const WORKER_URL =
  process.env.WORKER_URL ||
  "https://choirpresenter-data.joz-maz-work.workers.dev";

async function fetchRemoteManifest() {
  try {
    const res = await fetch(`${WORKER_URL}/manifest.json?_t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`Could not fetch remote manifest (${err.message}); will upload everything.`);
    return null;
  }
}

// === MAIN ===
const version = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
const forceAll = process.argv.includes("--all");

console.log(`Differential upload to R2 bucket "${BUCKET}" — version ${version}`);
console.log(forceAll ? "Mode: FULL (--all)" : "Mode: differential (skip unchanged)");

const remoteManifest = forceAll ? null : await fetchRemoteManifest();
const remoteFiles = remoteManifest?.files || {};
console.log(
  remoteManifest
    ? `Remote manifest version: ${remoteManifest.version} (${Object.keys(remoteFiles).length} files)`
    : "No remote manifest — uploading everything as new.",
);

const files = collectFiles();
console.log(`Found ${files.length} local files. Comparing…`);

let totalBytes = 0;
let uploaded = 0;
let skipped = 0;
let i = 0;
for (const f of files) {
  i++;
  const remote = remoteFiles[f.key];
  const unchanged =
    remote && remote.hash === f.hash && remote.size === f.size;
  if (unchanged && !forceAll) {
    skipped++;
    if (i % 50 === 0 || i === files.length)
      process.stdout.write(`  skipped ${skipped} unchanged so far…\r`);
    continue;
  }
  process.stdout.write(
    `[${i}/${files.length}] ${f.key} (${(f.size / 1024).toFixed(1)} KB) ... `,
  );
  try {
    uploadOne(f);
    console.log("OK");
    uploaded++;
    totalBytes += f.size;
  } catch (err) {
    console.log("FAILED");
    console.error(err.message || err);
    process.exit(1);
  }
}
console.log(""); // newline after skip counter
console.log(`Uploaded ${uploaded}, skipped ${skipped} unchanged.`);

// Když nic nenahráno (vše unchanged), Worker nemá důvod přebuilďovat manifest.
// Nicméně uploadneme i tak — drobné ujistění že verze je aktualizovaná.
if (uploaded === 0) {
  console.log("Nothing changed. Manifest stays as-is on cloud.");
} else {
  // Manifest mergujeme: lokální files se updatují, cloud-only entries
  // (= soubory které jsou jen v cloudu, např. nahrané přes app PUT)
  // ZACHOVÁME, aby se nesmazaly.
  const mergedFiles = { ...remoteFiles };
  for (const f of files) {
    mergedFiles[f.key] = { hash: f.hash, size: f.size };
  }
  const manifest = {
    version,
    generatedAt: new Date().toISOString(),
    files: mergedFiles,
  };
  console.log(`\nUploading manifest.json (${Object.keys(mergedFiles).length} entries) ...`);
  uploadManifest(manifest);
  console.log(
    `Done. Uploaded ${uploaded} files (${(totalBytes / 1024 / 1024).toFixed(1)} MB), skipped ${skipped}.`,
  );
  console.log(`Manifest version: ${version}`);
}
