#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { deriveSequence } from "./lib/schema.mjs";
import { ALL_KEYS } from "./lib/keys.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "api", "SongBooks");

const BOOKS = [
  "new-song",
  "new-song-pl-gb",
  "pielgrzym",
  "roboczy",
  "children",
];

const SONG_KEYS = ["id", "number", "key", "title", "sequence", "text"];
const SECTION_KEYS = ["order", "type", "number", "lines", "slides", "slidesLocked"];
const TYPES = new Set(["verse", "chorus", "bridge", "ending"]);
const KEY_SET = new Set(ALL_KEYS);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TAG_RE = /<[^>]{0,60}>/;
const SEPARATOR_RE = /[-–—_=.·]{5,}/;
const TRANSLATION_RE = /translations?\s*:/i;
const SEQ_TOKEN_RE = /^(V\d+|C\d*|B\d*|E\d*)$/;

const errors = [];
const warnings = [];
const globalIds = new Map();
const keyHistogram = new Map();

function err(where, msg) {
  errors.push(`${where}: ${msg}`);
}

function checkLines(where, lines, { allowEmpty }) {
  if (!Array.isArray(lines)) {
    err(where, "není pole");
    return;
  }
  if (!allowEmpty && lines.length === 0) {
    err(where, "prázdné pole řádků");
    return;
  }
  lines.forEach((line, i) => {
    const lw = `${where}[${i}]`;
    if (typeof line !== "string") return err(lw, "není string");
    if (line.trim() === "") err(lw, "prázdný řádek");
    if (line !== line.trim()) err(lw, `okrajové mezery: ${JSON.stringify(line)}`);
    if (/[\n\r\t]/.test(line)) err(lw, "obsahuje \\n, \\r nebo \\t");
    if (TAG_RE.test(line)) err(lw, `zbytek markupu: ${JSON.stringify(line)}`);
    if (SEPARATOR_RE.test(line)) err(lw, `zbytek oddělovače: ${JSON.stringify(line)}`);
    if (TRANSLATION_RE.test(line)) err(lw, `zbytek "Translation:": ${JSON.stringify(line)}`);
  });
}

function validateSections(where, sections, { primary }) {
  if (!Array.isArray(sections) || sections.length === 0) {
    err(where, "sections musí být neprázdné pole");
    return;
  }

  const seenOrders = new Set();
  sections.forEach((sec, i) => {
    const w = `${where}.sections[${i}]`;
    for (const k of Object.keys(sec)) {
      if (!SECTION_KEYS.includes(k)) err(w, `neznámý klíč "${k}"`);
    }
    if (!Number.isInteger(sec.order) || sec.order < 1)
      err(w, `order musí být kladné celé číslo, je ${JSON.stringify(sec.order)}`);
    if (seenOrders.has(sec.order)) err(w, `duplicitní order ${sec.order}`);
    seenOrders.add(sec.order);

    if (!TYPES.has(sec.type)) err(w, `neznámý type "${sec.type}"`);
    if (!Number.isInteger(sec.number) || sec.number < 1)
      err(w, `number musí být kladné celé číslo, je ${JSON.stringify(sec.number)}`);

    if (!primary && sec.slidesLocked !== undefined)
      err(w, "slidesLocked patří jen na text[0]");
    if (sec.slidesLocked !== undefined && sec.slidesLocked !== true)
      err(w, "slidesLocked smí být jen true, nebo chybět");

    checkLines(`${w}.lines`, sec.lines, { allowEmpty: false });

    if (!Array.isArray(sec.slides) || sec.slides.length === 0) {
      err(w, "slides musí být neprázdné pole");
      return;
    }
    sec.slides.forEach((slide, si) => {
      checkLines(`${w}.slides[${si}]`, slide, { allowEmpty: !primary });
    });

    if (primary) {
      const flat = sec.slides.flat().join("\n");
      if (flat !== sec.lines.join("\n"))
        err(
          w,
          `slidy poskládané dohromady nedávají lines\n      lines:  ${JSON.stringify(sec.lines)}\n      slidy:  ${JSON.stringify(sec.slides.flat())}`,
        );
    }
  });

  if (primary) {
    const sorted = [...seenOrders].sort((a, b) => a - b);
    if (
      sorted.length !== sections.length ||
      sorted[0] !== 1 ||
      sorted[sections.length - 1] !== sections.length
    )
      err(where, `order musí být souvislé 1..${sections.length}, je [${sorted.join(",")}]`);
  }
}

function validateBook(stem) {
  const file = path.join(DIR, `${stem}.json`);
  if (!fs.existsSync(file)) {
    err(stem, `soubor neexistuje: ${file}`);
    return null;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    err(stem, `není validní JSON: ${e.message}`);
    return null;
  }

  const topKeys = Object.keys(data).sort();
  if (topKeys.join(",") !== "name,songs")
    err(stem, `kořen má mít přesně {name, songs}, má {${topKeys.join(", ")}}`);
  if (typeof data.name !== "string" || !data.name.trim())
    err(stem, "name musí být neprázdný string");
  if (!Array.isArray(data.songs)) {
    err(stem, "songs musí být pole");
    return null;
  }

  const numbers = new Map();

  data.songs.forEach((song, si) => {
    const where = `${stem}[${si}] ${JSON.stringify(song.title ?? "")}`;

    const keys = Object.keys(song).sort();
    if (keys.join(",") !== [...SONG_KEYS].sort().join(","))
      err(where, `klíče mají být {${SONG_KEYS.join(", ")}}, jsou {${keys.join(", ")}}`);

    if (typeof song.id !== "string" || !UUID_RE.test(song.id))
      err(where, `id není uuid v4: ${JSON.stringify(song.id)}`);
    else if (globalIds.has(song.id))
      err(where, `duplicitní id (už je v ${globalIds.get(song.id)})`);
    else globalIds.set(song.id, where);

    if (song.number !== null && (!Number.isInteger(song.number) || song.number < 1))
      err(where, `number musí být null nebo kladné číslo, je ${JSON.stringify(song.number)}`);
    if (song.number !== null) {
      if (!numbers.has(song.number)) numbers.set(song.number, []);
      numbers.get(song.number).push(song.title);
    }

    if (song.key !== null && !KEY_SET.has(song.key))
      err(where, `neplatná tónina ${JSON.stringify(song.key)}`);
    keyHistogram.set(song.key, (keyHistogram.get(song.key) || 0) + 1);

    if (typeof song.title !== "string" || !song.title.trim())
      err(where, "title musí být neprázdný string");
    else {
      if (song.title !== song.title.trim()) err(where, "title má okrajové mezery");
      if (/[\n\r\t]/.test(song.title)) err(where, "title obsahuje \\n");
      if (TAG_RE.test(song.title)) err(where, "title obsahuje markup");
      if (/\([A-Ha-h][#b]?(?:-?(?:moll|mol|m|dur))?\)\s*\d*\s*$/i.test(song.title))
        err(where, `title má zbytkovou koncovku s tóninou: ${JSON.stringify(song.title)}`);
    }

    if (!Array.isArray(song.text) || song.text.length < 1 || song.text.length > 2) {
      err(where, `text musí mít 1..2 jazyky, má ${song.text?.length}`);
      return;
    }

    song.text.forEach((block, bi) => {
      const bw = `${where}.text[${bi}]`;
      const bKeys = Object.keys(block).sort();
      if (bKeys.join(",") !== "isTranslation,sections")
        err(bw, `má mít {isTranslation, sections}, má {${bKeys.join(", ")}}`);
      if (typeof block.isTranslation !== "boolean")
        err(bw, "isTranslation musí být boolean");
      validateSections(bw, block.sections, { primary: bi === 0 });
    });

    if (song.text[0].isTranslation)
      err(where, "text[0] je označen jako překlad — musí to být zpívaný originál");

    if (song.text[1]) {
      const byOrder = new Map(song.text[0].sections.map((s) => [s.order, s]));
      song.text[1].sections.forEach((sec, i) => {
        const p = byOrder.get(sec.order);
        const w = `${where}.text[1].sections[${i}]`;
        if (!p) {
          err(w, `order ${sec.order} neexistuje v text[0]`);
          return;
        }
        if (p.type !== sec.type || p.number !== sec.number)
          err(w, `nesedí na text[0]: ${p.type}/${p.number} vs ${sec.type}/${sec.number}`);
        if (p.slides.length !== sec.slides.length)
          err(
            w,
            `jiný počet slidů než text[0]: ${sec.slides.length} vs ${p.slides.length}`,
          );
      });
    }

    const expected = deriveSequence(song.text[0].sections);
    if (song.sequence !== expected)
      err(where, `sequence je "${song.sequence}", odvozená je "${expected}"`);
    for (const tok of song.sequence.split(" ")) {
      if (!SEQ_TOKEN_RE.test(tok)) err(where, `neplatný token v sequence: "${tok}"`);
    }
  });

  const dupes = [...numbers.entries()].filter(([, t]) => t.length > 1);
  if (dupes.length) {
    warnings.push(
      `${stem}: ${dupes.length} duplicitních čísel — ${dupes
        .map(([n, t]) => `${n} (${t.length}×)`)
        .join(", ")}`,
    );
  }

  return {
    stem,
    name: data.name,
    songs: data.songs.length,
    sections: data.songs.reduce((n, s) => n + s.text[0].sections.length, 0),
    slides: data.songs.reduce(
      (n, s) => n + s.text[0].sections.reduce((m, x) => m + x.slides.length, 0),
      0,
    ),
    bilingual: data.songs.filter((s) => s.text.length > 1).length,
    translations: data.songs.filter((s) => s.text[1]?.isTranslation).length,
  };
}

const stats = BOOKS.map(validateBook).filter(Boolean);

console.log(
  "kniha            | název                       | písní | sekcí | slidů | 2 jaz. | překlad",
);
console.log(
  "-----------------|-----------------------------|-------|-------|-------|--------|--------",
);
for (const s of stats) {
  console.log(
    `${s.stem.padEnd(16)} | ${s.name.padEnd(27)} | ${String(s.songs).padStart(5)} | ${String(s.sections).padStart(5)} | ${String(s.slides).padStart(5)} | ${String(s.bilingual).padStart(6)} | ${String(s.translations).padStart(7)}`,
  );
}
console.log(
  `\ncelkem ${stats.reduce((n, s) => n + s.songs, 0)} písní, ${stats.reduce((n, s) => n + s.sections, 0)} sekcí (Output 1), ${stats.reduce((n, s) => n + s.slides, 0)} slidů (Output 2), ${globalIds.size} unikátních id`,
);

const keyCounts = [...keyHistogram.entries()].sort((a, b) => b[1] - a[1]);
console.log(
  `tóniny: ${keyCounts.map(([k, n]) => `${k === null ? "—" : k}:${n}`).join("  ")}`,
);

if (warnings.length) {
  console.log("\nUPOZORNĚNÍ:");
  warnings.forEach((w) => console.log(`  ${w}`));
}

if (errors.length) {
  console.error(`\nCHYBY (${errors.length}):`);
  errors.slice(0, 60).forEach((e) => console.error(`  ${e}`));
  if (errors.length > 60) console.error(`  … a dalších ${errors.length - 60}`);
  process.exit(1);
}

console.log("\nOK — všechny invarianty platí.");
