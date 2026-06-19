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

function sha256File(file) {
  const h = createHash("sha256");
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
        hash: sha256File(srcPath),
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

// === MAIN ===
const version = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
console.log(`Uploading data to R2 bucket "${BUCKET}" — version ${version}`);

const files = collectFiles();
console.log(`Found ${files.length} files to upload.`);

let totalBytes = 0;
let i = 0;
for (const f of files) {
  i++;
  process.stdout.write(`[${i}/${files.length}] ${f.key} (${(f.size / 1024).toFixed(1)} KB) ... `);
  try {
    uploadOne(f);
    console.log("OK");
    totalBytes += f.size;
  } catch (err) {
    console.log("FAILED");
    console.error(err.message || err);
    process.exit(1);
  }
}

const manifest = {
  version,
  generatedAt: new Date().toISOString(),
  files: Object.fromEntries(
    files.map((f) => [f.key, { hash: f.hash, size: f.size }]),
  ),
};

console.log(`\nUploading manifest.json ...`);
uploadManifest(manifest);
console.log(`Done. ${files.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB total.`);
console.log(`Manifest version: ${version}`);
