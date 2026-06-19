"use client";

import { useMemo, useState } from "react";
import type { ApiItem, SongBookKey } from "../lib/types";
import { normalizeSearch } from "../lib/textUtils";
import { highlightSnippet, type HighlightResult } from "../lib/searchHighlight";
import { scoreTokens } from "../lib/searchScore";
import { useDebounced } from "../hooks/useDebounced";
import { SONGBOOKS } from "../hooks/useSongbooks";
import Icon from "./Icon";
import SongListRow from "./SongListRow";

interface SongbooksTreeProps {
  /** Per-songbook ApiItem[] map. */
  dataByBook: Record<SongBookKey, ApiItem[]>;
  selectedItems: ApiItem[];
  onShow: (item: ApiItem) => void;
  onSelect: (item: ApiItem) => void;
}

export default function SongbooksTree({
  dataByBook,
  selectedItems,
  onShow,
  onSelect,
}: SongbooksTreeProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [openBook, setOpenBook] = useState<SongBookKey | null>(null);
  const debouncedTerm = useDebounced(searchTerm, 150);

  const isSelected = (item: ApiItem) =>
    selectedItems.some(
      (i) => i.id === item.id && i.source === item.source,
    );

  const tokens = useMemo(() => {
    const norm = normalizeSearch(debouncedTerm);
    return norm ? norm.split(" ").filter(Boolean) : [];
  }, [debouncedTerm]);

  // Vázat na okamžitý searchTerm — UI ihned přepne do search módu.
  const isSearching = normalizeSearch(searchTerm).length > 0;

  /**
   * Filtrované songbooky. Při searchi:
   * - Filtr přes searchIndex.includes všech tokenů
   * - Score per píseň (count matched chars) — sort items desc
   * - Předpočítané highlighty (title + body) — render je jen JSX,
   *   žádný highlightSnippet na hot pathu
   * - Cap MAX_RESULTS_PER_BOOK aby pro běžná slova nesplodit stovky pills
   */
  const MAX_RESULTS_PER_BOOK = 200;
  type Row = { item: ApiItem; titleHl?: HighlightResult; bodyHl?: HighlightResult };
  const filteredByBook = useMemo(() => {
    const out: { key: SongBookKey; label: string; rows: Row[]; truncated: boolean }[] = [];
    for (const b of SONGBOOKS) {
      const items = dataByBook[b.key] || [];
      if (tokens.length === 0) {
        out.push({
          key: b.key,
          label: b.label,
          rows: items.map((item) => ({ item })),
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
          titleHl: highlightSnippet(item.text, tokens, { snippetLen: 0 }),
          bodyHl: highlightSnippet(item.fullText, tokens, {
            snippetLen: 200,
            before: 50,
          }),
        }));
        out.push({ key: b.key, label: b.label, rows, truncated });
      }
    }
    return out;
  }, [dataByBook, tokens]);

  const totalResults = filteredByBook.reduce((s, b) => s + b.rows.length, 0);

  const toggleBook = (key: SongBookKey) => {
    setOpenBook((prev) => (prev === key ? null : key));
  };

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      {/* Search */}
      <div className="shrink-0 pt-2 px-2">
        <input
          type="text"
          placeholder="Search all songbooks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-border-secondary rounded focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary placeholder-text-muted"
        />
      </div>

      {isSearching && (
        <div className="shrink-0 px-2 pt-1 text-[10px] text-text-muted">
          Results: {totalResults}
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-2 pt-2 pb-2 mt-1">
        <div>
          {filteredByBook.map((book) => {
            // Při hledání rozbalujeme všechny skupiny s match, jinak respektujeme openBook
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
