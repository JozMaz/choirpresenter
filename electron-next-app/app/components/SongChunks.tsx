"use client";

import { useEffect, useRef } from "react";
import type { SongPlan } from "../lib/outputPlan";
import type { ApiItem, SectionType } from "../lib/types";
import { sectionLabel } from "../lib/songSchema";
import { useI18n } from "../lib/i18n/context";

const TYPE_COLOR: Record<SectionType, string> = {
  verse: "bg-primary",
  chorus: "bg-success",
  bridge: "bg-amber-500",
  ending: "bg-purple-500",
};

interface SongChunksProps {
  currentSong: ApiItem;
  plan: SongPlan;
  activeStepIndex: number;
  liveStepIndex: number;
  onGoToStep: (idx: number) => void;
}

export default function SongChunks({
  currentSong,
  plan,
  activeStepIndex,
  liveStepIndex,
  onGoToStep,
}: SongChunksProps) {
  const { t } = useI18n();
  const activeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastSongIdRef = useRef<string | null>(null);

  useEffect(() => {
    const songChanged = lastSongIdRef.current !== currentSong.id;
    lastSongIdRef.current = currentSong.id;

    if (activeStepIndex < 0) {
      if (songChanged) listRef.current?.scrollTo({ top: 0 });
      return;
    }
    activeRef.current?.scrollIntoView({
      block: songChanged ? "center" : "nearest",
      behavior: songChanged ? "auto" : "smooth",
    });
  }, [activeStepIndex, currentSong.id]);

  return (
    <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
      <div className="space-y-2">
        {currentSong.sections.map((section, sIdx) => {
          const stepIndexes = Array.from(
            { length: plan.sectionCount[sIdx] ?? 0 },
            (_, i) => (plan.sectionStart[sIdx] ?? 0) + i,
          );
          const sectionActive = stepIndexes.includes(activeStepIndex);
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
                  {sectionLabel(section.type, section.number, t.sectionTypes)}
                </span>
                {stepIndexes.length > 1 && (
                  <span className="text-[10px] text-text-muted">
                    {t.songChunks.parts(stepIndexes.length)}
                  </span>
                )}
              </div>
              <div className="p-1.5 space-y-1">
                {stepIndexes.map((stepIdx) => {
                  const slide = plan.steps[stepIdx].preview;
                  const isLive = stepIdx === liveStepIndex;
                  const isPreselected = stepIdx === activeStepIndex && !isLive;
                  const isActive = isLive || isPreselected;
                  return (
                    <button
                      key={stepIdx}
                      ref={isActive ? activeRef : null}
                      onClick={() => onGoToStep(stepIdx)}
                      className={`w-full text-left rounded border px-2 py-1.5 transition-colors ${
                        isLive
                          ? "bg-primary border-primary text-white"
                          : isPreselected
                            ? "bg-amber-500/20 border-amber-500 text-text-primary"
                            : "bg-surface-secondary/50 border-border text-text-secondary hover:bg-surface-hover"
                      }`}
                    >
                      {slide.primary.map((line, i) => (
                        <div
                          key={i}
                          className={`text-xs leading-snug ${
                            isLive ? "text-white" : ""
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
                                isLive ? "text-white/80" : "text-text-muted"
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
