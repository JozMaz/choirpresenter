"use client";

import { useState } from "react";
import type { OutputConfig } from "../lib/outputConfig";
import { EMPTY_TEXT, planFor, type SongPlan } from "../lib/outputPlan";
import type { ApiItem } from "../lib/types";

interface LivePosition {
  song: ApiItem;
  stepIndex: number;
}

interface SongPlayerState {
  currentSong: ApiItem | null;
  stepIndex: number;
  live: LivePosition | null;
  restorePoint: {
    currentSong: ApiItem | null;
    stepIndex: number;
    live: LivePosition | null;
  } | null;
}

const emptyState: SongPlayerState = {
  currentSong: null,
  stepIndex: -1,
  live: null,
  restorePoint: null,
};

function sectionLabelFor(
  song: ApiItem,
  plan: SongPlan,
  stepIndex: number,
): string {
  const step = plan.steps[stepIndex];
  if (!step) return "";

  if (song.isBible && song.bibleMeta) {
    const { bookName, chapter } = song.bibleMeta;
    return `${bookName} ${chapter}:${song.sections[step.sectionIndex].number}`;
  }

  if (song.isMessage && song.messageMeta) {
    const { dateKey, title } = song.messageMeta;
    return `${title} - ${dateKey}`;
  }

  return song.sections[step.sectionIndex]?.label ?? "";
}

export function useSongPlayer(config: OutputConfig) {
  const [state, setState] = useState<SongPlayerState>(emptyState);

  const loadSong = (item: ApiItem) => {
    setState((prev) => ({
      ...prev,
      currentSong: item,
      stepIndex: -1,
      restorePoint: null,
    }));
  };

  const navigatePart = (direction: "next" | "prev") => {
    setState((prev) => {
      const song = prev.currentSong;
      if (!song) return prev;
      const plan = planFor(song, config);
      if (plan.steps.length === 0) return prev;

      if (prev.stepIndex < 0) {
        return {
          ...prev,
          restorePoint: null,
          stepIndex: 0,
          live: { song, stepIndex: 0 },
        };
      }

      const last = plan.steps.length - 1;
      const current = Math.min(prev.stepIndex, last);
      let next: number;
      if (direction === "next") {
        next = current >= last ? 0 : current + 1;
      } else {
        const candidate = current <= 0 ? last : current - 1;
        const leavingSection =
          plan.steps[candidate].sectionIndex !==
          plan.steps[current].sectionIndex;
        next = leavingSection
          ? plan.sectionStart[plan.steps[candidate].sectionIndex]
          : candidate;
      }
      return {
        ...prev,
        restorePoint: null,
        stepIndex: next,
        live: { song, stepIndex: next },
      };
    });
  };

  const goToSection = (sectionIndex: number, live = true) => {
    setState((prev) => {
      const song = prev.currentSong;
      if (!song) return prev;
      const plan = planFor(song, config);
      const stepIndex = plan.sectionStart[sectionIndex];
      if (stepIndex === undefined) return prev;
      return {
        ...prev,
        restorePoint: null,
        stepIndex,
        live: live ? { song, stepIndex } : prev.live,
      };
    });
  };

  const navigateSection = (direction: "next" | "prev") => {
    setState((prev) => {
      const song = prev.currentSong;
      if (!song) return prev;
      const plan = planFor(song, config);
      if (plan.sectionStart.length === 0) return prev;

      let sectionIndex: number;
      if (prev.stepIndex < 0) {
        sectionIndex = 0;
      } else {
        const current =
          plan.steps[Math.min(prev.stepIndex, plan.steps.length - 1)]
            .sectionIndex;
        const last = plan.sectionStart.length - 1;
        sectionIndex =
          direction === "next"
            ? current >= last
              ? 0
              : current + 1
            : current <= 0
              ? last
              : current - 1;
      }
      const stepIndex = plan.sectionStart[sectionIndex];
      return {
        ...prev,
        restorePoint: null,
        stepIndex,
        live: { song, stepIndex },
      };
    });
  };

  const navigateParagraph = (direction: "next" | "prev") => {
    setState((prev) => {
      const song = prev.currentSong;
      if (!song) return prev;
      const plan = planFor(song, config);
      if (plan.steps.length === 0) return prev;
      const pnums = song.messageMeta?.pnums;
      if (!pnums || pnums.length === 0) return prev;
      if (prev.stepIndex < 0) {
        return {
          ...prev,
          restorePoint: null,
          stepIndex: 0,
          live: { song, stepIndex: 0 },
        };
      }

      const current =
        plan.steps[Math.min(prev.stepIndex, plan.steps.length - 1)]
          .sectionIndex;
      const paragraphStart = (chunkIdx: number) => {
        const pnum = pnums[chunkIdx];
        let start = chunkIdx;
        while (start > 0 && pnums[start - 1] === pnum) start--;
        return start;
      };

      let target: number;
      if (direction === "next") {
        const pnum = pnums[current];
        let j = current;
        while (j < pnums.length && pnums[j] === pnum) j++;
        target = j >= pnums.length ? 0 : j;
      } else {
        const start = paragraphStart(current);
        target =
          start < current
            ? start
            : paragraphStart(start > 0 ? start - 1 : pnums.length - 1);
      }

      const stepIndex = plan.sectionStart[target] ?? 0;
      return {
        ...prev,
        restorePoint: null,
        stepIndex,
        live: { song, stepIndex },
      };
    });
  };

  const clearSelection = () => {
    setState((prev) => {
      if (!prev.currentSong && !prev.live) return prev;
      return {
        currentSong: null,
        stepIndex: -1,
        live: null,
        restorePoint: {
          currentSong: prev.currentSong,
          stepIndex: prev.stepIndex,
          live: prev.live,
        },
      };
    });
  };

  const restoreSelection = () => {
    setState((prev) => {
      const point = prev.restorePoint;
      if (!point) return prev;
      return {
        currentSong: point.currentSong,
        stepIndex: point.stepIndex,
        live: point.live,
        restorePoint: null,
      };
    });
  };

  const goToStep = (stepIndex: number) => {
    setState((prev) => {
      const song = prev.currentSong;
      if (!song) return prev;
      const plan = planFor(song, config);
      if (stepIndex < 0 || stepIndex >= plan.steps.length) return prev;
      return {
        ...prev,
        restorePoint: null,
        stepIndex,
        live: { song, stepIndex },
      };
    });
  };

  const currentPlan = planFor(state.currentSong, config);
  const live = state.live;
  const livePlan = live ? planFor(live.song, config) : currentPlan;
  const liveStepIndex = live
    ? Math.min(live.stepIndex, livePlan.steps.length - 1)
    : -1;
  const step = liveStepIndex >= 0 ? livePlan.steps[liveStepIndex] : null;

  const currentStepIndex =
    state.stepIndex < 0
      ? -1
      : Math.min(state.stepIndex, currentPlan.steps.length - 1);
  const currentStep =
    currentStepIndex >= 0 ? currentPlan.steps[currentStepIndex] : null;

  return {
    currentSong: state.currentSong,
    plan: currentPlan,
    stepIndex: currentStepIndex,
    liveSong: live?.song ?? null,
    out1Text: step ? step.out1 : EMPTY_TEXT,
    out2Text: step ? step.out2 : EMPTY_TEXT,
    sectionLabel:
      live && step ? sectionLabelFor(live.song, livePlan, liveStepIndex) : "",
    positionText: live ? `${liveStepIndex + 1} / ${livePlan.steps.length}` : "",
    activeSectionIndex: currentStep ? currentStep.sectionIndex : -1,
    sendFirstPart: loadSong,
    navigatePart,
    navigateSection,
    navigateParagraph,
    goToSection,
    goToStep,
    clearSelection,
    restoreSelection,
    canRestore: state.restorePoint !== null,
  };
}
