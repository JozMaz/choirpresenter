"use client";

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { buildSearchIndex, normalizeSearch } from "../lib/textUtils";
import { highlightSnippet } from "../lib/searchHighlight";
import { scoreMatch } from "../lib/searchScore";
import { scoreItemsAsync } from "../lib/asyncSearch";
import {
  getCachedTitles,
  getMessageChunkIndex,
  messageDateYear,
  type ChunkRow,
} from "../lib/messageIndex";
import type { MessageTitlesEntry } from "../lib/types";
import { useDebounced } from "../hooks/useDebounced";
import HighlightedText from "./HighlightedText";
import Icon from "./Icon";

interface TitleResult {
  kind: "title";
  date: string;
  title: string;
  altTitles: string[];
  hasText: boolean;
}

interface ChunkResult {
  kind: "chunk";
  date: string;
  title: string;
  chunkIdx: number;
  pnum: number;
  text: string;
}

type SearchResult = TitleResult | ChunkResult;

interface MessagesBrowserProps {
  activeDateKey?: string | null;
  onShowMessage?: (date: string, title: string, chunkIdx?: number) => void;
}

const MAX_RESULTS = 200;

const inputClass =
  "w-full px-2 py-1 pr-7 text-xs border border-border-secondary rounded hover:border-primary/60 transition-colors focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary placeholder-text-muted";

const clearButtonClass =
  "absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors";

function countUppercase(s: string): number {
  return (s.match(/\p{Lu}/gu) ?? []).length;
}

const MessageTitleRow = memo(function MessageTitleRow({
  row,
  tokens,
  label,
  isActive,
  onClick,
}: {
  row: TitleResult;
  tokens: string[];
  label?: string;
  isActive: boolean;
  onClick: (r: TitleResult) => void;
}) {
  const titleHl = useMemo(
    () => highlightSnippet(row.title, tokens, { snippetLen: 0 }),
    [row.title, tokens],
  );
  const dateHl = useMemo(
    () =>
      label === undefined
        ? highlightSnippet(row.date, tokens, { snippetLen: 0 })
        : null,
    [row.date, tokens, label],
  );
  return (
    <div
      onClick={() => onClick(row)}
      title={
        !row.hasText
          ? "Text not available"
          : row.altTitles.length > 0
            ? row.altTitles.join(" / ")
            : undefined
      }
      className={`flex items-center gap-2 px-2 py-0.5 rounded border transition-colors ${
        !row.hasText
          ? "bg-surface-secondary/40 border-border/40 cursor-not-allowed opacity-50"
          : isActive
            ? "bg-primary/20 border-primary cursor-pointer"
            : "bg-surface-secondary border-border hover:bg-surface-hover cursor-pointer"
      }`}
    >
      <span className="text-xs font-semibold text-primary shrink-0">
        {dateHl ? (
          <HighlightedText result={dateHl} fallback={row.date} />
        ) : (
          label
        )}
      </span>
      <span className="text-xs text-text-secondary truncate flex-1 min-w-0">
        <HighlightedText result={titleHl} fallback={row.title} />
      </span>
    </div>
  );
});

const ChunkResultRow = memo(function ChunkResultRow({
  result,
  tokens,
  onClick,
}: {
  result: ChunkResult;
  tokens: string[];
  onClick: (r: ChunkResult) => void;
}) {
  const hl = useMemo(
    () => highlightSnippet(result.text, tokens),
    [result.text, tokens],
  );
  return (
    <div
      onClick={() => onClick(result)}
      className="flex items-start gap-3 px-2 py-1 bg-surface-secondary rounded border border-border hover:bg-surface-hover transition-colors cursor-pointer"
    >
      <span className="text-xs font-semibold text-primary shrink-0 pt-0.5">
        par.{result.pnum}
      </span>
      <span className="text-xs text-text-secondary flex-1 min-w-0 line-clamp-3 leading-snug">
        {hl.prefix}
        {hl.segments.map((s, i) =>
          s.hit ? (
            <mark
              key={i}
              className="bg-primary/30 text-text-primary rounded px-0.5"
            >
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
        {hl.suffix}
      </span>
    </div>
  );
});

export default function MessagesBrowser({
  activeDateKey,
  onShowMessage,
}: MessagesBrowserProps) {
  const [titleTerm, setTitleTerm] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedTitleTerm = useDebounced(titleTerm, 150);
  const debouncedTerm = useDebounced(searchTerm, 150);

  const [titlesData, setTitlesData] = useState<MessageTitlesEntry[]>(
    () => getCachedTitles() ?? [],
  );
  const [allChunkRows, setAllChunkRows] = useState<ChunkRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const chunks = await getMessageChunkIndex();
      if (cancelled) return;
      setAllChunkRows(chunks);
      const titles = getCachedTitles();
      if (titles) setTitlesData(titles);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allTitleRows = useMemo<TitleResult[]>(() => {
    const datesWithText = new Set(allChunkRows.map((r) => r.date));
    const list: TitleResult[] = [];
    for (const entry of titlesData) {
      const hasText = datesWithText.size === 0 || datesWithText.has(entry.date);
      const byKey = new Map<string, string>();
      for (const t of entry.titles) {
        const trimmed = t.title.trim();
        if (!trimmed) continue;
        const key = trimmed.toLocaleLowerCase();
        const prev = byKey.get(key);
        if (!prev || countUppercase(trimmed) < countUppercase(prev)) {
          byKey.set(key, trimmed);
        }
      }
      const titles = Array.from(byKey.values());
      if (titles.length === 0) continue;
      list.push({
        kind: "title",
        date: entry.date,
        title: titles[0],
        altTitles: titles.slice(1),
        hasText,
      });
    }
    return list;
  }, [titlesData, allChunkRows]);

  const titleIndex = useMemo(
    () =>
      allTitleRows.map((t) =>
        buildSearchIndex(
          `${t.date} ${messageDateYear(t.date)} ${t.title} ${t.altTitles.join(" ")}`,
        ),
      ),
    [allTitleRows],
  );

  const tokens = useMemo(() => {
    const norm = normalizeSearch(debouncedTerm);
    return norm ? norm.split(" ").filter(Boolean) : [];
  }, [debouncedTerm]);

  const titleTokens = useMemo(() => {
    const norm = normalizeSearch(debouncedTitleTerm);
    return norm ? norm.split(" ").filter(Boolean) : [];
  }, [debouncedTitleTerm]);

  const isSearching = normalizeSearch(searchTerm).length > 0;
  const isTitleFiltering = normalizeSearch(titleTerm).length > 0;

  const titleMatches = useMemo(() => {
    if (titleTokens.length === 0) return allTitleRows;
    const scored: { row: TitleResult; score: number }[] = [];
    for (let i = 0; i < allTitleRows.length; i++) {
      const score = scoreMatch(titleIndex[i], titleTokens);
      if (score > 0) scored.push({ row: allTitleRows[i], score });
    }
    scored.sort(
      (a, b) => b.score - a.score || a.row.date.localeCompare(b.row.date),
    );
    return scored.map((s) => s.row);
  }, [titleTokens, allTitleRows, titleIndex]);

  const allowedDates = useMemo(
    () =>
      titleTokens.length === 0
        ? null
        : new Set(titleMatches.map((r) => r.date)),
    [titleTokens, titleMatches],
  );

  const searchChunkRows = useMemo(
    () =>
      allowedDates
        ? allChunkRows.filter((r) => allowedDates.has(r.date))
        : allChunkRows,
    [allChunkRows, allowedDates],
  );

  const [searchResults, setSearchResults] = useState<
    { result: SearchResult; score: number }[]
  >([]);

  useEffect(() => {
    if (tokens.length === 0) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const out: { result: SearchResult; score: number }[] = [];
      for (let i = 0; i < allTitleRows.length; i++) {
        if (allowedDates && !allowedDates.has(allTitleRows[i].date)) continue;
        const score = scoreMatch(titleIndex[i], tokens);
        if (score > 0) out.push({ result: allTitleRows[i], score });
      }

      const chunkScored = await scoreItemsAsync(
        searchChunkRows,
        (r) => r.idx,
        tokens,
        () => cancelled,
      );
      if (!chunkScored) return;

      for (const { item, score } of chunkScored) {
        out.push({
          result: {
            kind: "chunk",
            date: item.date,
            title: item.title,
            chunkIdx: item.chunkIdx,
            pnum: item.pnum,
            text: item.text,
          },
          score,
        });
      }

      out.sort((a, b) => b.score - a.score);
      const top = out.slice(0, MAX_RESULTS);
      startTransition(() => {
        if (!cancelled) setSearchResults(top);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [tokens, allTitleRows, titleIndex, searchChunkRows, allowedDates]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { date: string; title: string; results: SearchResult[]; maxScore: number }
    >();
    for (const { result, score } of searchResults) {
      const key = result.date;
      let g = map.get(key);
      if (!g) {
        g = {
          date: result.date,
          title: result.title,
          results: [],
          maxScore: 0,
        };
        map.set(key, g);
      }
      g.results.push(result);
      if (score > g.maxScore) g.maxScore = score;
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => b.maxScore - a.maxScore || a.date.localeCompare(b.date));
    return arr;
  }, [searchResults]);

  const handleTitleClick = useCallback(
    (r: TitleResult) => {
      if (!r.hasText) return;
      onShowMessage?.(r.date, r.title);
    },
    [onShowMessage],
  );

  const handleChunkClick = useCallback(
    (r: ChunkResult) => {
      onShowMessage?.(r.date, r.title, r.chunkIdx);
    },
    [onShowMessage],
  );

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="shrink-0 px-2 pt-2 space-y-1">
        <div className="relative">
          <input
            type="text"
            placeholder="Title or year..."
            value={titleTerm}
            onChange={(e) => setTitleTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setTitleTerm("");
            }}
            className={inputClass}
          />
          {titleTerm && (
            <button
              onClick={() => setTitleTerm("")}
              title="Clear title search (Esc)"
              className={clearButtonClass}
            >
              <Icon name="X" size={12} />
            </button>
          )}
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search full text..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchTerm("");
            }}
            className={inputClass}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              title="Clear full-text search (Esc)"
              className={clearButtonClass}
            >
              <Icon name="X" size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="shrink-0 px-2 pt-1 text-[10px] text-text-muted">
        {isSearching
          ? `Results: ${searchResults.length}${
              searchResults.length === MAX_RESULTS ? "+" : ""
            }${isTitleFiltering ? ` in ${titleMatches.length} messages` : ""}`
          : isTitleFiltering
            ? `Messages: ${titleMatches.length} of ${allTitleRows.length}`
            : `Messages: ${allTitleRows.length}`}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pt-2 pb-2 mt-1">
        {!isSearching && (
          <div className="space-y-0.5">
            {isTitleFiltering && titleMatches.length === 0 && (
              <p className="text-text-muted text-xs text-center py-2">
                No titles match
              </p>
            )}
            {titleMatches.map((m) => (
              <MessageTitleRow
                key={m.date}
                row={m}
                tokens={titleTokens}
                isActive={m.date === activeDateKey}
                onClick={handleTitleClick}
              />
            ))}
          </div>
        )}

        {isSearching && (
          <div>
            {grouped.length === 0 && (
              <p className="text-text-muted text-xs text-center py-2">
                No results
              </p>
            )}
            {grouped.map((group, gIdx) => (
              <div key={gIdx} className="mb-2">
                <h2 className="text-xs font-semibold text-text-primary px-2 py-0.5 bg-surface">
                  {group.date} — {group.title} ({group.results.length})
                </h2>
                <div className="space-y-0.5">
                  {group.results.map((r, rIdx) => {
                    if (r.kind === "title") {
                      return (
                        <MessageTitleRow
                          key={`t-${rIdx}`}
                          row={r}
                          tokens={tokens}
                          label="title"
                          isActive={r.date === activeDateKey}
                          onClick={handleTitleClick}
                        />
                      );
                    }
                    return (
                      <ChunkResultRow
                        key={`c-${rIdx}`}
                        result={r}
                        tokens={tokens}
                        onClick={handleChunkClick}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
