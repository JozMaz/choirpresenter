import type { BibleKey } from "./bibleData";
import type { ApiItem, SongSource } from "./types";

export interface BibleChapterRef {
  bibleKey: BibleKey;
  bookFlatIdx: number;
  chapterIdx: number;
  bookName: string;
  bibleName: string;
}

interface SelectedBase {
  key: string;
  // Where the operator was when the entry was put on the list: the verse, the
  // chunk or the part. Reopening it lands there instead of at the top.
  stepIndex: number;
}

export interface SelectedSong extends SelectedBase {
  kind: "song";
  item: ApiItem;
}

export interface SelectedBible extends SelectedBase, BibleChapterRef {
  kind: "bible";
}

export interface SelectedMessage extends SelectedBase {
  kind: "message";
  dateKey: string;
  title: string;
  location: string;
}

export type SelectedEntry = SelectedSong | SelectedBible | SelectedMessage;

export const songEntryKey = (source: SongSource, id: string): string =>
  `song:${source}:${id}`;

export const bibleEntryKey = (ref: BibleChapterRef): string =>
  `bible:${ref.bibleKey}:${ref.bookFlatIdx}:${ref.chapterIdx}`;

export const messageEntryKey = (dateKey: string): string => `msg:${dateKey}`;

// Bible chapters and sermons are kept as references rather than as the loaded
// item: one sermon carries its whole text, and a handful of them would blow
// past what localStorage can hold.
export function entryFor(
  item: ApiItem,
  stepIndex: number,
): SelectedEntry | null {
  if (item.isBible) {
    const meta = item.bibleMeta;
    if (!meta || meta.bibleKey === undefined) return null;
    const ref: BibleChapterRef = {
      bibleKey: meta.bibleKey,
      bookFlatIdx: meta.bookFlatIdx,
      chapterIdx: meta.chapter - 1,
      bookName: meta.bookName,
      bibleName: meta.bibleName,
    };
    return { kind: "bible", key: bibleEntryKey(ref), stepIndex, ...ref };
  }
  if (item.isMessage) {
    const meta = item.messageMeta;
    if (!meta) return null;
    return {
      kind: "message",
      key: messageEntryKey(meta.dateKey),
      stepIndex,
      dateKey: meta.dateKey,
      title: meta.title,
      location: meta.location,
    };
  }
  return {
    kind: "song",
    key: songEntryKey(item.source, item.id),
    stepIndex,
    item,
  };
}

export const entryKeyFor = (item: ApiItem | null): string | null =>
  item ? (entryFor(item, -1)?.key ?? null) : null;

export function entryTitle(entry: SelectedEntry): { main: string; sub: string } {
  if (entry.kind === "bible") {
    return {
      main: `${entry.bookName} ${entry.chapterIdx + 1}`,
      sub: entry.bibleName,
    };
  }
  if (entry.kind === "message") {
    return {
      main: entry.title,
      sub: entry.location
        ? `${entry.dateKey} · ${entry.location}`
        : entry.dateKey,
    };
  }
  const { item } = entry;
  return {
    main: item.number !== null ? `${item.number}. ${item.title}` : item.title,
    sub: item.source === "custom" ? "" : item.bookName,
  };
}

export function moveEntry(
  entries: SelectedEntry[],
  fromKey: string,
  toKey: string,
): SelectedEntry[] {
  const from = entries.findIndex((e) => e.key === fromKey);
  const to = entries.findIndex((e) => e.key === toKey);
  if (from === -1 || to === -1 || from === to) return entries;
  const next = [...entries];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// Before this list could hold anything but songs it was persisted as bare
// ApiItems, so anything without a `kind` is one of those.
export function readSelectedEntries(raw: string | null): SelectedEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const entries: SelectedEntry[] = [];
    for (const value of parsed) {
      if (!value || typeof value !== "object") continue;
      if (typeof value.kind === "string" && typeof value.key === "string") {
        entries.push({
          ...value,
          stepIndex: typeof value.stepIndex === "number" ? value.stepIndex : -1,
        } as SelectedEntry);
        continue;
      }
      const legacy = entryFor(value as ApiItem, -1);
      if (legacy) entries.push(legacy);
    }
    return entries;
  } catch (err) {
    console.error("Failed to read the selected list", err);
    return [];
  }
}
