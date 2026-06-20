#!/usr/bin/env node
/**
 * Stáhne aktuální cloudu data → ../electron-next-app/api/...
 *
 * Použití (z cloud-data-worker/):
 *   node scripts/sync-down.mjs       (differential — jen co se liší od lokálu)
 *   node scripts/sync-down.mjs --all (force, přestáhne všechno)
 *
 * Reverz upload-to-r2.mjs:
 *   data/bibles/{name}.json            → ../electron-next-app/api/Bibles/{name}.json
 *   data/messages/titles.json          → ../electron-next-app/api/Messages/pl-titles.json
 *   data/messages/texts/{date}.json    → ../electron-next-app/api/Messages/pl-texts/{date}.json
 *   data/songs/{book}-converted.json   → ../electron-next-app/api/SongBooks/{book}-converted.json
 *
 * Workflow pro admina (typicky):
 *   1. node scripts/sync-down.mjs            ← pulluj aktuální cloud (než budeš editovat)
 *   2. (lokální edity, nová kázání, atd.)
 *   3. node scripts/upload-to-r2.mjs         ← pushni jen změněné soubory
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const APP_ROOT = path.join(ROOT, "..", "electron-next-app");

const WORKER_URL =
  process.env.WORKER_URL ||
  "https://choirpresenter-data.joz-maz-work.workers.dev";

const forceAll = process.argv.includes("--all");

/**
 * Mapuje R2 klíč → lokální cesta.
 * Pro klíče které neumíme přiřadit (nečekané) vrátíme null a soubor přeskočíme.
 */
function keyToLocalPath(key) {
  if (key.startsWith("data/bibles/")) {
    return path.join(APP_ROOT, "api/Bibles", key.slice("data/bibles/".length));
  }
  if (key === "data/messages/titles.json") {
    return path.join(APP_ROOT, "api/Messages/pl-titles.json");
  }
  if (key.startsWith("data/messages/texts/")) {
    return path.join(
      APP_ROOT,
      "api/Messages/pl-texts",
      key.slice("data/messages/texts/".length),
    );
  }
  if (key.startsWith("data/songs/")) {
    return path.join(APP_ROOT, "api/SongBooks", key.slice("data/songs/".length));
  }
  return null;
}

function md5File(file) {
  try {
    const h = createHash("md5");
    h.update(fs.readFileSync(file));
    return h.digest("hex");
  } catch {
    return null;
  }
}

async function fetchUrl(url) {
  const res = await fetch(`${url}?_t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

// === MAIN ===
console.log(`Sync-down from ${WORKER_URL}`);
console.log(forceAll ? "Mode: FULL (--all)" : "Mode: differential (skip files matching local)");

const manifestText = await fetchUrl(`${WORKER_URL}/manifest.json`);
const manifest = JSON.parse(manifestText);
const entries = Object.entries(manifest.files);
console.log(`Cloud manifest version: ${manifest.version} (${entries.length} files)`);

let downloaded = 0;
let skipped = 0;
let unmapped = 0;
let i = 0;
for (const [key, entry] of entries) {
  i++;
  const local = keyToLocalPath(key);
  if (!local) {
    unmapped++;
    continue;
  }
  if (!forceAll) {
    const localHash = md5File(local);
    if (localHash === entry.hash) {
      skipped++;
      if (i % 50 === 0)
        process.stdout.write(`  skipped ${skipped} matching local so far…\r`);
      continue;
    }
  }
  process.stdout.write(`[${i}/${entries.length}] ${key} (${(entry.size / 1024).toFixed(1)} KB) ... `);
  try {
    const safeKey = key.split("/").map(encodeURIComponent).join("/");
    const content = await fetchUrl(`${WORKER_URL}/${safeKey}`);
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.writeFileSync(local, content, "utf8");
    console.log("OK");
    downloaded++;
  } catch (err) {
    console.log("FAILED");
    console.error(`  ${err.message}`);
  }
}
console.log("");
console.log(`Done. Downloaded ${downloaded}, skipped ${skipped} (already match), unmapped ${unmapped}.`);
