"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiItem, SectionListItem } from "../lib/types";
import { getSongSections } from "../lib/songAdapter";
import { normalizeSearch } from "../lib/textUtils";
import { highlightSnippet, type HighlightResult } from "../lib/searchHighlight";
import { useDebounced } from "../hooks/useDebounced";
import Icon from "./Icon";

const floatingNavClass =
  "w-8 h-8 flex items-center justify-center rounded-full bg-surface-secondary/90 backdrop-blur-sm border border-border-secondary text-text-secondary shadow-md transition-colors enabled:hover:bg-primary enabled:hover:text-white enabled:hover:border-primary disabled:opacity-40";

interface SectionsListProps {
  currentSong: ApiItem | null;
  activeSectionIndex: number;
  onGoToSection: (idx: number) => void;
}

function HighlightedSectionText({
  hl,
  firstHit,
  currentHit,
}: {
  hl: HighlightResult;
  firstHit: number;
  currentHit: number;
}) {
  let hitIdx = -1;
  return (
    <>
      {hl.segments.map((seg, i) => {
        if (!seg.hit) return <span key={i}>{seg.text}</span>;
        hitIdx++;
        const ordinal = firstHit + hitIdx;
        return (
          <mark
            key={i}
            data-hit={ordinal}
            className={`rounded px-0.5 ${
              ordinal === currentHit
                ? "bg-amber-400 text-black font-semibold"
                : "bg-primary/30 text-text-primary"
            }`}
          >
            {seg.text}
          </mark>
        );
      })}
    </>
  );
}

export default function SectionsList({
  currentSong,
  activeSectionIndex,
  onGoToSection,
}: SectionsListProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastSongIdRef = useRef<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentHit, setCurrentHit] = useState(0);
  const debouncedTerm = useDebounced(searchTerm, 150);

  const isMessage = !!currentSong?.isMessage;

  const sections = useMemo<SectionListItem[]>(
    () => (currentSong ? getSongSections(currentSong) : []),
    [currentSong],
  );

  const tokens = useMemo(() => {
    if (!isMessage) return [];
    const norm = normalizeSearch(debouncedTerm);
    return norm ? [norm] : [];
  }, [debouncedTerm, isMessage]);

  const { highlights, hitOffsets, totalHits } = useMemo(() => {
    if (tokens.length === 0) {
      return { highlights: null, hitOffsets: [], totalHits: 0 };
    }
    const hls = sections.map((s) =>
      highlightSnippet(s.fullText, tokens, { snippetLen: 0 }),
    );
    const offsets: number[] = [];
    let running = 0;
    for (const hl of hls) {
      offsets.push(running);
      running += hl.segments.filter((s) => s.hit).length;
    }
    return { highlights: hls, hitOffsets: offsets, totalHits: running };
  }, [sections, tokens]);

  const songId = currentSong?.id ?? null;
  const [lastSongId, setLastSongId] = useState(songId);
  if (songId !== lastSongId) {
    setLastSongId(songId);
    setSearchTerm("");
    setCurrentHit(0);
  }

  const tokenKey = tokens.join(" ");
  const [lastTokenKey, setLastTokenKey] = useState(tokenKey);
  if (tokenKey !== lastTokenKey) {
    setLastTokenKey(tokenKey);
    setCurrentHit(0);
  }

  useEffect(() => {
    if (totalHits === 0) return;
    const el = listRef.current?.querySelector(`[data-hit="${currentHit}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentHit, totalHits, tokenKey]);

  useEffect(() => {
    const songChanged = lastSongIdRef.current !== (currentSong?.id ?? null);
    lastSongIdRef.current = currentSong?.id ?? null;

    if (activeSectionIndex < 0) {
      if (songChanged) listRef.current?.scrollTo({ top: 0 });
      return;
    }
    activeRef.current?.scrollIntoView({
      block: songChanged ? "center" : "nearest",
      behavior: songChanged ? "auto" : "smooth",
    });
  }, [activeSectionIndex, currentSong?.id]);

  const [scrollNav, setScrollNav] = useState({
    canScrollUp: false,
    canScrollDown: false,
    activeOffScreen: false,
  });

  const syncScrollNav = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const canScrollUp = el.scrollTop > 24;
    const canScrollDown = el.scrollTop + el.clientHeight < el.scrollHeight - 24;
    let activeOffScreen = false;
    const active = activeRef.current;
    if (active) {
      const list = el.getBoundingClientRect();
      const row = active.getBoundingClientRect();
      activeOffScreen = row.bottom < list.top || row.top > list.bottom;
    }
    setScrollNav((prev) =>
      prev.canScrollUp === canScrollUp &&
      prev.canScrollDown === canScrollDown &&
      prev.activeOffScreen === activeOffScreen
        ? prev
        : { canScrollUp, canScrollDown, activeOffScreen },
    );
  }, []);

  useEffect(() => {
    syncScrollNav();
  }, [syncScrollNav, sections, activeSectionIndex, tokenKey, currentHit]);

  const scrollListTo = (top: number) => {
    listRef.current?.scrollTo({ top, behavior: "smooth" });
  };

  const stepHit = (delta: number) => {
    if (totalHits === 0) return;
    setCurrentHit((prev) => (prev + delta + totalHits) % totalHits);
  };

  return (
    <>
      {!currentSong && (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          Pick a song, Bible chapter or message to begin.
        </div>
      )}

      {isMessage && (
        <div className="shrink-0 flex items-center gap-1 px-4 pb-2">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              placeholder="Find in this message..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchTerm("");
                if (e.key === "Enter") stepHit(e.shiftKey ? -1 : 1);
              }}
              className="w-full px-2 py-1 pr-14 text-xs border border-border-secondary rounded hover:border-primary/60 transition-colors focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary placeholder-text-muted"
            />
            {tokens.length > 0 && (
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] text-text-muted tabular-nums">
                {totalHits === 0 ? "0/0" : `${currentHit + 1}/${totalHits}`}
              </span>
            )}
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                title="Clear (Esc)"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
              >
                <Icon name="X" size={12} />
              </button>
            )}
          </div>
          <button
            onClick={() => stepHit(-1)}
            disabled={totalHits === 0}
            title="Previous match (Shift+Enter)"
            className="w-6 h-6 shrink-0 flex items-center justify-center rounded border border-border-secondary text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-40 transition-colors"
          >
            <Icon name="ChevronUp" size={12} />
          </button>
          <button
            onClick={() => stepHit(1)}
            disabled={totalHits === 0}
            title="Next match (Enter)"
            className="w-6 h-6 shrink-0 flex items-center justify-center rounded border border-border-secondary text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-40 transition-colors"
          >
            <Icon name="ChevronDown" size={12} />
          </button>
        </div>
      )}

      {currentSong && (
        <div className="flex-1 min-h-0 relative">
          <div
            ref={listRef}
            onScroll={syncScrollNav}
            className="h-full overflow-y-auto px-4 pb-4"
          >
            <div
              className={
                currentSong.isBible || currentSong.isMessage
                  ? "space-y-0"
                  : "space-y-0.5"
              }
            >
              {sections.map((section: SectionListItem, idx: number) => {
                const isActive = idx === activeSectionIndex;
                const isBible = currentSong.isBible || currentSong.isMessage;
                const hl = highlights?.[idx];
                return (
                  <button
                    key={idx}
                    ref={isActive ? activeRef : null}
                    onClick={() => onGoToSection(idx)}
                    className={`w-full text-left rounded border transition-colors flex items-start ${
                      isBible ? "px-2 py-0.5 gap-1.5" : "px-2 py-1 gap-2"
                    } ${
                      isActive
                        ? "bg-primary border-primary text-white"
                        : isBible
                          ? "border-transparent text-text-secondary hover:bg-surface-hover"
                          : "bg-surface-secondary border-border text-text-secondary hover:bg-surface-hover"
                    }`}
                  >
                    {section.label && (
                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          isBible ? "min-w-5" : "w-16 pt-0.5"
                        } ${isActive ? "text-white" : "text-text-primary"}`}
                      >
                        {section.label}
                      </span>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col">
                      {currentSong.isMessage || currentSong.isBible ? (
                        <div
                          className={`text-xs whitespace-pre-wrap ${
                            isActive ? "text-white" : "text-text-secondary"
                          }`}
                        >
                          {hl ? (
                            <HighlightedSectionText
                              hl={hl}
                              firstHit={hitOffsets[idx]}
                              currentHit={currentHit}
                            />
                          ) : (
                            section.fullText
                          )}
                        </div>
                      ) : (
                        <>
                          {section.previewPrimary && (
                            <span
                              className={`text-xs truncate ${
                                isActive ? "text-white" : "text-text-secondary"
                              }`}
                            >
                              {section.previewPrimary}
                            </span>
                          )}
                          {section.previewPrimary2 && (
                            <span
                              className={`text-xs truncate ${
                                isActive ? "text-white" : "text-text-secondary"
                              }`}
                            >
                              {section.previewPrimary2}
                            </span>
                          )}
                          {section.previewSecondary && (
                            <span
                              className={`text-xs truncate italic ${
                                isActive ? "text-white/80" : "text-text-muted"
                              }`}
                            >
                              {section.previewSecondary}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {isMessage && (
            <div className="absolute right-3 bottom-3 flex flex-col gap-1.5">
              <button
                onClick={() => scrollListTo(0)}
                disabled={!scrollNav.canScrollUp}
                title={
                  scrollNav.canScrollUp
                    ? "Jump to the top"
                    : "Already at the top"
                }
                className={floatingNavClass}
              >
                <Icon name="ArrowUp" size={14} />
              </button>
              <button
                onClick={() =>
                  activeRef.current?.scrollIntoView({
                    block: "center",
                    behavior: "smooth",
                  })
                }
                disabled={!scrollNav.activeOffScreen}
                title={
                  scrollNav.activeOffScreen
                    ? "Jump to the current chunk"
                    : activeSectionIndex < 0
                      ? "Nothing is live yet"
                      : "The current chunk is already visible"
                }
                className={floatingNavClass}
              >
                <Icon name="CircleDot" size={14} />
              </button>
              <button
                onClick={() => scrollListTo(listRef.current?.scrollHeight ?? 0)}
                disabled={!scrollNav.canScrollDown}
                title={
                  scrollNav.canScrollDown
                    ? "Jump to the bottom"
                    : "Already at the bottom"
                }
                className={floatingNavClass}
              >
                <Icon name="ArrowDown" size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
