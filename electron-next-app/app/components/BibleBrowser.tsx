"use client";

import { useMemo, useState } from "react";
import type { Bible, BibleKey, BibleVerse } from "../lib/bibleData";
import {
  BIBLE_LABELS,
  getBookByFlatIndex,
  getBookName,
  getTotalBookCount,
  stripBookAlias,
} from "../lib/bibleData";
import { normalizeSearch } from "../lib/textUtils";
import { highlightSnippet } from "../lib/searchHighlight";
import { scoreTokens } from "../lib/searchScore";
import { getBibleVerseIndex, type FlatVerse } from "../lib/bibleIndex";
import { useDebounced } from "../hooks/useDebounced";
import HighlightedText from "./HighlightedText";
import Icon from "./Icon";

interface BibleBrowserProps {
  bibles: Record<BibleKey, Bible | null>;
  loaded: boolean;
  onShowChapter: (
    verses: BibleVerse[],
    bookName: string,
    chapter: number,
    bibleName: string,
    autoSelectVerseIdx?: number,
  ) => void;
}

const formatBookName = (name: string) =>
  /^\d/.test(name) ? name : `Ks. ${name}`;

export default function BibleBrowser({
  bibles,
  loaded,
  onShowChapter,
}: BibleBrowserProps) {
  const [activeBible, setActiveBible] = useState<BibleKey>("gdanska");
  const [openBookIdx, setOpenBookIdx] = useState<number | null>(null);
  const [activeChapter, setActiveChapter] = useState<{
    bookIdx: number;
    chapterIdx: number;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedTerm = useDebounced(searchTerm, 150);

  const bible = bibles[activeBible];
  const totalBooks = bible ? getTotalBookCount(bible) : 0;

  const openBook = useMemo(() => {
    if (!bible || openBookIdx === null) return null;
    return getBookByFlatIndex(bible, openBookIdx);
  }, [bible, openBookIdx]);

  /**
   * Plochý seznam VŠECH veršů pro vyhledávání. Module-level cache —
   * pokud byl tento bible-key prebuildnutý při startu, je tahle call instant.
   */
  const allVerses = useMemo<FlatVerse[]>(() => {
    if (!bible) return [];
    return getBibleVerseIndex(bible, activeBible);
  }, [bible, activeBible]);

  const tokens = useMemo(() => {
    const norm = normalizeSearch(debouncedTerm);
    return norm ? norm.split(" ").filter(Boolean) : [];
  }, [debouncedTerm]);

  /** Vyfiltrované verše se skórem (max 200). Sortění by max-score-per-book. */
  const searchResults = useMemo<{ v: FlatVerse; score: number }[]>(() => {
    if (tokens.length === 0) return [];
    const out: { v: FlatVerse; score: number }[] = [];
    for (const v of allVerses) {
      if (tokens.every((t) => v.searchIndex.includes(t))) {
        out.push({ v, score: scoreTokens(v.searchIndex, tokens) });
        if (out.length >= 200) break;
      }
    }
    return out;
  }, [tokens, allVerses]);

  /**
   * Výsledky seskupené podle knihy — group sortění by maxScore desc
   * (nejrelevantnější knihy nahoře). Uvnitř group zachováme doc-order (bible čtení).
   */
  const groupedResults = useMemo(() => {
    const map = new Map<
      string,
      { bookName: string; verses: FlatVerse[]; maxScore: number }
    >();
    for (const { v, score } of searchResults) {
      let g = map.get(v.bookDisplayName);
      if (!g) {
        g = { bookName: v.bookDisplayName, verses: [], maxScore: 0 };
        map.set(v.bookDisplayName, g);
      }
      g.verses.push(v);
      if (score > g.maxScore) g.maxScore = score;
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => b.maxScore - a.maxScore);
    return arr;
  }, [searchResults]);

  // Vázat na okamžitý searchTerm — UI přepne do search módu hned,
  // i když výsledky čekají na debounce.
  const isSearching = normalizeSearch(searchTerm).length > 0;

  const toggleBook = (idx: number) => {
    setOpenBookIdx((prev) => (prev === idx ? null : idx));
  };

  const handleChapterClick = (bookIdx: number, chapterIdx: number) => {
    if (!bible) return;
    const bookRef = getBookByFlatIndex(bible, bookIdx);
    if (!bookRef) return;
    const chapter = (bookRef.book.Chapters || [])[chapterIdx];
    if (!chapter) return;
    setActiveChapter({ bookIdx, chapterIdx });
    onShowChapter(
      chapter.Verses || [],
      formatBookName(stripBookAlias(getBookName(activeBible, bookIdx))),
      chapterIdx + 1,
      BIBLE_LABELS[activeBible],
    );
  };

  const handleSearchResultClick = (v: FlatVerse) => {
    setActiveChapter({ bookIdx: v.bookFlatIdx, chapterIdx: v.chapterIdx });
    onShowChapter(
      v.chapterVerses,
      v.bookReferenceName,
      v.chapterIdx + 1,
      BIBLE_LABELS[activeBible],
      v.verseIdx,
    );
  };

  if (!loaded) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm">
        Loading Bibles...
      </div>
    );
  }

  if (!bible) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm">
        Failed to load Bibles
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      {/* Bible picker */}
      <div className="shrink-0 px-2 pt-2">
        <select
          value={activeBible}
          onChange={(e) => {
            setActiveBible(e.target.value as BibleKey);
            setOpenBookIdx(null);
            setActiveChapter(null);
          }}
          className="w-full px-2 py-1 text-xs border border-border-secondary rounded bg-surface text-text-primary"
        >
          {(Object.keys(BIBLE_LABELS) as BibleKey[]).map((b) => (
            <option key={b} value={b} disabled={!bibles[b]}>
              {BIBLE_LABELS[b]}
              {!bibles[b] ? " (unavailable)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="shrink-0 px-2 pt-1">
        <input
          type="text"
          placeholder="Search verses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-border-secondary rounded focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary placeholder-text-muted"
        />
      </div>

      {/* Result count when searching */}
      {isSearching && (
        <div className="shrink-0 px-2 pt-1 text-[10px] text-text-muted">
          Results: {searchResults.length}
          {searchResults.length === 200 ? "+" : ""}
        </div>
      )}

      {/* Content: search results OR tree */}
      <div className="flex-1 overflow-y-auto px-2 pt-2 pb-2 mt-1">
        {isSearching ? (
          <div>
            {searchResults.length === 0 && (
              <p className="text-text-muted text-xs text-center py-2">
                No results
              </p>
            )}
            {groupedResults.map((group, gIdx) => (
              <div key={gIdx} className="mb-2">
                <h2 className="text-xs font-semibold text-text-primary px-2 py-0.5 bg-surface">
                  {group.bookName} ({group.verses.length})
                </h2>
                <div className="space-y-0.5">
                  {group.verses.map((v) => {
                    const hl = highlightSnippet(v.text, tokens, {
                      snippetLen: 240,
                      before: 40,
                    });
                    return (
                      <div
                        key={`${v.bookFlatIdx}-${v.chapterIdx}-${v.verseIdx}`}
                        onClick={() => handleSearchResultClick(v)}
                        className="flex items-start gap-3 px-2 py-1 bg-surface-secondary rounded border border-border hover:bg-border transition-colors cursor-pointer"
                      >
                        <span className="text-xs font-semibold text-primary shrink-0 pt-0.5">
                          {v.chapterIdx + 1}:{v.verseId}
                        </span>
                        <span className="text-xs text-text-secondary flex-1 min-w-0 line-clamp-3 leading-snug">
                          <HighlightedText result={hl} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {searchResults.length === 200 && (
              <p className="text-text-muted text-xs text-center py-2">
                (showing first 200 results)
              </p>
            )}
          </div>
        ) : (
          <div>
            {Array.from({ length: totalBooks }, (_, bIdx) => {
              const isBookOpen = openBookIdx === bIdx;
              const chapters =
                isBookOpen && openBook ? openBook.book.Chapters || [] : [];

              return (
                <div key={bIdx}>
                  <button
                    onClick={() => toggleBook(bIdx)}
                    className={`w-full flex items-center gap-2 px-2 py-0.5 rounded transition-colors text-left ${
                      isBookOpen
                        ? "bg-surface-secondary text-primary"
                        : "text-text-secondary hover:bg-surface-secondary/50"
                    }`}
                  >
                    <Icon
                      name={isBookOpen ? "ChevronDown" : "ChevronRight"}
                      size={12}
                    />
                    <span className="text-xs font-semibold">
                      {getBookName(activeBible, bIdx)}
                    </span>
                  </button>

                  {isBookOpen && (
                    <div className="ml-3 mt-0.5 mb-1 flex flex-wrap gap-1 border-l border-border pl-2">
                      {chapters.map((_, cIdx) => {
                        const isActive =
                          activeChapter?.bookIdx === bIdx &&
                          activeChapter?.chapterIdx === cIdx;
                        return (
                          <button
                            key={cIdx}
                            onClick={() => handleChapterClick(bIdx, cIdx)}
                            className={`min-w-7 px-2 py-0.5 rounded text-xs transition-colors text-center ${
                              isActive
                                ? "bg-primary text-white"
                                : "text-text-secondary hover:bg-surface-secondary/50"
                            }`}
                          >
                            {cIdx + 1}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
