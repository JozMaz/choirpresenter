import type {
  ApiItem,
  EditorSection,
  SectionType,
  Song,
  SongBookKey,
  Verse,
} from "./types";
import { formatSequencePart } from "./sequence";

/** Editor state → Song (JSON format pro disk). */
export interface BuildSongArgs {
  songName: string;
  key: string;
  sections: EditorSection[];
  targetBook: SongBookKey | "custom";
  /** Při editaci: zachováme ID, Guid a původní Sequence pokud se počty sekcí nezměnily. */
  existing?: Song;
  /** Pro nové písně se použije, pokud existing chybí. */
  nextId?: number;
  /** Uživatel zadané vlastní ID — přebije existing.ID i nextId. */
  customId?: number;
}

/** Songbooks, které ukládají verše ve dvojjazyčném formátu (TextPL/TextEN). */
const BILINGUAL_BOOKS = new Set<string>([
  "newSongPlGb",
  "roboczy",
  "children",
]);

export function buildSongFromEditor(args: BuildSongArgs): Song {
  const { songName, key, sections, targetBook, existing, nextId, customId } =
    args;
  const hasBilingual = sections.some((s) => s.textEN.trim() !== "");
  const isPlEn = BILINGUAL_BOOKS.has(targetBook);

  const verses: Verse[] = sections.map((section) => {
    const tag =
      section.type === "chorus"
        ? 1
        : section.type === "bridge"
          ? 2
          : undefined;
    const verseId =
      section.type === "verse"
        ? section.number
        : section.number === 1
          ? 0
          : section.number;

    if (isPlEn || hasBilingual) {
      return {
        Tag: tag,
        ID: verseId,
        TextPL: section.textPL,
        TextEN: section.textEN || undefined,
      };
    }
    return { Tag: tag, ID: verseId, Text: section.textPL };
  });

  // Sekvence: pokud editujeme a počet sekcí se nezměnil, zachováme původní
  // (kvůli opakování chorusu apod.). Jinak vygenerujeme z aktuálních sekcí.
  const sequence =
    existing && existing.Sequence && sections.length === existing.Verses.length
      ? existing.Sequence
      : sections.map((s) => formatSequencePart(s.type, s.number)).join(" ");

  // Priorita: user customId > existing > auto nextId
  const id = customId ?? existing?.ID ?? nextId ?? 0;
  const guid = existing?.Guid ?? crypto.randomUUID();

  if (isPlEn) {
    return {
      ID: id,
      Guid: guid,
      Verses: verses,
      TextPL: songName,
      Sequence: sequence,
      Key: key,
    };
  }

  return {
    ID: id,
    Guid: guid,
    Verses: verses,
    Text: songName,
    Sequence: sequence,
    Key: key,
  };
}

/** ApiItem → editor sections pro pre-fill při editaci. */
export function apiItemToEditorSections(item: ApiItem): EditorSection[] {
  return item.verses.map((v) => {
    const type: SectionType =
      v.Tag === 1 ? "chorus" : v.Tag === 2 ? "bridge" : "verse";

    let number: number;
    if (type === "verse") {
      number = v.ID && v.ID > 0 ? v.ID : 1;
    } else {
      number = !v.ID || v.ID === 0 ? 1 : v.ID;
    }

    const textPL = v.TextPL || v.Text || "";
    const textEN = v.TextEN || "";

    return {
      id: crypto.randomUUID(),
      type,
      number,
      textPL,
      textEN,
      showEN: !!textEN,
    };
  });
}

/** Najde max ID napříč songbookem pro generování nového ID. */
export function getNextSongbookId(songs: Song[], min = 1): number {
  return songs.reduce((max, s) => Math.max(max, s.ID || 0), min);
}
