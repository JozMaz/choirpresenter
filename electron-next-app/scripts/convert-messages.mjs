#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const parserRepo = process.argv[2];
if (!parserRepo) {
  console.error(
    "Usage: node scripts/convert-messages.mjs <path-to-the-message-index-parser> [lang]",
  );
  process.exit(1);
}
const lang = process.argv[3] || "pl";

const MH_DIR = path.join(parserRepo, "languages", lang, "messagehub", "files");
const VGR_DIR = path.join(parserRepo, "languages", lang, "vgr_native", "parsed");
const VGR_META = path.join(
  parserRepo,
  "languages",
  lang,
  "vgr_native",
  "metadata",
  "sermons.json",
);

const OUT_DIR = path.join(ROOT, "api", "Messages", `${lang}-texts`);
const TITLES_FILE = path.join(ROOT, "api", "Messages", `${lang}-titles.json`);

for (const dir of [MH_DIR, VGR_DIR]) {
  if (!fs.existsSync(dir)) {
    console.error(`Missing source dir: ${dir}`);
    process.exit(1);
  }
}

function collapse(s) {
  return s.replace(/\s+/g, " ").trim();
}

function parseMh(html) {
  const $ = cheerio.load(html);
  const title = collapse($(".message-header h1").text());
  const location = collapse($(".message-header h2").text());

  const chunks = [];
  let currentPnum = 0;
  $("div.wmb, div.singing, div.scripture, div.stanza").each((_, el) => {
    const $el = $(el);
    const pnumText = $el.children("div.pnum").first().text();
    if (/^\d+$/.test(pnumText)) currentPnum = Number(pnumText);
    $el.find("div.pnum").remove();
    const text = collapse($el.text());
    if (text) chunks.push({ pnum: currentPnum, text });
  });

  return { title, location, chunks };
}

function parseVgr(items) {
  const chunks = [];
  let currentPnum = 0;
  for (let raw of items) {
    if (raw.startsWith('<span class="st')) {
      raw = '<p class="normal_pn">' + raw;
    }
    const $ = cheerio.load(raw);
    $("p").each((_, el) => {
      const $p = $(el);
      const pn = $p.find("span.pn").first().text();
      if (/^\d+$/.test(pn)) currentPnum = Number(pn);
      $p.find("span.pn").remove();
      $p.find("span.eagle").remove();
      const text = collapse($p.text());
      if (text) chunks.push({ pnum: currentPnum, text });
    });
  }
  return chunks;
}

const mhDates = fs
  .readdirSync(MH_DIR)
  .filter((f) => f.endsWith(".html"))
  .map((f) => path.basename(f, ".html"));

const vgrDates = fs
  .readdirSync(VGR_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => path.basename(f, ".json"));

const sermonsMeta = JSON.parse(fs.readFileSync(VGR_META, "utf8"));
const vgrTitleByDate = {};
const vgrLocationByDate = {};
for (const s of sermonsMeta) {
  if (!s.productId || vgrTitleByDate[s.productId]) continue;
  vgrTitleByDate[s.productId] = s.productTitle || "";
  vgrLocationByDate[s.productId] = [s.location, s.cityState]
    .filter(Boolean)
    .join(", ");
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const written = {};
const problems = [];

for (const date of mhDates) {
  const html = fs.readFileSync(path.join(MH_DIR, `${date}.html`), "utf8");
  const parsed = parseMh(html);
  if (parsed.chunks.length === 0) problems.push(`MH ${date}: 0 chunks`);
  if (!parsed.title) problems.push(`MH ${date}: empty title`);
  written[date] = parsed;
}

const vgrOnly = vgrDates.filter((d) => !written[d]);
for (const date of vgrOnly) {
  const items = JSON.parse(
    fs.readFileSync(path.join(VGR_DIR, `${date}.json`), "utf8"),
  );
  const chunks = parseVgr(items);
  const title = vgrTitleByDate[date] || "";
  if (chunks.length === 0) problems.push(`VGR ${date}: 0 chunks`);
  if (!title) problems.push(`VGR ${date}: no title in metadata`);
  written[date] = { title, location: vgrLocationByDate[date] || "", chunks };
}

for (const [date, data] of Object.entries(written)) {
  fs.writeFileSync(
    path.join(OUT_DIR, `${date}.json`),
    JSON.stringify(data, null, 2),
    "utf8",
  );
}

let titles = [];
if (fs.existsSync(TITLES_FILE)) {
  titles = JSON.parse(fs.readFileSync(TITLES_FILE, "utf8"));
}
const titleDates = new Set(titles.map((e) => e.date));
const addedTitles = [];
for (const date of Object.keys(written)) {
  if (titleDates.has(date)) continue;
  const title = vgrTitleByDate[date] || written[date].title;
  if (!title) {
    problems.push(`titles ${date}: no title available`);
    continue;
  }
  titles.push({ date, titles: [{ translator: 25, title }] });
  addedTitles.push(date);
}
titles.sort((a, b) => a.date.localeCompare(b.date));
fs.writeFileSync(TITLES_FILE, JSON.stringify(titles, null, 2), "utf8");

const totalChunks = Object.values(written).reduce(
  (n, d) => n + d.chunks.length,
  0,
);
console.log(`MH texts: ${mhDates.length}`);
console.log(`VGR-only texts: ${vgrOnly.length}`);
console.log(
  `Total texts written: ${Object.keys(written).length}, chunks: ${totalChunks}`,
);
console.log(
  `Titles entries: ${titles.length} (added: ${addedTitles.join(", ") || "none"})`,
);
if (problems.length) {
  console.log(`\nPROBLEMS (${problems.length}):`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log("\nNo problems.");
