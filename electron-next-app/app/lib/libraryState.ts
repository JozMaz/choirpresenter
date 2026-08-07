"use client";

import { create } from "zustand";
import type { BibleKey } from "./bibleData";
import type { SelectedEntry } from "./selection";
import type { SongBookKey } from "./types";

export type LibraryTab = "songbooks" | "bibles" | "messages";

export type OpenedKind = SelectedEntry["kind"];

export const TAB_KIND: Record<LibraryTab, OpenedKind> = {
  songbooks: "song",
  bibles: "bible",
  messages: "message",
};

interface ChapterRef {
  bookIdx: number;
  chapterIdx: number;
}

interface LibraryState {
  tab: LibraryTab;
  setTab: (tab: LibraryTab) => void;

  songSearch: string;
  openSongBook: SongBookKey | null;
  collapsedSongBooks: SongBookKey[];
  setSongSearch: (term: string) => void;
  setOpenSongBook: (key: SongBookKey | null) => void;
  setCollapsedSongBooks: (keys: SongBookKey[]) => void;

  bibleKey: BibleKey;
  bibleSearch: string;
  openBibleBook: number | null;
  activeChapter: ChapterRef | null;
  setBibleKey: (key: BibleKey) => void;
  setBibleSearch: (term: string) => void;
  setOpenBibleBook: (index: number | null) => void;
  setActiveChapter: (ref: ChapterRef | null) => void;

  messageTitleSearch: string;
  messageTextSearch: string;
  setMessageTitleSearch: (term: string) => void;
  setMessageTextSearch: (term: string) => void;
}

export const useLibraryState = create<LibraryState>((set) => ({
  tab: "songbooks",
  setTab: (tab) => set({ tab }),

  songSearch: "",
  openSongBook: null,
  collapsedSongBooks: [],
  setSongSearch: (songSearch) => set({ songSearch }),
  setOpenSongBook: (openSongBook) => set({ openSongBook }),
  setCollapsedSongBooks: (collapsedSongBooks) => set({ collapsedSongBooks }),

  bibleKey: "gdanska",
  bibleSearch: "",
  openBibleBook: null,
  activeChapter: null,
  setBibleKey: (bibleKey) => set({ bibleKey }),
  setBibleSearch: (bibleSearch) => set({ bibleSearch }),
  setOpenBibleBook: (openBibleBook) => set({ openBibleBook }),
  setActiveChapter: (activeChapter) => set({ activeChapter }),

  messageTitleSearch: "",
  messageTextSearch: "",
  setMessageTitleSearch: (messageTitleSearch) => set({ messageTitleSearch }),
  setMessageTextSearch: (messageTextSearch) => set({ messageTextSearch }),
}));

// Scroll offsets are read and written on every wheel tick, so they live outside
// the store — nothing renders from them and a subscriber pass per tick is waste.
const scrollTops = new Map<string, number>();

export const rememberScroll = (key: string, top: number) =>
  scrollTops.set(key, top);

export const recallScroll = (key: string): number => scrollTops.get(key) ?? 0;

// What each tab had open, so leaving and coming back lands on the same verse,
// chunk or part. Kept out of the store for the same reason as the offsets: it
// is written on every step and nothing renders from it.
export interface OpenedPosition {
  entry: SelectedEntry;
  stepIndex: number;
}

const opened = new Map<OpenedKind, OpenedPosition>();

export const rememberOpened = (entry: SelectedEntry, stepIndex: number) =>
  opened.set(entry.kind, { entry, stepIndex });

export const recallOpened = (kind: OpenedKind): OpenedPosition | undefined =>
  opened.get(kind);
