"use client";

import { useEffect, useRef } from "react";
import type { ApiItem, SectionListItem } from "../lib/types";
import { getSongSections } from "../lib/songAdapter";
import Icon from "./Icon";

interface SectionsListProps {
  currentSong: ApiItem | null;
  activeSectionIndex: number;
  onGoToSection: (idx: number) => void;
  onStartNewSong?: () => void;
  onEditCurrentSong?: () => void;
  onOpenSettings?: () => void;
  /** Přidá aktuální píseň do vybraných. Chybí u bible/kázání. */
  onAddToSelected?: () => void;
  isInSelected?: boolean;
  blackoutActive?: boolean;
  onToggleBlackout?: () => void;
  /** Stejné jako ArrowLeft/ArrowUp na klávesnici. */
  onNavigatePrev?: () => void;
  /** Stejné jako ArrowRight/ArrowDown na klávesnici. */
  onNavigateNext?: () => void;
  /** Stav ukládání — zobrazí spinner/check/warning v headeru. */
  saveStatus?: "idle" | "saving" | "saved" | "local" | "error";
}

export default function SectionsList({
  currentSong,
  activeSectionIndex,
  onGoToSection,
  onStartNewSong,
  onEditCurrentSong,
  onOpenSettings,
  onAddToSelected,
  isInSelected,
  blackoutActive,
  onToggleBlackout,
  onNavigatePrev,
  onNavigateNext,
  saveStatus = "idle",
}: SectionsListProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const lastSongIdRef = useRef<string | null>(null);

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

  // Header se ukazuje VŽDY — i bez vybrané písně, aby byly "+" a Settings
  // pořád dostupné. Body sekcí se renderuje jen když je píseň vybraná.
  return (
    <>
      <div className="shrink-0 flex justify-between items-center p-4 pb-2">
        <div className="flex items-center gap-2">
          {currentSong && (
            <>
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
              {onToggleBlackout && (
                <button
                  onClick={onToggleBlackout}
                  title={blackoutActive ? "Show text" : "Hide text (blackout)"}
                  className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                    blackoutActive
                      ? "bg-primary text-white hover:bg-primary-hover"
                      : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon name="Moon" size={15} />
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "saving" && (
            <span
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-text-secondary"
              title="Saving to cloud..."
            >
              <Icon name="Loader" size={12} className="animate-spin" />
              Saving…
            </span>
          )}
          {saveStatus === "saved" && (
            <span
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-success"
              title="Synced to cloud"
            >
              <Icon name="Check" size={12} />
              Saved
            </span>
          )}
          {saveStatus === "local" && (
            <span
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-text-secondary"
              title="No write token — saved only on this device. Open Settings to add a token."
            >
              <Icon name="HardDrive" size={12} />
              Local only
            </span>
          )}
          {saveStatus === "error" && (
            <span
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-danger"
              title="Cloud sync failed — check internet or your write token"
            >
              <Icon name="TriangleAlert" size={12} />
              Cloud failed
            </span>
          )}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="w-8 h-8 flex items-center justify-center text-text-secondary hover:bg-surface-secondary hover:text-text-primary rounded-full transition-colors"
              title="Settings"
            >
              <Icon name="Settings" size={16} />
            </button>
          )}
          {currentSong && onAddToSelected && (
            <button
              onClick={onAddToSelected}
              disabled={isInSelected}
              className={`w-8 h-8 flex items-center justify-center rounded-full border transition-colors ${
                isInSelected
                  ? "bg-success/15 border-success/40 text-success cursor-default"
                  : "bg-surface-secondary border-border text-text-secondary hover:bg-primary hover:text-white hover:border-primary"
              }`}
              title={
                isInSelected
                  ? "Already in selected songs"
                  : "Add to selected songs"
              }
            >
              <Icon name={isInSelected ? "Check" : "ListPlus"} size={15} />
            </button>
          )}
          {currentSong && onEditCurrentSong && (
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
      {currentSong && (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div
          className={
            currentSong.isBible || currentSong.isMessage
              ? "space-y-0"
              : "space-y-0.5"
          }
        >
            {getSongSections(currentSong).map((section: SectionListItem, idx: number) => {
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
          })}
        </div>
        </div>
      )}
    </>
  );
}
