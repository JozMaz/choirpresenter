"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ApiItem, SongBookKey } from "../lib/types";
import { normalizeSearch } from "../lib/textUtils";
import { scoreItemsAsync } from "../lib/asyncSearch";
import { SONGBOOK_KEYS } from "../hooks/useSongbooks";
import Icon from "./Icon";
import SongListRow from "./SongListRow";

const MAX_SEARCH_RESULTS = 100;

interface SongbooksTreeProps {
  dataByBook: Record<SongBookKey, ApiItem[]>;
  bookNames: Record<SongBookKey, string>;
  selectedItems: ApiItem[];
  activeItem: ApiItem | null;
  onShow: (item: ApiItem) => void;
  onPlay: (item: ApiItem) => void;
  onSelect: (item: ApiItem) => void;
}

export default function SongbooksTree({
  dataByBook,
  bookNames,
  selectedItems,
  activeItem,
  onShow,
  onPlay,
  onSelect,
}: SongbooksTreeProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [openBook, setOpenBook] = useState<SongBookKey | null>(null);
  const deferredTerm = useDeferredValue(searchTerm);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const scheduleSearch = (value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSearchTerm(value), 120);
  };

  const clearSearch = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (inputRef.current) inputRef.current.value = "";
    setSearchTerm("");
  };

  const selectedKeys = useMemo(
    () => new Set(selectedItems.map((i) => `${i.source}:${i.id}`)),
    [selectedItems],
  );
  const isSelected = (item: ApiItem) =>
    selectedKeys.has(`${item.source}:${item.id}`);
  const isActive = (item: ApiItem) =>
    activeItem?.id === item.id && activeItem?.source === item.source;

  const tokens = useMemo(() => {
    const norm = normalizeSearch(deferredTerm);
    return norm ? norm.split(" ").filter(Boolean) : [];
  }, [deferredTerm]);

  const isSearching = normalizeSearch(deferredTerm).length > 0;

  const [searchResults, setSearchResults] = useState<
    { item: ApiItem; bookKey: SongBookKey; score: number }[]
  >([]);
  const [searchTotal, setSearchTotal] = useState(0);

  useEffect(() => {
    if (tokens.length === 0) {
      setSearchResults([]);
      setSearchTotal(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const all: { item: ApiItem; bookKey: SongBookKey; score: number }[] = [];
      for (const key of SONGBOOK_KEYS) {
        if ((dataByBook[key] || []).length === 0) continue;
        const scored = await scoreItemsAsync(
          dataByBook[key] || [],
          (i) => i.searchIndex,
          tokens,
          () => cancelled,
        );
        if (!scored) return;
        for (const { item, score } of scored) {
          all.push({ item, bookKey: key, score });
        }
      }
      all.sort((a, b) => b.score - a.score);
      startTransition(() => {
        if (cancelled) return;
        setSearchTotal(all.length);
        setSearchResults(all.slice(0, MAX_SEARCH_RESULTS));
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [tokens, dataByBook]);

  const groupedResults = useMemo(() => {
    const groups = new Map<
      SongBookKey,
      { key: SongBookKey; label: string; items: ApiItem[]; best: number }
    >();
    for (const { item, bookKey, score } of searchResults) {
      let group = groups.get(bookKey);
      if (!group) {
        group = { key: bookKey, label: bookNames[bookKey], items: [], best: 0 };
        groups.set(bookKey, group);
      }
      group.items.push(item);
      if (score > group.best) group.best = score;
    }
    return Array.from(groups.values()).sort((a, b) => b.best - a.best);
  }, [searchResults, bookNames]);

  const browseBooks = useMemo(
    () =>
      SONGBOOK_KEYS.map((key) => ({
        key,
        label: bookNames[key],
        items: dataByBook[key] || [],
      })).filter((book) => book.items.length > 0),
    [dataByBook, bookNames],
  );

  const visibleBooks = isSearching ? groupedResults : browseBooks;

  const [collapsedInSearch, setCollapsedInSearch] = useState<Set<SongBookKey>>(
    new Set(),
  );

  const tokenKey = tokens.join(" ");
  const [lastTokenKey, setLastTokenKey] = useState(tokenKey);
  if (tokenKey !== lastTokenKey) {
    setLastTokenKey(tokenKey);
    if (collapsedInSearch.size > 0) setCollapsedInSearch(new Set());
  }

  const isBookOpen = (key: SongBookKey) =>
    isSearching ? !collapsedInSearch.has(key) : openBook === key;

  const toggleBook = (key: SongBookKey) => {
    if (isSearching) {
      setCollapsedInSearch((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      return;
    }
    setOpenBook((prev) => (prev === key ? null : key));
  };

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="shrink-0 pt-2 px-2">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search all songbooks..."
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
          Results: {searchTotal}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 pt-2 pb-2 mt-1">
        <div>
          {visibleBooks.length === 0 && (
            <p className="text-text-muted text-xs text-center py-2">
              {isSearching
                ? "No results"
                : "No songbooks downloaded — pick some in Settings."}
            </p>
          )}
          {visibleBooks.map((book) => {
            const isOpen = isBookOpen(book.key);
            return (
              <div key={book.key} className="mb-1">
                <button
                  onClick={() => toggleBook(book.key)}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded transition-colors text-left ${
                    isOpen
                      ? "text-primary hover:bg-surface-hover"
                      : "text-text-primary hover:bg-surface-hover"
                  }`}
                >
                  <Icon
                    name={isOpen ? "ChevronDown" : "ChevronRight"}
                    size={12}
                  />
                  <span className="text-xs font-semibold">
                    {book.label} ({book.items.length})
                  </span>
                </button>

                {isOpen && (
                  <div className="ml-3 mt-0.5 mb-1 border-l border-border pl-2 space-y-0.5">
                    {book.items.map((item, idx) => (
                      <SongListRow
                        key={`${item.source}-${item.id}-${idx}`}
                        item={item}
                        isSelected={isSelected(item)}
                        isActive={isActive(item)}
                        onShow={() => onShow(item)}
                        onPlay={() => onPlay(item)}
                        onSelect={() => onSelect(item)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {isSearching && searchTotal > MAX_SEARCH_RESULTS && (
            <p className="text-text-muted text-[10px] text-center py-1">
              (showing first {MAX_SEARCH_RESULTS} results)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
