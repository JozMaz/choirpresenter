"use client";

import { useState } from "react";
import type { Bible, BibleKey, BibleVerse } from "../lib/bibleData";
import BibleBrowser from "./BibleBrowser";
import MessagesBrowser from "./MessagesBrowser";

interface LibraryProps {
  /** Songbooks tab obsah (typicky <SongLists />). */
  songbooksContent: React.ReactNode;
  bibles: Record<BibleKey, Bible | null>;
  biblesLoaded: boolean;
  onShowBibleChapter: (
    verses: BibleVerse[],
    bookName: string,
    chapter: number,
    bibleName: string,
    autoSelectVerseIdx?: number,
  ) => void;
  onShowMessage?: (
    date: string,
    title: string,
    chunkIdx?: number,
  ) => void;
}

type Tab = "songbooks" | "bibles" | "messages";

export default function Library({
  songbooksContent,
  bibles,
  biblesLoaded,
  onShowBibleChapter,
  onShowMessage,
}: LibraryProps) {
  const [tab, setTab] = useState<Tab>("songbooks");

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-border bg-surface">
        <button
          onClick={() => setTab("songbooks")}
          className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
            tab === "songbooks"
              ? "bg-surface text-primary border-b-2 border-primary"
              : "text-text-secondary hover:bg-surface-secondary"
          }`}
        >
          Songbooks
        </button>
        <button
          onClick={() => setTab("bibles")}
          className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
            tab === "bibles"
              ? "bg-surface text-primary border-b-2 border-primary"
              : "text-text-secondary hover:bg-surface-secondary"
          }`}
        >
          Bibles
        </button>
        <button
          onClick={() => setTab("messages")}
          className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
            tab === "messages"
              ? "bg-surface text-primary border-b-2 border-primary"
              : "text-text-secondary hover:bg-surface-secondary"
          }`}
        >
          Messages
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {tab === "songbooks" && songbooksContent}
        {tab === "bibles" && (
          <BibleBrowser
            bibles={bibles}
            loaded={biblesLoaded}
            onShowChapter={onShowBibleChapter}
          />
        )}
        {tab === "messages" && (
          <MessagesBrowser onShowMessage={onShowMessage} />
        )}
      </div>
    </div>
  );
}
