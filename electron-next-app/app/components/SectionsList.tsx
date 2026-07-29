"use client";

import { useEffect, useRef } from "react";
import type { ApiItem, SectionListItem } from "../lib/types";
import { getSongSections } from "../lib/songAdapter";

interface SectionsListProps {
  currentSong: ApiItem | null;
  activeSectionIndex: number;
  onGoToSection: (idx: number) => void;
}

export default function SectionsList({
  currentSong,
  activeSectionIndex,
  onGoToSection,
}: SectionsListProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const lastSongIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeSectionIndex < 0) return;
    const songChanged = lastSongIdRef.current !== (currentSong?.id ?? null);
    lastSongIdRef.current = currentSong?.id ?? null;
    activeRef.current?.scrollIntoView({
      block: songChanged ? "center" : "nearest",
      behavior: songChanged ? "auto" : "smooth",
    });
  }, [activeSectionIndex, currentSong?.id]);

  if (!currentSong) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        Pick a song, Bible chapter or message to begin.
      </div>
    );
  }

  return (
    <>
      <div className="shrink-0 flex items-center px-4 pt-3 pb-2">
        <h2 className="text-lg font-semibold text-text-primary">Sections</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div
          className={
            currentSong.isBible || currentSong.isMessage
              ? "space-y-0"
              : "space-y-0.5"
          }
        >
          {getSongSections(currentSong).map(
            (section: SectionListItem, idx: number) => {
              const isActive = idx === activeSectionIndex;
              const isBible = currentSong.isBible || currentSong.isMessage;
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
                        ? "border-transparent text-text-secondary hover:bg-surface-secondary/50"
                        : "bg-surface-secondary border-border text-text-secondary hover:bg-border"
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
                    {currentSong.isMessage ? (
                      <div
                        onWheel={(e) => e.stopPropagation()}
                        className={`text-xs whitespace-pre-wrap max-h-20 overflow-y-auto pr-1 ${
                          isActive ? "text-white" : "text-text-secondary"
                        }`}
                      >
                        {section.fullText}
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
            },
          )}
        </div>
      </div>
    </>
  );
}
