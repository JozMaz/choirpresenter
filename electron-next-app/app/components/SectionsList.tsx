"use client";

import { useEffect, useRef } from "react";
import type { ApiItem } from "../lib/types";
import { getSongSections } from "../lib/songProcessing";
import Icon from "./Icon";

interface SectionsListProps {
  currentSong: ApiItem | null;
  activeSectionIndex: number;
  onGoToSection: (idx: number) => void;
  onStartNewSong?: () => void;
  onEditCurrentSong?: () => void;
  /** Stejné jako ArrowLeft/ArrowUp na klávesnici. */
  onNavigatePrev?: () => void;
  /** Stejné jako ArrowRight/ArrowDown na klávesnici. */
  onNavigateNext?: () => void;
}

export default function SectionsList({
  currentSong,
  activeSectionIndex,
  onGoToSection,
  onStartNewSong,
  onEditCurrentSong,
  onNavigatePrev,
  onNavigateNext,
}: SectionsListProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const lastSongIdRef = useRef<number | null>(null);

  // Když se změní aktivní sekce:
  // - Nová píseň/kapitola/kázání (jiné currentSong.id) → instant + center,
  //   aby uživatel rovnou viděl vybraný chunk doprostřed (typicky po
  //   kliknutí v search výsledcích). Browser to ořízne na konce panelu,
  //   takže poslední chunky zůstanou viditelné.
  // - Stejná píseň, navigace klávesnicí → smooth + nearest, jen když je třeba.
  useEffect(() => {
    if (activeSectionIndex < 0) return;
    const songChanged = lastSongIdRef.current !== (currentSong?.id ?? null);
    lastSongIdRef.current = currentSong?.id ?? null;
    activeRef.current?.scrollIntoView({
      block: songChanged ? "center" : "nearest",
      behavior: songChanged ? "auto" : "smooth",
    });
  }, [activeSectionIndex, currentSong?.id]);

  // Když není nic vybráno (žádná píseň, bible kapitola, ani message),
  // panel zůstane prázdný — bez info nadpisu, popisku i tlačítek.
  if (!currentSong) return null;

  return (
    <>
      <div className="shrink-0 flex justify-between items-center p-4 pb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-text-primary">
            Sections
          </h2>
          {onNavigatePrev && (
            <button
              onClick={onNavigatePrev}
              className="w-7 h-7 flex items-center justify-center rounded-full text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
              title="Previous section (←/↑)"
            >
              <Icon name="ChevronLeft" size={16} />
            </button>
          )}
          {onNavigateNext && (
            <button
              onClick={onNavigateNext}
              className="w-7 h-7 flex items-center justify-center rounded-full text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
              title="Next section (→/↓)"
            >
              <Icon name="ChevronRight" size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onEditCurrentSong && (
            <button
              onClick={onEditCurrentSong}
              className="w-8 h-8 flex items-center justify-center bg-surface-secondary border border-border text-text-secondary rounded-full hover:bg-primary hover:text-white hover:border-primary transition-colors"
              title="Edit current song"
            >
              <Icon name="Pencil" size={14} />
            </button>
          )}
          {onStartNewSong && (
            <button
              onClick={onStartNewSong}
              className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded-full text-lg hover:bg-primary-hover transition-colors"
              title="Add new song"
            >
              +
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div
          className={
            currentSong.isBible || currentSong.isMessage
              ? "space-y-0"
              : "space-y-1"
          }
        >
            {getSongSections(currentSong).map((section, idx) => {
              const isActive = idx === activeSectionIndex;
              const isBible = currentSong.isBible || currentSong.isMessage;
              return (
                <button
                  key={idx}
                  ref={isActive ? activeRef : null}
                  onClick={() => onGoToSection(idx)}
                  className={`w-full text-left rounded border transition-colors flex items-start ${
                    isBible ? "px-2 py-0.5 gap-1.5" : "px-3 py-2 gap-3"
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
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
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
                        {section.previewPL && (
                          <span
                            className={`text-xs truncate ${
                              isActive ? "text-white" : "text-text-secondary"
                            }`}
                          >
                            {section.previewPL}
                          </span>
                        )}
                        {section.previewEN && (
                          <span
                            className={`text-xs truncate italic ${
                              isActive ? "text-white/80" : "text-text-muted"
                            }`}
                          >
                            {section.previewEN}
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
    </>
  );
}
