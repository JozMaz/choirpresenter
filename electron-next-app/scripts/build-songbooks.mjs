#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { parseVideoPsalmJson } from "./lib/vpsalm.mjs";
import { deriveSequence } from "./lib/schema.mjs";
import {
  splitLinesMono,
  splitLinesBilingual,
  alignSecondary,
} from "./lib/split.mjs";
import { normalizeKey, isValidKey, KEY_IN_PARENS_RE } from "./lib/keys.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT, "api", "SongBooks", "_source");
const OUT_DIR = path.join(ROOT, "api", "SongBooks");
const REPORT_PATH = path.join(OUT_DIR, "_report.md");
const IDMAP_PATH = path.join(__dirname, "songbook-idmap.json");

const BOOKS = [
  { stem: "new-song", name: "Nowa pieśń", hasNumbers: true },
  { stem: "new-song-pl-gb", name: "Śpiewnik polsko-angielski", hasNumbers: true },
  { stem: "pielgrzym", name: "Śpiewnik pielgrzyma", hasNumbers: true },
  { stem: "roboczy", name: "Śpiewnik roboczy", hasNumbers: false },
  { stem: "children", name: "Śpiewnik dziecięcy", hasNumbers: false },
];

const FORCE_FLIP = new Map([
  ["KRJC2BQxqkWFjpA26dD2IA", true],
  ["oh2SZUp/CEqAauBxsG1XEA", true],
]);

const TITLE_OVERRIDES = new Map([
  ["zNt+0kIwtEy+ATHjZJv0jw", "Mogę dziś tak jak Enoch być"],
]);

const KEY_OVERRIDES = new Map([
]);

const TAG_RE = /<[^>]{0,60}>/g;

const SEPARATOR_RE = /^[-–—_=.·]{5,}$/;

const PLACEHOLDER_RE = /^[.\s\-–—…·]*$/;

const TRANSLATION_MARKER_RE = /translations?\s*:/i;

const cleanLine = (line) => line.replace(TAG_RE, "").trim();

function splitLanguageBlocks(rawText) {
  const rawLines = String(rawText || "").split("\n");
  const blocks = [[]];
  let separators = 0;
  for (const raw of rawLines) {
    if (SEPARATOR_RE.test(cleanLine(raw).trim())) {
      separators++;
      blocks.push([]);
      continue;
    }
    blocks[blocks.length - 1].push(raw);
  }
  return { blocks, separators };
}

function toLines(rawLines) {
  const lines = rawLines.map(cleanLine).filter((l) => l.trim() !== "");
  if (lines.length === 0) return null;
  if (lines.every((l) => PLACEHOLDER_RE.test(l))) return null;
  return lines;
}

function stripTranslationMarker(lines) {
  const out = [];
  for (const line of lines) {
    if (!TRANSLATION_MARKER_RE.test(line)) {
      out.push(line);
      continue;
    }
    const rest = line.replace(/^\s*translations?\s*:\s*/i, "").trimEnd();
    if (rest !== "") out.push(rest);
  }
  return out;
}

function parseTitleSuffix(rawTitle) {
  let title = rawTitle.replace(TAG_RE, "").replace(/\s+/g, " ").trim();
  let keyFromTitle = null;
  let numberFromTitle = null;

  const re = new RegExp(
    `\\s*(${KEY_IN_PARENS_RE.source})\\s*(\\d+)?\\s*$`,
    "i",
  );
  const m = title.match(re);
  if (m) {
    keyFromTitle = normalizeKey(m[1].replace(/[()]/g, "").trim());
    if (keyFromTitle) {
      if (m[2]) numberFromTitle = parseInt(m[2], 10);
      title = title.slice(0, m.index).trim();
    } else {
      keyFromTitle = null;
    }
  } else {
    const mNum = title.match(/\s{2,}(\d+)\s*$/);
    if (mNum) {
      numberFromTitle = parseInt(mNum[1], 10);
      title = title.slice(0, mNum.index).trim();
    }
  }

  return { title, keyFromTitle, numberFromTitle };
}

const ALWAYS_CAPITALIZED = new Set([
  "bóg", "boga", "bogu", "bogiem", "boże", "bogowie",
  "boży", "boża", "boże", "bożym", "bożego", "bożej", "bożą", "bożych", "bożymi",
  "jezus", "jezusa", "jezusowi", "jezusem", "jezusie",
  "chrystus", "chrystusa", "chrystusowi", "chrystusem", "chrystusie",
  "pan", "pana", "panu", "panem", "panie",
  "duch", "ducha", "duchowi", "duchem", "duchu",
  "święty", "świętego", "świętym", "świętemu",
  "biblia", "biblii", "biblię", "biblią",
  "słowo", "słowa", "słowu", "słowem", "słowie",
  "zbawiciel", "zbawiciela", "zbawicielu",
  "baranek", "baranka", "barankowi",
  "golgota", "golgoty", "golgocie", "голгофе", "голгофа", "христос", "иисус", "бог",
]);

function fromAllCaps(s) {
  const lower = s.toLocaleLowerCase("pl");
  let out = "";
  let capitalizeNext = true;
  for (const ch of lower) {
    if (capitalizeNext && /\p{L}/u.test(ch)) {
      out += ch.toLocaleUpperCase("pl");
      capitalizeNext = false;
    } else {
      out += ch;
      if (/[.!?]/.test(ch)) capitalizeNext = true;
    }
  }
  return out.replace(/\p{L}+/gu, (word) =>
    ALWAYS_CAPITALIZED.has(word.toLocaleLowerCase("pl"))
      ? word.charAt(0).toLocaleUpperCase("pl") + word.slice(1)
      : word,
  );
}

function isAllCaps(s) {
  const letters = s.match(/\p{L}/gu) || [];
  if (letters.length < 4) return false;
  const upper = letters.filter(
    (c) => c === c.toLocaleUpperCase("pl") && c !== c.toLocaleLowerCase("pl"),
  ).length;
  return upper / letters.length >= 0.9;
}

function sectionTypeFromTag(tag) {
  if (tag === 1) return "chorus";
  if (tag === 2) return "bridge";
  if (tag === 3) return "ending";
  return "verse";
}

function convertSong(song, book, report, idmap) {
  const guid = song.Guid;

  const rows = [];
  let anyMultiSeparator = false;

  for (const verse of song.Verses || []) {
    const { blocks, separators } = splitLanguageBlocks(verse.Text);
    if (separators > 1) anyMultiSeparator = true;

    const parsed = blocks.map(toLines);
    const nonEmpty = parsed.filter((b) => b !== null);
    if (nonEmpty.length === 0) continue;

    rows.push({
      primary: nonEmpty[0],
      secondary: nonEmpty.length > 1 ? nonEmpty[1] : null,
      type: sectionTypeFromTag(verse.Tag),
      number: verse.ID && verse.ID > 0 ? verse.ID : 1,
    });
  }

  if (rows.length === 0) {
    report.droppedSongs.push({ book: book.stem, title: song.Text, guid });
    return null;
  }

  if (anyMultiSeparator) {
    report.multiSeparator.push({ book: book.stem, title: song.Text, guid });
  }

  const hasSecondary = rows.some((r) => r.secondary);
  let langAIsTranslation = false;
  let langBIsTranslation = false;
  let markerRowsA = 0;
  let markerRowsB = 0;

  for (const r of rows) {
    if (r.primary.some((l) => TRANSLATION_MARKER_RE.test(l))) {
      langAIsTranslation = true;
      markerRowsA++;
    }
    if (r.secondary?.some((l) => TRANSLATION_MARKER_RE.test(l))) {
      langBIsTranslation = true;
      markerRowsB++;
    }
  }

  let flip = false;
  let flipReason = "";
  if (hasSecondary) {
    if (FORCE_FLIP.has(guid)) {
      flip = FORCE_FLIP.get(guid);
      flipReason = "override";
    } else if (langAIsTranslation && !langBIsTranslation) {
      flip = true;
      flipReason = "marker";
    }
  }

  if (flip) {
    for (const r of rows) {
      const tmp = r.primary;
      r.primary = r.secondary ?? tmp;
      r.secondary = r.secondary ? tmp : null;
    }
    [langAIsTranslation, langBIsTranslation] = [
      langBIsTranslation,
      langAIsTranslation,
    ];
    report.flipped.push({
      book: book.stem,
      title: song.Text,
      guid,
      reason: flipReason,
      firstPrimary: rows[0].primary[0],
      firstSecondary: rows[0].secondary?.[0] ?? "",
    });
  }

  if (markerRowsA > 0 && markerRowsB > 0) {
    report.bothLangMarkers.push({ book: book.stem, title: song.Text, guid });
  }

  const secondaryRows = rows.filter((r) => r.secondary).length;
  const markerRowsSecondary = flip ? markerRowsA : markerRowsB;
  if (
    langBIsTranslation &&
    markerRowsSecondary > 0 &&
    markerRowsSecondary < secondaryRows
  ) {
    report.partialMarkers.push({
      book: book.stem,
      title: song.Text,
      guid,
      marked: markerRowsSecondary,
      total: secondaryRows,
    });
  }

  for (const r of rows) {
    r.primary = stripTranslationMarker(r.primary);
    if (r.secondary) r.secondary = stripTranslationMarker(r.secondary);
    if (r.primary.length === 0) r.primary = null;
    if (r.secondary && r.secondary.length === 0) r.secondary = null;
  }
  const liveRows = rows.filter((r) => r.primary);
  if (liveRows.length === 0) {
    report.droppedSongs.push({ book: book.stem, title: song.Text, guid });
    return null;
  }

  {
    const runs = new Map();
    for (const r of liveRows) {
      const k = `${r.type}${r.number}`;
      runs.set(k, (runs.get(k) || 0) + 1);
    }
    for (const [k, n] of runs) {
      if (n >= 4) {
        report.longRuns.push({ book: book.stem, title: song.Text, guid, section: k, parts: n });
      }
    }

    const norm = (lines) => lines.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
    const chorusTexts = new Set(
      liveRows.filter((r) => r.type === "chorus").map((r) => norm(r.primary)),
    );
    for (const r of liveRows) {
      if (r.type === "verse" && chorusTexts.has(norm(r.primary))) {
        report.mislabeledChorus.push({
          book: book.stem,
          title: song.Text,
          guid,
          number: r.number,
          firstLine: r.primary[0],
        });
      }
    }
  }

  const bilingual = liveRows.some((r) => r.secondary);
  if (bilingual) {
    const missing = liveRows.filter((r) => !r.secondary).length;
    if (missing > 0) {
      report.missingSecondary.push({
        book: book.stem,
        title: song.Text,
        guid,
        missing,
        total: liveRows.length,
      });
    }
  }
  const splitFn = bilingual ? splitLinesBilingual : splitLinesMono;

  const primarySections = [];
  const secondarySections = [];

  liveRows.forEach((r, i) => {
    const order = i + 1;
    const slides = splitFn(r.primary);
    const altSlides = r.secondary
      ? alignSecondary(r.secondary, slides.length)
      : [];

    if (slides.length > 1) {
      report.autoSplit.push({
        book: book.stem,
        title: song.Text,
        guid,
        type: r.type,
        number: r.number,
        lines: r.primary.length,
        shape: slides.map((x) => x.length).join("+"),
        hasTinyTail: slides[slides.length - 1].length === 1,
      });
    }

    primarySections.push({
      order,
      type: r.type,
      number: r.number,
      lines: r.primary,
      slides,
    });

    if (r.secondary) {
      secondarySections.push({
        order,
        type: r.type,
        number: r.number,
        lines: r.secondary,
        slides: altSlides,
      });
    }
  });

  const text = [{ isTranslation: false, sections: primarySections }];
  if (secondarySections.length > 0) {
    text.push({ isTranslation: langBIsTranslation, sections: secondarySections });
  } else if (hasSecondary) {
    report.lostLanguage.push({ book: book.stem, title: song.Text, guid });
  }

  const rawTitle = song.TextPL || song.Text || "";
  const { title: strippedTitle, keyFromTitle, numberFromTitle } =
    parseTitleSuffix(rawTitle);

  let title = TITLE_OVERRIDES.get(guid) ?? strippedTitle;
  if (!TITLE_OVERRIDES.has(guid) && isAllCaps(title)) {
    const converted = fromAllCaps(title);
    report.capsTitles.push({ book: book.stem, guid, before: title, after: converted });
    title = converted;
  }
  if (/\n/.test(rawTitle)) {
    report.newlineTitles.push({ book: book.stem, guid, before: rawTitle, after: title });
  }

  const keyFromField = normalizeKey(song.Key, "en");
  let key;
  if (KEY_OVERRIDES.has(guid)) {
    key = KEY_OVERRIDES.get(guid);
  } else {
    key = keyFromTitle ?? keyFromField ?? null;
  }
  if (keyFromTitle && keyFromField && keyFromTitle !== keyFromField) {
    report.keyMismatch.push({
      book: book.stem,
      title,
      guid,
      fromTitle: keyFromTitle,
      fromField: keyFromField,
      chosen: key,
    });
  }
  if (!isValidKey(key)) {
    report.badKey.push({ book: book.stem, title, guid, raw: song.Key });
    key = null;
  }

  let number = null;
  if (book.hasNumbers) {
    number = typeof song.ID === "number" && song.ID > 0 ? song.ID : null;
    if (numberFromTitle && number && numberFromTitle !== number) {
      report.numberMismatch.push({
        book: book.stem,
        title,
        guid,
        fromTitle: numberFromTitle,
        fromField: number,
      });
    }
    if (!number && numberFromTitle) number = numberFromTitle;
  }

  const sequence = deriveSequence(primarySections);
  if (song.Sequence && song.Sequence.trim() !== sequence) {
    report.sequenceChanged.push({
      book: book.stem,
      title,
      guid,
      before: song.Sequence.trim(),
      after: sequence,
    });
  }

  primarySections.forEach((v) => {
    if (v.type === "ending") {
      report.endings.push({ book: book.stem, title, guid, lines: v.lines });
    }
  });

  let id = idmap[guid];
  if (!id) {
    id = crypto.randomUUID();
    idmap[guid] = id;
  }

  return { id, number, key, title, sequence, text };
}

function renderReport(report, stats) {
  const L = [];
  L.push("# Konverze songbooků — report ke kontrole");
  L.push("");
  L.push(
    "Generuje `scripts/build-songbooks.mjs`. Opravy se zapisují do override tabulek",
  );
  L.push("na začátku toho skriptu (`FORCE_FLIP`, `TITLE_OVERRIDES`, `KEY_OVERRIDES`)");
  L.push("a pak se pustí build znovu — `id` písní se drží přes `scripts/songbook-idmap.json`.");
  L.push("");
  L.push("## Souhrn");
  L.push("");
  L.push("| kniha | písní | sekcí | s druhým jazykem |");
  L.push("|---|---:|---:|---:|");
  for (const s of stats) {
    L.push(`| ${s.stem} | ${s.songs} | ${s.verses} | ${s.bilingual} |`);
  }
  L.push("");

  const section = (title, rows, render, note) => {
    L.push(`## ${title} (${rows.length})`);
    L.push("");
    if (note) {
      L.push(note);
      L.push("");
    }
    if (rows.length === 0) {
      L.push("_nic_");
      L.push("");
      return;
    }
    rows.forEach((r) => L.push(render(r)));
    L.push("");
  };

  section(
    "Prohozené jazyky",
    report.flipped,
    (r) =>
      `- **${r.book}** · ${JSON.stringify(r.title)} (${r.reason})\n  - originál: ${JSON.stringify(r.firstPrimary)}\n  - překlad: ${JSON.stringify(r.firstSecondary)}`,
    "text[0] musí být jazyk, ve kterém se píseň ZPÍVÁ. Zkontroluj, že sedí; když ne, přidej Guid do `FORCE_FLIP`.",
  );

  section(
    "Písně, které přišly o celý druhý jazyk",
    report.lostLanguage,
    (r) => `- **${r.book}** · ${JSON.stringify(r.title)}`,
    "Druhý jazyk byl u všech veršů jen placeholder (`...`) nebo prázdný → nezapsal se.",
  );

  section(
    "Verše bez překladu",
    report.missingSecondary,
    (r) => `- **${r.book}** · ${JSON.stringify(r.title)} — chybí u ${r.missing} z ${r.total} veršů`,
    "Dvojjazyčná píseň, kde část veršů druhý jazyk nemá (v originále placeholder `...`). Na plátně se u těch veršů zobrazí jen jeden jazyk — což je správně, ale možná to chceš dopsat.",
  );

  section(
    "Změněná sequence",
    report.sequenceChanged,
    (r) => `- **${r.book}** · ${r.title}\n  - před: \`${r.before}\`\n  - po:   \`${r.after}\``,
    "Původní `Sequence` z VideoPsalm často neodpovídala tomu, co je v písni fyzicky. Nová se odvozuje z veršů, takže vždy sedí. **Tohle je záměr, ne chyba.**",
  );

  section(
    "Sekce se 4+ díly už ve zdroji",
    report.longRuns,
    (r) => `- **${r.book}** · ${JSON.stringify(r.title)} — \`${r.section}\` má ${r.parts} dílů`,
    "Měřeno PŘED automatickým dělením, takže to nejsou dlouhé sloky — je to 4+ samostatných bloků označených ve VideoPsalm stejným číslem. Nejspíš zapomenuté zvyšování čísla sloky.",
  );

  section(
    "Refrén otagovaný jako sloka",
    report.mislabeledChorus,
    (r) => `- **${r.book}** · ${JSON.stringify(r.title)} — jako \`V${r.number}\`: ${JSON.stringify(r.firstLine)}`,
    "Blok, jehož text je doslova stejný jako refrén téže písně, ale ve VideoPsalm je otagovaný jako sloka. Text se zobrazí správně, jen popisek nahoře řekne „Verse N“ místo „Chorus“. Opraví se v editoru přepnutím typu — nechal jsem to na tobě, protože automatické přetypování by u písní s opakovaným veršem uškodilo.",
  );

  section(
    "Ending sekce",
    report.endings,
    (r) => `- **${r.book}** · ${r.title}\n  \`\`\`\n  ${r.lines.join("\n  ")}\n  \`\`\``,
    "Typ, který appka nikdy nekreslila (VideoPsalm Tag:3). Ověř, že dává smysl.",
  );

  section(
    "Neshoda tóniny (název vs. pole Key)",
    report.keyMismatch,
    (r) =>
      `- **${r.book}** · ${r.title} — z názvu \`${r.fromTitle}\`, z pole \`${r.fromField}\` → **zvoleno \`${r.chosen}\`**`,
    "Přednost má tónina z názvu (je jí v datech víc a je to to, co je vytištěné).",
  );

  section(
    "Neshoda čísla (název vs. pole ID)",
    report.numberMismatch,
    (r) => `- **${r.book}** · ${r.title} — z názvu ${r.fromTitle}, z pole ${r.fromField} → **zvoleno ${r.fromField}**`,
  );

  section(
    "Nerozpoznaná tónina",
    report.badKey,
    (r) => `- **${r.book}** · ${r.title} — \`${r.raw}\` → null`,
  );

  section(
    "Převod VERZÁLEK v názvu",
    report.capsTitles,
    (r) => `- **${r.book}** · \`${r.before}\` → \`${r.after}\``,
    "Nejrizikovější automatická úprava celé migrace — projdi řádek po řádku. Opravy do `TITLE_OVERRIDES`.",
  );

  section(
    "Názvy s odřádkováním",
    report.newlineTitles,
    (r) => `- **${r.book}** · ${JSON.stringify(r.before)} → ${JSON.stringify(r.after)}`,
  );

  section(
    "Částečné translation markery",
    report.partialMarkers,
    (r) => `- **${r.book}** · ${r.title} — marker u ${r.marked} z ${r.total} veršů`,
    "Marker byl jen u části veršů, ale příznak platí pro celý jazyk (tak jsme se dohodli).",
  );

  section(
    "Marker v obou jazycích",
    report.bothLangMarkers,
    (r) => `- **${r.book}** · ${JSON.stringify(r.title)}`,
    "Podezřelé — zkontroluj, který jazyk je opravdu zpívaný.",
  );

  section(
    "Verše s víc než jedním oddělovačem",
    report.multiSeparator,
    (r) => `- **${r.book}** · ${JSON.stringify(r.title)}`,
    "Použily se jen první dva neprázdné bloky.",
  );

  const tinyTails = report.autoSplit.filter((r) => r.hasTinyTail);
  section(
    "Automatické dělení s jednořádkovým ocasem",
    tinyTails,
    (r) => `- **${r.book}** · ${r.title} — ${r.type} ${r.number}: ${r.lines} řádků → ${r.shape}`,
    `Celkem automaticky rozděleno ${report.autoSplit.length} sekcí; tady jsou ty, kde poslední slide zůstal jednořádkový (na plátně to vypadá divně). Jde opravit v editoru.`,
  );

  section(
    "Zahozené písně",
    report.droppedSongs,
    (r) => `- **${r.book}** · ${JSON.stringify(r.title)} — po odstranění markupu prázdná`,
  );

  return L.join("\n") + "\n";
}

function main() {
  const idmap = fs.existsSync(IDMAP_PATH)
    ? JSON.parse(fs.readFileSync(IDMAP_PATH, "utf8"))
    : {};
  const idmapSizeBefore = Object.keys(idmap).length;

  const report = {
    flipped: [],
    lostLanguage: [],
    missingSecondary: [],
    mislabeledChorus: [],
    sequenceChanged: [],
    longRuns: [],
    endings: [],
    keyMismatch: [],
    numberMismatch: [],
    badKey: [],
    capsTitles: [],
    newlineTitles: [],
    partialMarkers: [],
    bothLangMarkers: [],
    multiSeparator: [],
    autoSplit: [],
    droppedSongs: [],
  };
  const stats = [];

  for (const book of BOOKS) {
    const srcPath = path.join(SRC_DIR, `${book.stem}.json`);
    if (!fs.existsSync(srcPath)) {
      console.error(`CHYBÍ zdroj: ${srcPath}`);
      process.exitCode = 1;
      continue;
    }
    const parsed = parseVideoPsalmJson(fs.readFileSync(srcPath, "utf8"));
    const songs = [];
    for (const song of parsed.Songs || []) {
      const converted = convertSong(song, book, report, idmap);
      if (converted) songs.push(converted);
    }

    const out = { name: book.name, songs };
    const outPath = path.join(OUT_DIR, `${book.stem}.json`);
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

    stats.push({
      stem: book.stem,
      songs: songs.length,
      verses: songs.reduce((n, s) => n + s.text[0].sections.length, 0),
      bilingual: songs.filter((s) => s.text.length > 1).length,
    });
    console.log(
      `${book.stem.padEnd(16)} ${String(songs.length).padStart(4)} písní → ${path.relative(ROOT, outPath)}`,
    );
  }

  fs.writeFileSync(IDMAP_PATH, JSON.stringify(idmap, null, 2) + "\n", "utf8");
  fs.writeFileSync(REPORT_PATH, renderReport(report, stats), "utf8");

  const added = Object.keys(idmap).length - idmapSizeBefore;
  console.log(
    `\nid mapa: ${Object.keys(idmap).length} záznamů (${added} nových) → ${path.relative(ROOT, IDMAP_PATH)}`,
  );
  console.log(`report → ${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`celkem: ${stats.reduce((n, s) => n + s.songs, 0)} písní`);
}

main();
