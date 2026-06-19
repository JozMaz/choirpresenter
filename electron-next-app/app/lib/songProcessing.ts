import type {
  ApiItem,
  SectionListItem,
  Song,
  SongSource,
  Verse,
  VerseParts,
} from "./types";
import {
  buildSearchIndex,
  removeStyleTags,
  stripTitleSuffix,
} from "./textUtils";
import {
  splitVerseIntoParts,
  splitVerseIntoPartsForPLEN,
} from "./verseSplitting";
import { autoDetectSequence } from "./sequence";

/** PL-only songbook formát (každý verš má jen `Text`). */
export const processPlOnlySongbook = (
  song: Song,
  source: SongSource,
): ApiItem => {
  const cleanVerses = song.Verses.map((verse) => ({
    ...verse,
    Text: removeStyleTags(verse.Text || ""),
  }));

  const fullText = cleanVerses
    .map((v, i) => {
      const verseLabel = v.Tag === 1 ? `Ref.${v.ID || ""}` : `${i + 1}.`;
      return `${verseLabel} ${v.Text || ""}`;
    })
    .join("\n\n");

  const title = stripTitleSuffix(removeStyleTags(song.Text || ""));

  const searchIndex = buildSearchIndex(
    `${song.ID} ${title} ${cleanVerses.map((v) => v.Text || "").join(" ")}`,
  );

  return {
    id: song.ID,
    text: title,
    title,
    fullText,
    selected: false,
    sequence: song.Sequence || autoDetectSequence(cleanVerses),
    verses: cleanVerses,
    key: song.Key || "",
    source,
    searchIndex,
  };
};

/** PL+EN songbook formát (verše mají `TextPL` + `TextEN`). */
export const processBilingualSongbook = (
  song: Song,
  source: SongSource,
): ApiItem => {
  const cleanVerses = song.Verses.map((verse) => ({
    ...verse,
    // Některé verše v bilingual books mají jen `Text` (PL-only). Strippneme i ten,
    // aby `<s\d+>`, `<f...>`, `<i>` tagy nezůstaly v rendrované podobě.
    Text: verse.Text ? removeStyleTags(verse.Text) : verse.Text,
    TextPL: removeStyleTags(verse.TextPL || ""),
    TextEN: removeStyleTags(verse.TextEN || ""),
  }));

  const fullText = cleanVerses
    .map((v, i) => {
      const verseLabel = v.Tag === 1 ? `Ref.${v.ID || ""}` : `${i + 1}.`;
      const plPart = v.TextPL ? `🇵🇱 ${v.TextPL}` : "";
      const enPart = v.TextEN ? `\n🇬🇧 ${v.TextEN}` : "";
      return `${verseLabel}\n${plPart}${enPart}`;
    })
    .join("\n\n");

  const title = stripTitleSuffix(
    removeStyleTags(song.TextPL || song.Text || ""),
  );
  const titleEN = stripTitleSuffix(removeStyleTags(song.TextEN || ""));
  const searchIndex = buildSearchIndex(
    `${song.ID} ${title} ${titleEN} ${cleanVerses
      .map((v) => `${v.TextPL || ""} ${v.TextEN || ""}`)
      .join(" ")}`,
  );

  return {
    id: song.ID,
    text: title,
    title,
    fullText,
    selected: false,
    sequence: song.Sequence || autoDetectSequence(cleanVerses),
    verses: cleanVerses,
    key: song.Key || "",
    source,
    searchIndex,
  };
};

// Backwards-compat aliases (zatím používáme jinde v kódu)
export const processNowaPiesn = (song: Song) =>
  processPlOnlySongbook(song, "newSong");
export const processSongsPlEn = (song: Song) =>
  processBilingualSongbook(song, "newSongPlGb");

/** Vrátí true, pokud aspoň jeden verš má TextEN — pak je píseň dvojjazyčná. */
export const isBilingualSource = (item: ApiItem): boolean =>
  item.verses.some((v) => v.TextEN?.trim());

/**
 * Vrátí název písně pro zobrazení v preview footer / HDMI footer.
 * Pro roboczy songbook ukáže "(Śpiewnik roboczy)" místo názvu z JSONu.
 */
export const getDisplayTitle = (song: ApiItem): string => {
  if (song.source === "roboczy") return "(Śpiewnik roboczy)";
  return song.title;
};

/** Polské názvy songbooků pro patičku ve previewu / HDMI. */
const SONGBOOK_POLISH_NAMES: Record<string, string> = {
  newSong: "Nowa pieśń",
  newSongPlGb: "Śpiewnik polsko-angielski",
  pielgrzym: "Śpiewnik pielgrzyma",
  roboczy: "Śpiewnik roboczy",
  children: "Śpiewnik dziecięcy",
};

/**
 * Když má titul na konci (...) co vypadá jako hudební tónina ("(d-moll)",
 * "(Em)", "(F#)", "(c-moll)"), strip ji — `song.key` je autoritativní zdroj.
 * Bez toho by patička dvakrát ukazovala tóninu: "Title (d-moll)  (Em)  ...".
 */
const KEY_TRAIL_RE =
  /\s*\(\s*[A-Ha-h][#♯b♭]?(?:\s*-?\s*(?:m(?:oll|inor|ajor)?|dur))?\s*\)\s*$/i;
const stripKeyFromTitle = (title: string): string =>
  title.replace(KEY_TRAIL_RE, "").trim();

/**
 * Sestaví patičku pro song mód: "{title}  ({key})  {id}  ({songbook})".
 * Části bez hodnoty se vynechají. Pro custom songy se songbook nezobrazí.
 */
export const buildSongFooter = (song: ApiItem): string => {
  const parts: string[] = [];
  const title = song.title ? stripKeyFromTitle(song.title) : "";
  if (title) parts.push(title);
  if (song.key?.trim()) parts.push(`(${song.key.trim()})`);
  if (song.id && song.id > 0) parts.push(String(song.id));
  const sb = SONGBOOK_POLISH_NAMES[song.source];
  if (sb) parts.push(`(${sb})`);
  return parts.join("  ");
};

export const getVerseText = (verse: Verse, _source: SongSource): string => {
  // Pokud verse má TextPL (dvojjazyčná), použij ji; jinak Text (PL-only formát).
  return verse.TextPL || verse.Text || "";
};

/** Extrahuje části písně podle Sequence (pro Nowa Pieśń) */
export const extractSongParts = (
  item: ApiItem,
): { verseText: string; parts: string[] }[] => {
  const result: { verseText: string; parts: string[] }[] = [];

  if (!item.sequence || !item.verses) {
    if (item.verses) {
      item.verses.forEach((verse) => {
        const verseText = getVerseText(verse, item.source);
        result.push({ verseText, parts: splitVerseIntoParts(verseText) });
      });
    }
    return result;
  }

  const sequenceParts = item.sequence.split(/\s+/);

  sequenceParts.forEach((partCode) => {
    if (partCode.startsWith("V")) {
      const verseId = parseInt(partCode.substring(1));
      const verse = item.verses.find((v) => !v.Tag && v.ID === verseId);

      if (verse) {
        const verseText = getVerseText(verse, item.source);
        result.push({ verseText, parts: splitVerseIntoParts(verseText) });
      } else {
        const verseByIndex = item.verses.filter((v) => !v.Tag)[verseId - 1];
        if (verseByIndex) {
          const verseText = getVerseText(verseByIndex, item.source);
          result.push({ verseText, parts: splitVerseIntoParts(verseText) });
        }
      }
    } else if (partCode === "C" || partCode.startsWith("C")) {
      let chorus: Verse | undefined;
      if (partCode === "C") {
        chorus = item.verses.find(
          (v) => v.Tag === 1 && (v.ID === 0 || v.ID === undefined),
        );
      } else {
        const chorusId = parseInt(partCode.substring(1));
        chorus = item.verses.find((v) => v.Tag === 1 && v.ID === chorusId);
      }
      if (chorus) {
        const verseText = getVerseText(chorus, item.source);
        result.push({ verseText, parts: splitVerseIntoParts(verseText) });
      }
    }
  });

  if (result.length === 0) {
    item.verses.forEach((verse) => {
      const verseText = getVerseText(verse, item.source);
      result.push({ verseText, parts: splitVerseIntoParts(verseText) });
    });
  }

  return result;
};

/** Plochý seznam všech částí pro navigaci (pro Nowa Pieśń) */
export const getAllPartsFlat = (
  item: ApiItem,
): { verseText: string; partText: string }[] => {
  const parts = extractSongParts(item);
  const flatList: { verseText: string; partText: string }[] = [];
  parts.forEach((verse) => {
    verse.parts.forEach((part) => {
      flatList.push({ verseText: verse.verseText, partText: part });
    });
  });
  return flatList;
};

/**
 * Detekuje "placeholder" text bez skutečného obsahu (např. "...", prázdný string,
 * jen mezery/pomlčky/tečky). Používáme pro detekci chybějícího EN překladu.
 */
const isPlaceholderText = (text: string): boolean => {
  if (!text) return true;
  // strip tagy + whitespace
  const cleaned = text.replace(/<[^>]+>/g, "").trim();
  if (!cleaned) return true;
  // Jen dots / dashes / mezery / unicode ellipsis
  if (/^[.\s\-–—…]+$/.test(cleaned)) return true;
  return false;
};

/**
 * Rozdělí EN řádky na stejný počet částí jako má PL.
 * Lines distribuovány rovnoměrně — pokud PL má 2 části, EN se rozdělí na 2 části;
 * pokud PL má 1 část, celý EN je v jedné části.
 */
const alignEnToPlParts = (
  enLines: string[],
  plPartCount: number,
): string[] => {
  if (plPartCount <= 1) return [enLines.join("\n")];
  const total = enLines.length;
  const out: string[] = [];
  for (let i = 0; i < plPartCount; i++) {
    const start = Math.floor((i * total) / plPartCount);
    const end = Math.floor(((i + 1) * total) / plPartCount);
    out.push(enLines.slice(start, end).join("\n"));
  }
  return out;
};

/** Zpracuje všechny verše pro PL/EN a vytvoří seznam částí */
export const processAllVersesForPLEN = (item: ApiItem): VerseParts[] => {
  const result: VerseParts[] = [];

  item.verses.forEach((verse, index) => {
    const plRaw = verse.TextPL || "";
    const enRaw = verse.TextEN || "";

    // Pokud EN je placeholder (např. "...", prázdné), zachovej se s veršem
    // jako mono-lingual — fullEN i enParts zůstanou prázdné. Na Output 1/2/HDMI
    // se pak nezobrazí žádný EN blok ani separator.
    const plHasContent = !isPlaceholderText(plRaw);
    const enHasContent = !isPlaceholderText(enRaw);

    if (!plHasContent && !enHasContent) return;

    const plLines = plHasContent
      ? plRaw.split("\n").filter((l) => l.trim() !== "")
      : [];
    const enLines = enHasContent
      ? enRaw.split("\n").filter((l) => l.trim() !== "")
      : [];

    const plParts = plHasContent ? splitVerseIntoPartsForPLEN(plLines) : [""];
    const enParts = enHasContent
      ? alignEnToPlParts(enLines, plParts.length)
      : [];

    result.push({
      verseIndex: index,
      fullPL: plHasContent ? plRaw : "",
      fullEN: enHasContent ? enRaw : "",
      plParts,
      enParts,
      isTranslation: verse.IsTranslation === true,
    });
  });

  return result;
};

/** První neprázdný řádek textu */
const firstLine = (text: string): string =>
  text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l) || "";

/** Celý text jako jeden řádek (newlines → mezera, collapsed whitespace). */
const singleLine = (text: string): string =>
  text.replace(/\s+/g, " ").trim();

/** Seznam sekcí písně pro pravý dolní panel */
export const getSongSections = (item: ApiItem): SectionListItem[] => {
  // Message mód: každá sekce = jeden chunk. Label prázdný — paragraph number
  // už je součástí textu ("1. Text" nebo "1. ... Text").
  if (item.isMessage && item.messageMeta) {
    const songParts = extractSongParts(item);
    return songParts.map((sp) => ({
      label: "",
      previewPL: firstLine(sp.verseText),
      previewEN: "",
      fullText: sp.verseText,
    }));
  }

  // Bible mód: každá sekce = jeden verš, label je jen "N."
  if (item.isBible) {
    const sequenceParts = (item.sequence || "").split(/\s+/).filter(Boolean);
    const songParts = extractSongParts(item);
    return songParts.map((sp, i) => {
      const code = sequenceParts[i] || "";
      const verseNum = code.startsWith("V") ? code.substring(1) : `${i + 1}`;
      return {
        label: `${verseNum}.`,
        previewPL: firstLine(sp.verseText),
        previewEN: "",
        fullText: sp.verseText,
      };
    });
  }

  if (isBilingualSource(item)) {
    const all = item.verses.filter((v) => v.TextPL || v.TextEN);
    return all.map((v) => {
      const fullText = [v.TextPL || "", v.TextEN || ""]
        .filter(Boolean)
        .join("\n\n");
      const previewPL = singleLine(v.TextPL || "");
      const previewEN = singleLine(v.TextEN || "");
      // Label respektuje verse.ID. Když má píseň víc veršů se stejným ID
      // (např. sequence "V1 V1 V1 V2" = 3× V1 + 1× V2), label je "Verse 1"
      // pro všechny tři, ne "Verse 1/2/3" podle pozice. Fallback na array
      // pozici jen když ID chybí / je 0.
      if (v.Tag === 1) {
        if (!v.ID || v.ID === 0) {
          const list = all.filter((x) => x.Tag === 1);
          const idx = list.indexOf(v) + 1;
          return {
            label: list.length > 1 ? `Chorus ${idx}` : "Chorus",
            previewPL,
            previewEN,
            fullText,
          };
        }
        return {
          label: v.ID === 1 ? "Chorus" : `Chorus ${v.ID}`,
          previewPL,
          previewEN,
          fullText,
        };
      }
      if (v.Tag === 2) {
        if (!v.ID || v.ID === 0) {
          const list = all.filter((x) => x.Tag === 2);
          const idx = list.indexOf(v) + 1;
          return {
            label: list.length > 1 ? `Bridge ${idx}` : "Bridge",
            previewPL,
            previewEN,
            fullText,
          };
        }
        return {
          label: v.ID === 1 ? "Bridge" : `Bridge ${v.ID}`,
          previewPL,
          previewEN,
          fullText,
        };
      }
      if (v.ID && v.ID > 0) {
        return { label: `Verse ${v.ID}`, previewPL, previewEN, fullText };
      }
      const verseList = all.filter((x) => !x.Tag);
      const idx = verseList.indexOf(v) + 1;
      return { label: `Verse ${idx}`, previewPL, previewEN, fullText };
    });
  }

  const sequenceParts = (item.sequence || "").split(/\s+/).filter(Boolean);
  const songParts = extractSongParts(item);
  return songParts.map((sp, i) => {
    const code = sequenceParts[i] || "";
    let label = code;
    if (code.startsWith("V")) label = `Verse ${code.substring(1) || "1"}`;
    else if (code === "C") label = "Chorus";
    else if (code.startsWith("C")) label = `Chorus ${code.substring(1)}`;
    else if (code === "B") label = "Bridge";
    else if (code.startsWith("B")) label = `Bridge ${code.substring(1)}`;
    return {
      label,
      previewPL: singleLine(sp.verseText),
      previewEN: "",
      fullText: sp.verseText,
    };
  });
};
