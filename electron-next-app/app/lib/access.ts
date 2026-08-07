import type { SongBookKey } from "./types";

export type Role = "admin" | "org";

export interface Identity {
  role: Role;
  orgId: string;
  name: string;
}

export interface CatalogSongbook {
  key: SongBookKey;
  name: string;
  songs?: number;
}

export interface CatalogBible {
  key: string;
  name: string;
}

export interface Catalog {
  version: string;
  songbooks: CatalogSongbook[];
  bibles: CatalogBible[];
  messages: { count: number; sizeMb: number };
}

export interface ContentSelection {
  songbooks: SongBookKey[];
  bibles: string[];
  messages: boolean;
}

export const EMPTY_SELECTION: ContentSelection = {
  songbooks: [],
  bibles: [],
  messages: false,
};

export const BIBLE_CACHE_KEYS: Record<string, string> = {
  warszawska: "data/bibles/Biblia Warszawska.json",
  gdanska: "data/bibles/Uwspółcześniona Biblia Gdańska.json",
};

export const SONGBOOK_CACHE_KEYS: Record<SongBookKey, string> = {
  newSong: "data/songs/new-song.json",
  newSongPlGb: "data/songs/new-song-pl-gb.json",
  pielgrzym: "data/songs/pielgrzym.json",
  roboczy: "data/songs/roboczy.json",
  children: "data/songs/children.json",
};

export const ALL_SONGBOOK_KEYS = Object.keys(
  SONGBOOK_CACHE_KEYS,
) as SongBookKey[];

export function isSelectionEmpty(selection: ContentSelection): boolean {
  return (
    selection.songbooks.length === 0 &&
    selection.bibles.length === 0 &&
    !selection.messages
  );
}

const sameKey = (a: string, b: string | undefined): boolean =>
  b !== undefined && a.normalize("NFC") === b.normalize("NFC");

export function wantsFile(key: string, selection: ContentSelection): boolean {
  if (key.startsWith("data/messages/")) return selection.messages;
  if (key.startsWith("data/bibles/")) {
    return selection.bibles.some((b) => sameKey(key, BIBLE_CACHE_KEYS[b]));
  }
  if (key.startsWith("data/songs/")) {
    return selection.songbooks.some((s) =>
      sameKey(key, SONGBOOK_CACHE_KEYS[s]),
    );
  }
  return true;
}

export function newlyOffered(
  catalog: Catalog,
  selection: ContentSelection,
  sermonsLabel: string,
): string[] {
  const fresh: string[] = [];
  for (const book of catalog.songbooks) {
    if (!selection.songbooks.includes(book.key)) fresh.push(book.name);
  }
  for (const bible of catalog.bibles) {
    if (!selection.bibles.includes(bible.key)) fresh.push(bible.name);
  }
  if ((catalog.messages?.count ?? 0) > 0 && !selection.messages) {
    fresh.push(sermonsLabel);
  }
  return fresh;
}

export function parseCatalog(raw: string | null): Catalog | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Catalog>;
    return {
      version: String(parsed.version ?? "0"),
      songbooks: Array.isArray(parsed.songbooks) ? parsed.songbooks : [],
      bibles: Array.isArray(parsed.bibles) ? parsed.bibles : [],
      messages: parsed.messages ?? { count: 0, sizeMb: 0 },
    };
  } catch {
    return null;
  }
}

export function normalizeSelection(value: unknown): ContentSelection {
  if (!value || typeof value !== "object") return EMPTY_SELECTION;
  const v = value as Partial<ContentSelection>;
  return {
    songbooks: Array.isArray(v.songbooks) ? v.songbooks : [],
    bibles: Array.isArray(v.bibles) ? v.bibles : [],
    messages: v.messages === true,
  };
}
