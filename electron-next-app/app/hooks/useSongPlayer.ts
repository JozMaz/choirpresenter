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
}

const emptyState: SongPlayerState = {
  currentSong: null,
  slideIndex: -1,
  live: null,
};

const EMPTY_TEXT: SlideText = { primary: [] };

export function useSongPlayer() {
  const [state, setState] = useState<SongPlayerState>(emptyState);

  const loadSong = (item: ApiItem) => {
    setState((prev) => ({ ...prev, currentSong: item, slideIndex: -1 }));
  };

  const navigatePart = (direction: "next" | "prev") => {
    setState((prev) => {
      const song = prev.currentSong;
      if (!song || song.slides.length === 0) return prev;

      if (prev.slideIndex < 0) {
        return { ...prev, slideIndex: 0, live: { song, slideIndex: 0 } };
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
      return { ...prev, slideIndex: next, live: { song, slideIndex: next } };
    });
  };

  const goToSection = (sectionIndex: number) => {
    setState((prev) => {
      const song = prev.currentSong;
      if (!song) return prev;
      if (sectionIndex < 0 || sectionIndex >= song.sections.length) return prev;
      const slideIndex = song.sections[sectionIndex].slideStart;
      return { ...prev, slideIndex, live: { song, slideIndex } };
    });
  };

  const live = state.live;
  const slide = live ? live.song.slides[live.slideIndex] : null;
  const section = slide ? live!.song.sections[slide.sectionIndex] : null;

  return {
    ...state,
    liveSong: live?.song ?? null,
    output1: section
      ? { primary: section.primary, secondary: section.secondary }
      : EMPTY_TEXT,
    output2: slide
      ? { primary: slide.primary, secondary: slide.secondary }
      : EMPTY_TEXT,
    sendFirstPart: loadSong,
    navigatePart,
    goToSection,
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
