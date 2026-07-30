"use client";

import { useEffect, useRef } from "react";
import type { ApiItem, SectionType } from "../lib/types";

const TYPE_COLOR: Record<SectionType, string> = {
  verse: "bg-primary",
  chorus: "bg-success",
  bridge: "bg-amber-500",
  ending: "bg-purple-500",
};

interface SongChunksProps {
  currentSong: ApiItem;
  activeSlideIndex: number;
  onGoToSlide: (idx: number) => void;
}

export default function SongChunks({
  currentSong,
  activeSlideIndex,
  onGoToSlide,
}: SongChunksProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastSongIdRef = useRef<string | null>(null);

  useEffect(() => {
    const songChanged = lastSongIdRef.current !== currentSong.id;
    lastSongIdRef.current = currentSong.id;

    if (activeSlideIndex < 0) {
      if (songChanged) listRef.current?.scrollTo({ top: 0 });
      return;
    }
    activeRef.current?.scrollIntoView({
      block: songChanged ? "center" : "nearest",
      behavior: songChanged ? "auto" : "smooth",
    });
  }, [activeSlideIndex, currentSong.id]);

  return (
    <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
      <div className="space-y-2">
        {currentSong.sections.map((section, sIdx) => {
          const slideIndexes = Array.from(
            { length: section.slideCount },
            (_, i) => section.slideStart + i,
          );
          const sectionActive = slideIndexes.includes(activeSlideIndex);
          return (
            <div
              key={sIdx}
              className={`rounded-md border overflow-hidden ${
                sectionActive ? "border-primary/60" : "border-border"
              }`}
            >
              <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-secondary">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    TYPE_COLOR[section.type] ?? "bg-primary"
                  }`}
                />
                <span className="text-[11px] font-bold uppercase tracking-wide text-text-primary">
                  {section.label}
                </span>
                {section.slideCount > 1 && (
                  <span className="text-[10px] text-text-muted">
                    {section.slideCount} parts
                  </span>
                )}
              </div>
              <div className="p-1.5 space-y-1">
                {slideIndexes.map((slideIdx) => {
                  const slide = currentSong.slides[slideIdx];
                  const isActive = slideIdx === activeSlideIndex;
                  return (
                    <button
                      key={slideIdx}
                      ref={isActive ? activeRef : null}
                      onClick={() => onGoToSlide(slideIdx)}
                      className={`w-full text-left rounded border px-2 py-1.5 transition-colors ${
                        isActive
                          ? "bg-primary border-primary text-white"
                          : "bg-surface-secondary/50 border-border text-text-secondary hover:bg-surface-hover"
                      }`}
                    >
                      {slide.primary.map((line, i) => (
                        <div
                          key={i}
                          className={`text-xs leading-snug ${
                            isActive ? "text-white" : ""
                          }`}
                        >
                          {line}
                        </div>
                      ))}
                      {slide.secondary && slide.secondary.length > 0 && (
                        <div className="mt-0.5">
                          {slide.secondary.map((line, i) => (
                            <div
                              key={i}
                              className={`text-xs leading-snug italic ${
                                isActive ? "text-white/80" : "text-text-muted"
                              }`}
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
