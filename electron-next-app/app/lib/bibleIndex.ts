import type { Bible, BibleKey, BibleVerse } from "./bibleData";
import { getBookName, stripBookAlias } from "./bibleData";
import { buildSearchIndex } from "./textUtils";

export interface FlatVerse {
  bookFlatIdx: number;
  /** Display name s aliasem (např. "Ks. Lamentacje (Treny)"). */
  bookDisplayName: string;
  /** Reference name bez aliasu. */
  bookReferenceName: string;
  chapterIdx: number;
  verseIdx: number;
  verseId: number;
  text: string;
  reference: string;
  searchIndex: string;
  chapterVerses: BibleVerse[];
}

const formatBookName = (name: string) =>
  /^\d/.test(name) ? name : `Ks. ${name}`;

const cache = new Map<BibleKey, FlatVerse[]>();
const scheduled = new Set<BibleKey>();
const listeners = new Map<BibleKey, Array<() => void>>();

function build(bible: Bible, activeBible: BibleKey): FlatVerse[] {
  const list: FlatVerse[] = [];
  let bookFlatIdx = 0;
  for (const testament of bible.Testaments || []) {
    for (const book of testament.Books || []) {
      const chapters = book.Chapters || [];
      const rawName = getBookName(activeBible, bookFlatIdx);
      const bookDisplayName = formatBookName(rawName);
      const bookReferenceName = formatBookName(stripBookAlias(rawName));
      for (let chIdx = 0; chIdx < chapters.length; chIdx++) {
        const verses = chapters[chIdx].Verses || [];
        for (let vIdx = 0; vIdx < verses.length; vIdx++) {
          const v = verses[vIdx];
          const verseId = v.ID || vIdx + 1;
          const reference = `${bookReferenceName} ${chIdx + 1}:${verseId}`;
          const text = v.Text || "";
          list.push({
            bookFlatIdx,
            bookDisplayName,
            bookReferenceName,
            chapterIdx: chIdx,
            verseIdx: vIdx,
            verseId,
            text,
            reference,
            searchIndex: buildSearchIndex(`${reference} ${text}`),
            chapterVerses: verses,
          });
        }
      }
      bookFlatIdx++;
    }
  }
  return list;
}

export function isBibleVerseIndexReady(activeBible: BibleKey): boolean {
  return cache.has(activeBible);
}

/** Vrátí cached FlatVerse[] nebo postaví synchronně (a nacachuje). */
export function getBibleVerseIndex(
  bible: Bible,
  activeBible: BibleKey,
): FlatVerse[] {
  let v = cache.get(activeBible);
  if (!v) {
    v = build(bible, activeBible);
    cache.set(activeBible, v);
  }
  return v;
}

/**
 * Build na pozadí pro všechny dostupné bible. `bibles` mapa může mít null.
 * Volat až po useBibles.loaded === true. Idempotentní.
 * `onDone` zavolán jednou až všechny dostupné bible jsou nacachované.
 */
export function prebuildBibleVerseIndexes(
  bibles: Record<BibleKey, Bible | null>,
  onDone?: () => void,
): void {
  if (typeof window === "undefined") {
    onDone?.();
    return;
  }
  const keys = (Object.keys(bibles) as BibleKey[]).filter(
    (k) => bibles[k] !== null,
  );
  if (keys.length === 0) {
    onDone?.();
    return;
  }

  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void) => number;
  };
  const idle = (cb: () => void) =>
    typeof w.requestIdleCallback === "function"
      ? w.requestIdleCallback(cb)
      : setTimeout(cb, 0);

  // Postupně po sobě (sequence) — nezamknout main thread víc bibliemi naráz.
  let i = 0;
  const next = () => {
    if (i >= keys.length) {
      onDone?.();
      return;
    }
    const k = keys[i++];
    const b = bibles[k];
    if (!b || cache.has(k)) {
      next();
      return;
    }
    if (scheduled.has(k)) {
      // Někdo jiný už buildy spustil; registruj listener a počkej.
      const arr = listeners.get(k) ?? [];
      arr.push(next);
      listeners.set(k, arr);
      return;
    }
    scheduled.add(k);
    idle(() => {
      if (!cache.has(k)) cache.set(k, build(b, k));
      const ls = listeners.get(k) ?? [];
      listeners.delete(k);
      for (const l of ls) l();
      next();
    });
  };
  next();
}
