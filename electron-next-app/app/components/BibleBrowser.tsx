"use client";

import {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { scoreItemsAsync } from "../lib/asyncSearch";
import { getBibleVerseIndex, type FlatVerse } from "../lib/bibleIndex";
import HighlightedText from "./HighlightedText";
import { bibleGroupTint } from "../lib/bibleGroups";
import Icon from "./Icon";
import Dropdown, { type DropdownOption } from "./Dropdown";

const VerseResultRow = memo(function VerseResultRow({
  v,
  tokens,
  onClick,
}: {
  v: FlatVerse;
  tokens: string[];
  onClick: (v: FlatVerse) => void;
}) {
  const hl = useMemo(
    () => highlightSnippet(v.text, tokens, { snippetLen: 240, before: 40 }),
    [v.text, tokens],
  );
  return (
    <div
      onClick={() => onClick(v)}
      className="flex items-start gap-2 px-2 py-0.5 bg-surface-secondary rounded border border-border hover:bg-surface-hover transition-colors cursor-pointer"
    >
      <span className="text-xs font-semibold text-primary shrink-0 pt-0.5">
        {v.chapterIdx + 1}:{v.verseId}
      </span>
      <span className="text-xs text-text-secondary flex-1 min-w-0 line-clamp-3 leading-snug">
        <HighlightedText result={hl} />
      </span>
    </div>
  );
});

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
  const deferredTerm = useDeferredValue(searchTerm);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const scheduleSearch = (value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSearchTerm(value), 120);
  };

  const clearSearch = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (inputRef.current) inputRef.current.value = "";
    setSearchTerm("");
  };

  const bible = bibles[activeBible];
  const totalBooks = bible ? getTotalBookCount(bible) : 0;

  const bibleOptions = useMemo<DropdownOption<BibleKey>[]>(
    () =>
      (Object.keys(BIBLE_LABELS) as BibleKey[]).map((b) => ({
        value: b,
        label: bibles[b] ? BIBLE_LABELS[b] : `${BIBLE_LABELS[b]} (unavailable)`,
        disabled: !bibles[b],
      })),
    [bibles],
  );

  const openBook = useMemo(() => {
    if (!bible || openBookIdx === null) return null;
    return getBookByFlatIndex(bible, openBookIdx);
  }, [bible, openBookIdx]);

  const allVerses = useMemo<FlatVerse[]>(() => {
    if (!bible) return [];
    return getBibleVerseIndex(bible, activeBible);
  }, [bible, activeBible]);

  const tokens = useMemo(() => {
    const norm = normalizeSearch(deferredTerm);
    return norm ? norm.split(" ").filter(Boolean) : [];
  }, [deferredTerm]);

  const [searchResults, setSearchResults] = useState<
    { v: FlatVerse; score: number }[]
  >([]);

  useEffect(() => {
    if (tokens.length === 0) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const scored = await scoreItemsAsync(
        allVerses,
        (v) => v.searchIndex,
        tokens,
        () => cancelled,
      );
      if (!scored) return;
      const top = scored.slice(0, 200).map(({ item, score }) => ({
        v: item,
        score,
      }));
      startTransition(() => {
        if (!cancelled) setSearchResults(top);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [tokens, allVerses]);

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

  const isSearching = normalizeSearch(deferredTerm).length > 0;

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
      stripBookAlias(getBookName(bookIdx)),
      chapterIdx + 1,
      BIBLE_LABELS[activeBible],
    );
  };

  const handleSearchResultClick = useCallback(
    (v: FlatVerse) => {
      setActiveChapter({ bookIdx: v.bookFlatIdx, chapterIdx: v.chapterIdx });
      onShowChapter(
        v.chapterVerses,
        v.bookReferenceName,
        v.chapterIdx + 1,
        BIBLE_LABELS[activeBible],
        v.verseIdx,
      );
    },
    [onShowChapter, activeBible],
  );

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
      <div className="shrink-0 px-2 pt-2">
        <Dropdown
          value={activeBible}
          options={bibleOptions}
          onChange={(b) => {
            setActiveBible(b);
            setOpenBookIdx(null);
            setActiveChapter(null);
          }}
        />
      </div>

      <div className="shrink-0 px-2 pt-1">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search verses..."
            defaultValue=""
            onChange={(e) => scheduleSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") clearSearch();
            }}
            className="w-full px-2 py-1 pr-7 text-xs border border-border-secondary rounded hover:border-primary/60 transition-colors focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary placeholder-text-muted"
          />
          {isSearching && (
            <button
              onClick={clearSearch}
              title="Clear search (Esc)"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <Icon name="X" size={12} />
            </button>
          )}
        </div>
      </div>

      {isSearching && (
        <div className="shrink-0 px-2 pt-1 text-[10px] text-text-muted">
          Results: {searchResults.length}
          {searchResults.length === 200 ? "+" : ""}
        </div>
      )}

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
                  {group.verses.map((v) => (
                    <VerseResultRow
                      key={`${v.bookFlatIdx}-${v.chapterIdx}-${v.verseIdx}`}
                      v={v}
                      tokens={tokens}
                      onClick={handleSearchResultClick}
                    />
                  ))}
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
                    style={bibleGroupTint(bIdx, isBookOpen)}
                    className={`w-full flex items-center gap-2 px-2 py-1 mb-0.5 rounded text-left border-l-4 border-l-(--tint-border) bg-(--tint) hover:bg-(--tint-hover) transition-colors ${
                      isBookOpen ? "text-primary" : "text-text-primary"
                    }`}
                  >
                    <Icon
                      name={isBookOpen ? "ChevronDown" : "ChevronRight"}
                      size={12}
                    />
                    <span className="text-xs font-semibold">
                      {getBookName(bIdx)}
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
                            className={`min-w-7 px-2 py-0.5 rounded text-xs text-center transition-colors ${
                              isActive
                                ? "bg-primary text-white hover:bg-primary-hover"
                                : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
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
