#!/usr/bin/env node
/**
 * Konvertuje VideoPsalm formát songbooks (SongBooks/*.json se string-y se
 * surovými newlines + nezacitovanými klíči) na standardní JSON, který app
 * konzumuje (jako SongBooks3/songs-*-final.json).
 *
 * Logika:
 *  - Strip BOM
 *  - Escape literal newlines uvnitř stringů (kvůli vm parsování)
 *  - vm.runInNewContext("(" + raw + ")") → JS object
 *  - Pro každý song / verse:
 *      - Pokud `Text` obsahuje "----" separator → split na TextPL + TextEN
 *      - Pokud EN začíná "Translation:" → strip prefix, set IsTranslation: true
 *      - Pokud text obsahuje <i>...</i> tagy → strip tagy, set IsTranslation: true
 *      - Speciální znaky (', ", em-dash) zůstávají
 *      - <s\d+> a </s> style tagy zůstávají (renderer je strippuje)
 *  - JSON.stringify s indent 2 → cílový formát
 *
 * Použití:
 *   node scripts/convert-songbooks.mjs
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

/** Escape literal newlines uvnitř " " stringů (kvůli vm parsing). */
function escapeNewlinesInStrings(src) {
  let out = "";
  let inStr = false;
  let escaped = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inStr = false;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      out += ch;
    } else {
      out += ch;
      if (ch === '"') inStr = true;
    }
  }
  return out;
}

function parseVideoPsalmJson(rawFile) {
  let raw = rawFile.replace(/^﻿/, ""); // BOM
  raw = escapeNewlinesInStrings(raw);
  return vm.runInNewContext("(" + raw + ")");
}

/**
 * Najde 3+ pomlček NEBO teček (separator PL/EN). Kontext před a za:
 * newline (\n), > (konec tagu) nebo začátek/konec stringu.
 * Tím povolíme tagové wrapery jako `<s923>-----</s>` nebo `<i>......</i>`,
 * a odlišíme od dashes uvnitř textu typu `slovo -- jiné` nebo elipsy `text...`.
 */
const SEPARATOR_RE = /(?:\n|>|^)[ \t]*[.\-]{3,}[ \t]*(?:\n|<|$)/;

/**
 * Zpracuje text jednoho verse a vrátí buď single { Text } nebo
 * { TextPL, TextEN, IsTranslation? } pokud obsahuje separator.
 */
function splitVerseText(rawText) {
  if (!rawText) return { Text: "" };

  // Najdi separator (3+ dashes v line/tag kontextu)
  const sepMatch = rawText.match(SEPARATOR_RE);
  if (!sepMatch) return { Text: rawText };

  // V rámci match najdi přesnou pozici separator chars (dashes nebo dots)
  const dashOffset = sepMatch[0].search(/[.\-]+/);
  const dashRun = sepMatch[0].match(/[.\-]+/);
  const dashStart = sepMatch.index + dashOffset;
  const dashEnd = dashStart + dashRun[0].length;

  // Split podle dashes — surrounding tagy zůstávají na "svém" jazyku
  // (runtime removeStyleTags je strippne při zobrazení)
  let pl = rawText.slice(0, dashStart).replace(/[ \t\n]+$/, "");
  let englishText = rawText.slice(dashEnd).replace(/^[ \t\n]+/, "");

  let isTranslation = false;

  // Strip <i> </i> tagy z EN (mohou být kdekoli) — italic řeší IsTranslation flag
  if (/<\/?i>/.test(englishText)) {
    englishText = englishText.replace(/<\/?i>/g, "");
    isTranslation = true;
  }

  // Detekce "TRANSLATION:" (case-insensitive). Před ní můžou být jakékoliv tagy.
  // Pouze nastavíme IsTranslation: true — prefix necháme v TextEN, aby šel
  // zobrazit na Output 1. Strip se děje runtime při buildování Output 2.
  if (/^(?:<[^>]+>)*\s*Translation:/i.test(englishText)) {
    isTranslation = true;
  }

  const out = {
    TextPL: pl,
    TextEN: englishText,
  };
  if (isTranslation) out.IsTranslation = true;
  return out;
}

/** Zpracuje jeden verse (zachová Style, Tag, ID atd. + převede Text). */
function convertVerse(verse) {
  if (!verse || typeof verse !== "object") return verse;
  const out = { ...verse };
  if ("Text" in out) {
    const split = splitVerseText(out.Text);
    delete out.Text;
    Object.assign(out, split);
  }
  return out;
}

function convertSong(song) {
  if (!song || typeof song !== "object") return song;
  const out = { ...song };
  if (Array.isArray(out.Verses)) {
    out.Verses = out.Verses.map(convertVerse);
  }
  // Top-level Text (název písně) — pokud obsahuje separator, taky split
  if (typeof out.Text === "string" && SEPARATOR_RE.test(out.Text)) {
    const split = splitVerseText(out.Text);
    delete out.Text;
    Object.assign(out, split);
  }
  return out;
}

function convertFile(inputPath, outputPath) {
  const raw = fs.readFileSync(inputPath, "utf8");
  const parsed = parseVideoPsalmJson(raw);

  if (Array.isArray(parsed.Songs)) {
    parsed.Songs = parsed.Songs.map(convertSong);
  }

  fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2), "utf8");

  // Stats
  const songCount = parsed.Songs?.length ?? 0;
  let bilingualCount = 0;
  let translationCount = 0;
  for (const s of parsed.Songs || []) {
    for (const v of s.Verses || []) {
      if (v.TextEN) bilingualCount++;
      if (v.IsTranslation) translationCount++;
    }
  }
  console.log(`  ${path.basename(inputPath)} → ${path.basename(outputPath)}`);
  console.log(
    `    ${songCount} songs, ${bilingualCount} bilingual verses, ${translationCount} translations`,
  );
}

// === MAIN ===
const FILES = [
  "new-song.json",
  "new-song-pl-gb.json",
  "pielgrzym.json",
  "roboczy.json",
  "children.json",
];

const SRC_DIR = path.join(ROOT, "api", "SongBooks");

console.log(`Converting from ${SRC_DIR}\n`);

for (const file of FILES) {
  const inputPath = path.join(SRC_DIR, file);
  if (!fs.existsSync(inputPath)) {
    console.warn(`  ${file}: NOT FOUND, skipping`);
    continue;
  }
  const outputPath = path.join(
    SRC_DIR,
    file.replace(/\.json$/, "-converted.json"),
  );
  try {
    convertFile(inputPath, outputPath);
  } catch (err) {
    console.error(`  ${file}: FAILED — ${err.message}`);
  }
}

console.log("\nDone.");
