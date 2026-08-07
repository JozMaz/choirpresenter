"use client";

import { useEffect } from "react";
import { useI18n } from "../lib/i18n/context";
import { useLibraryState, type LibraryTab } from "../lib/libraryState";
import Icon, { type IconName } from "./Icon";
import type { Bible, BibleKey } from "../lib/bibleData";
import type { BibleChapterRef } from "../lib/selection";
import BibleBrowser from "./BibleBrowser";
import MessagesBrowser from "./MessagesBrowser";

interface LibraryProps {
  songbooksContent: React.ReactNode;
  available: { songbooks: boolean; bibles: boolean; messages: boolean };
  bibles: Record<BibleKey, Bible | null>;
  biblesLoaded: boolean;
  onShowBibleChapter: (
    ref: BibleChapterRef,
    autoSelectVerseIdx?: number,
    goLive?: boolean,
  ) => void;
  onShowMessage?: (
    date: string,
    title: string,
    chunkIdx?: number,
    goLive?: boolean,
  ) => void;
  activeDateKey?: string | null;
  activeBibleRef?: { bookName: string; chapter: number } | null;
}

export default function Library({
  songbooksContent,
  available,
  bibles,
  biblesLoaded,
  onShowBibleChapter,
  onShowMessage,
  activeDateKey,
  activeBibleRef,
}: LibraryProps) {
  const { t } = useI18n();
  const tabs: { key: LibraryTab; label: string; icon: IconName }[] = (
    [
      { key: "songbooks", label: t.common.songbooks, icon: "Music" },
      { key: "bibles", label: t.common.bibles, icon: "BookOpen" },
      { key: "messages", label: t.common.messages, icon: "Mic" },
    ] as { key: LibraryTab; label: string; icon: IconName }[]
  ).filter((tab) => available[tab.key]);

  const tab = useLibraryState((s) => s.tab);
  const setTab = useLibraryState((s) => s.setTab);
  const activeTab = tabs.some((entry) => entry.key === tab) ? tab : tabs[0]?.key;

  // Losing a tab to a changed download selection must not leave the stored tab
  // pointing at something nobody can see — the reopen effect reads it too.
  useEffect(() => {
    if (activeTab && activeTab !== tab) setTab(activeTab);
  }, [activeTab, tab, setTab]);

  if (tabs.length === 0) return null;

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="shrink-0 flex border-b border-border bg-surface">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setTab(entry.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === entry.key
                ? "bg-surface text-primary border-b-2 border-primary"
                : "text-text-secondary hover:bg-surface-hover"
            }`}
          >
            <Icon name={entry.icon} size={13} className="shrink-0" />
            {entry.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === "songbooks" && songbooksContent}
        {activeTab === "bibles" && (
          <BibleBrowser
            bibles={bibles}
            loaded={biblesLoaded}
            activeRef={activeBibleRef}
            onShowChapter={onShowBibleChapter}
          />
        )}
        {activeTab === "messages" && (
          <MessagesBrowser
            activeDateKey={activeDateKey}
            onShowMessage={onShowMessage}
          />
        )}
      </div>
    </div>
  );
}
