"use client";

import { useState } from "react";
import type { ApiItem, SlideText } from "../lib/types";

interface LivePosition {
  song: ApiItem;
  slideIndex: number;
}

interface SongPlayerState {
  currentSong: ApiItem | null;
  slideIndex: number;
  live: LivePosition | null;
  restorePoint: {
    currentSong: ApiItem | null;
    slideIndex: number;
    live: LivePosition | null;
  } | null;
}

const emptyState: SongPlayerState = {
  currentSong: null,
  slideIndex: -1,
  live: null,
  restorePoint: null,
};

const EMPTY_TEXT: SlideText = { primary: [] };

export function useSongPlayer() {
  const [state, setState] = useState<SongPlayerState>(emptyState);

  const loadSong = (item: ApiItem) => {
    setState((prev) => ({
      ...prev,
      currentSong: item,
      slideIndex: -1,
      restorePoint: null,
    }));
  };

  const navigatePart = (direction: "next" | "prev") => {
    setState((prev) => {
      const song = prev.currentSong;
      if (!song || song.slides.length === 0) return prev;

      if (prev.slideIndex < 0) {
        return {
          ...prev,
          restorePoint: null,
          slideIndex: 0,
          live: { song, slideIndex: 0 },
        };
      }

      const last = song.slides.length - 1;
      let next: number;
      if (direction === "next") {
        next = prev.slideIndex >= last ? 0 : prev.slideIndex + 1;
      } else {
        const candidate = prev.slideIndex <= 0 ? last : prev.slideIndex - 1;
        const leavingSection =
          song.slides[candidate].sectionIndex !==
          song.slides[prev.slideIndex].sectionIndex;
        next = leavingSection
          ? song.sections[song.slides[candidate].sectionIndex].slideStart
          : candidate;
      }
      return {
        ...prev,
        restorePoint: null,
        slideIndex: next,
        live: { song, slideIndex: next },
      };
    });
  };

  const goToSection = (sectionIndex: number) => {
    setState((prev) => {
      const song = prev.currentSong;
      if (!song) return prev;
      if (sectionIndex < 0 || sectionIndex >= song.sections.length) return prev;
      const slideIndex = song.sections[sectionIndex].slideStart;
      return {
        ...prev,
        restorePoint: null,
        slideIndex,
        live: { song, slideIndex },
      };
    });
  };

  const navigateSection = (direction: "next" | "prev") => {
    setState((prev) => {
      const song = prev.currentSong;
      if (!song || song.sections.length === 0) return prev;
      let sectionIndex: number;
      if (prev.slideIndex < 0) {
        sectionIndex = 0;
      } else {
        const current = song.slides[prev.slideIndex].sectionIndex;
        const last = song.sections.length - 1;
        sectionIndex =
          direction === "next"
            ? current >= last
              ? 0
              : current + 1
            : current <= 0
              ? last
              : current - 1;
      }
      const slideIndex = song.sections[sectionIndex].slideStart;
      return {
        ...prev,
        restorePoint: null,
        slideIndex,
        live: { song, slideIndex },
      };
    });
  };

  const navigateParagraph = (direction: "next" | "prev") => {
    setState((prev) => {
      const song = prev.currentSong;
      if (!song || song.slides.length === 0) return prev;
      const pnums = song.messageMeta?.pnums;
      if (!pnums || pnums.length === 0) return prev;
      if (prev.slideIndex < 0) {
        return {
          ...prev,
          restorePoint: null,
          slideIndex: 0,
          live: { song, slideIndex: 0 },
        };
      }

      const current = song.slides[prev.slideIndex].sectionIndex;
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

      const slideIndex = song.sections[target]?.slideStart ?? 0;
      return {
        ...prev,
        restorePoint: null,
        slideIndex,
        live: { song, slideIndex },
      };
    });
  };

  const clearSelection = () => {
    setState((prev) => {
      if (!prev.currentSong && !prev.live) return prev;
      return {
        currentSong: null,
        slideIndex: -1,
        live: null,
        restorePoint: {
          currentSong: prev.currentSong,
          slideIndex: prev.slideIndex,
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
        slideIndex: point.slideIndex,
        live: point.live,
        restorePoint: null,
      };
    });
  };

  const goToSlide = (slideIndex: number) => {
    setState((prev) => {
      const song = prev.currentSong;
      if (!song) return prev;
      if (slideIndex < 0 || slideIndex >= song.slides.length) return prev;
      return {
        ...prev,
        restorePoint: null,
        slideIndex,
        live: { song, slideIndex },
      };
    });
  };

  const live = state.live;
  const slide = live ? live.song.slides[live.slideIndex] : null;
  const section = slide ? live!.song.sections[slide.sectionIndex] : null;

  return {
    ...state,
    liveSong: live?.song ?? null,
    output1: section
      ? {
          primary: section.primary,
          secondary: section.secondary,
          isTranslation: section.secondaryIsTranslation === true,
        }
      : EMPTY_TEXT,
    output2: slide
      ? {
          primary: slide.primary,
          secondary: slide.secondary,
          isTranslation: section?.secondaryIsTranslation === true,
        }
      : EMPTY_TEXT,
    sendFirstPart: loadSong,
    navigatePart,
    navigateSection,
    navigateParagraph,
    goToSection,
    goToSlide,
    clearSelection,
    restoreSelection,
    canRestore: state.restorePoint !== null,
  };
}

export function getCurrentSectionLabel(state: SongPlayerState): string {
  const live = state.live;
  if (!live) return "";
  const { song, slideIndex } = live;

  if (song.isBible && song.bibleMeta) {
    const section = song.sections[song.slides[slideIndex].sectionIndex];
    const { bookName, chapter } = song.bibleMeta;
    return `${bookName} ${chapter}:${section.number}`;
  }

  if (song.isMessage && song.messageMeta) {
    const { dateKey, title } = song.messageMeta;
    return `${title} - ${dateKey}`;
  }

  return song.slides[slideIndex]?.label ?? "";
}

export function getCurrentPosition(state: SongPlayerState): string {
  const live = state.live;
  if (!live) return "";
  return `${live.slideIndex + 1} / ${live.song.slides.length}`;
}

export function getActiveSectionIndex(state: SongPlayerState): number {
  const { currentSong, slideIndex } = state;
  if (!currentSong || slideIndex < 0) return -1;
  return currentSong.slides[slideIndex]?.sectionIndex ?? -1;
}
