"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ApiItem, SongBookKey } from "../lib/types";
import { normalizeSearch } from "../lib/textUtils";
import { highlightSnippet, type HighlightResult } from "../lib/searchHighlight";
import { scoreTokens } from "../lib/searchScore";
import { SONGBOOK_KEYS } from "../hooks/useSongbooks";
import Icon from "./Icon";
import SongListRow from "./SongListRow";

interface SongbooksTreeProps {
  dataByBook: Record<SongBookKey, ApiItem[]>;
  bookNames: Record<SongBookKey, string>;
  selectedItems: ApiItem[];
  onShow: (item: ApiItem) => void;
  onSelect: (item: ApiItem) => void;
}

export default function SongbooksTree({
  dataByBook,
  bookNames,
  selectedItems,
  onShow,
  onSelect,
}: SongbooksTreeProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [openBook, setOpenBook] = useState<SongBookKey | null>(null);
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

  const selectedKeys = useMemo(
    () => new Set(selectedItems.map((i) => `${i.source}:${i.id}`)),
    [selectedItems],
  );
  const isSelected = (item: ApiItem) =>
    selectedKeys.has(`${item.source}:${item.id}`);

  const tokens = useMemo(() => {
    const norm = normalizeSearch(deferredTerm);
    return norm ? norm.split(" ").filter(Boolean) : [];
  }, [deferredTerm]);

  const isSearching = normalizeSearch(deferredTerm).length > 0;

  const MAX_RESULTS_PER_BOOK = 50;
  type Row = { item: ApiItem; titleHl?: HighlightResult; bodyHl?: HighlightResult };
  const filteredByBook = useMemo(() => {
    const out: { key: SongBookKey; label: string; rows: Row[]; truncated: boolean }[] = [];
    for (const key of SONGBOOK_KEYS) {
      const items = dataByBook[key] || [];
      const label = bookNames[key];
      if (tokens.length === 0) {
        out.push({
          key,
          label,
          rows: items.map((item: ApiItem) => ({ item })),
          truncated: false,
        });
      } else {
        const scored: { item: ApiItem; score: number }[] = [];
        for (const i of items) {
          if (tokens.every((t) => i.searchIndex.includes(t))) {
            scored.push({ item: i, score: scoreTokens(i.searchIndex, tokens) });
          }
        }
        scored.sort((a, b) => b.score - a.score);
        const truncated = scored.length > MAX_RESULTS_PER_BOOK;
        const top = truncated ? scored.slice(0, MAX_RESULTS_PER_BOOK) : scored;
        const rows: Row[] = top.map(({ item }) => ({
          item,
          titleHl: highlightSnippet(item.title, tokens, { snippetLen: 0 }),
          bodyHl: highlightSnippet(item.fullText, tokens, {
            snippetLen: 200,
            before: 50,
          }),
        }));
        out.push({ key, label, rows, truncated });
      }
    }
    return out;
  }, [dataByBook, bookNames, tokens]);

  const totalResults = filteredByBook.reduce((s, b) => s + b.rows.length, 0);

  const toggleBook = (key: SongBookKey) => {
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
            className="w-full px-2 py-1 pr-7 text-xs border border-border-secondary rounded focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary placeholder-text-muted"
          />
          {isSearching && (
            <button
              onClick={clearSearch}
              title="Clear search (Esc)"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-colors"
            >
              <Icon name="X" size={12} />
            </button>
          )}
        </div>
      </div>

      {isSearching && (
        <div className="shrink-0 px-2 pt-1 text-[10px] text-text-muted">
          Results: {totalResults}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 pt-2 pb-2 mt-1">
        <div>
          {filteredByBook.map((book) => {
            const isOpen = isSearching ? book.rows.length > 0 : openBook === book.key;
            if (isSearching && book.rows.length === 0) return null;

            return (
              <div key={book.key} className="mb-1">
                <button
                  onClick={() => toggleBook(book.key)}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded transition-colors text-left ${
                    isOpen
                      ? "bg-surface-secondary text-primary"
                      : "text-text-secondary hover:bg-surface-secondary/50"
                  }`}
                >
                  <Icon
                    name={isOpen ? "ChevronDown" : "ChevronRight"}
                    size={12}
                  />
                  <span className="text-xs font-semibold">
                    {book.label} ({book.rows.length}{book.truncated ? "+" : ""})
                  </span>
                </button>

                {isOpen && (
                  <div className="ml-3 mt-0.5 mb-1 border-l border-border pl-2 space-y-0.5">
                    {book.rows.map((row, idx) => (
                      <SongListRow
                        key={`${row.item.source}-${row.item.id}-${idx}`}
                        item={row.item}
                        isSelected={isSelected(row.item)}
                        onShow={() => onShow(row.item)}
                        onSelect={() => onSelect(row.item)}
                        titleHl={row.titleHl}
                        bodyHl={row.bodyHl}
                      />
                    ))}
                    {book.truncated && (
                      <p className="text-text-muted text-[10px] text-center py-1">
                        (showing first {MAX_RESULTS_PER_BOOK} results)
                      </p>
                    )}
                    {book.rows.length === 0 && (
                      <p className="text-text-muted text-xs text-center py-1">
                        No results
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
