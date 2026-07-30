"use client";

import { useState } from "react";
import type { Bible, BibleKey, BibleVerse } from "../lib/bibleData";
import BibleBrowser from "./BibleBrowser";
import MessagesBrowser from "./MessagesBrowser";

interface LibraryProps {
  songbooksContent: React.ReactNode;
  available: { songbooks: boolean; bibles: boolean; messages: boolean };
  bibles: Record<BibleKey, Bible | null>;
  biblesLoaded: boolean;
  onShowBibleChapter: (
    verses: BibleVerse[],
    bookName: string,
    chapter: number,
    bibleName: string,
    autoSelectVerseIdx?: number,
  ) => void;
  onShowMessage?: (date: string, title: string, chunkIdx?: number) => void;
}

type Tab = "songbooks" | "bibles" | "messages";

export default function Library({
  songbooksContent,
  available,
  bibles,
  biblesLoaded,
  onShowBibleChapter,
  onShowMessage,
}: LibraryProps) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "songbooks", label: "Songbooks" },
    { key: "bibles", label: "Bibles" },
    { key: "messages", label: "Messages" },
  ].filter((t) => available[t.key as Tab]) as { key: Tab; label: string }[];

  const [tab, setTab] = useState<Tab>("songbooks");
  const activeTab = tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key;

  if (tabs.length === 0) return null;

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="shrink-0 flex border-b border-border bg-surface">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === t.key
                ? "bg-surface text-primary border-b-2 border-primary"
                : "text-text-secondary hover:bg-surface-hover"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === "songbooks" && songbooksContent}
        {activeTab === "bibles" && (
          <BibleBrowser
            bibles={bibles}
            loaded={biblesLoaded}
            onShowChapter={onShowBibleChapter}
          />
        )}
        {activeTab === "messages" && (
          <MessagesBrowser onShowMessage={onShowMessage} />
        )}
      </div>
    </div>
  );
}
