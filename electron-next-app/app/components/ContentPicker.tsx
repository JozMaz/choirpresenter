"use client";

import { useState } from "react";
import type { SongBookKey } from "../lib/types";
import {
  isSelectionEmpty,
  type Catalog,
  type ContentSelection,
} from "../lib/access";
import { SONGBOOK_NAMES } from "../lib/songAdapter";
import { BIBLE_LABELS } from "../lib/bibleData";
import { ALL_SONGBOOK_KEYS } from "../lib/access";
import { useI18n } from "../lib/i18n/context";
import Checkbox from "./Checkbox";
import LanguageSwitch from "./LanguageSwitch";

interface ContentPickerProps {
  catalog: Catalog | null;
  initial: ContentSelection;
  onConfirm: (selection: ContentSelection) => void;
  onSkip: () => void;
  asModal?: boolean;
  onCancel?: () => void;
  showEverything?: boolean;
}

export default function ContentPicker({
  catalog,
  initial,
  onConfirm,
  onSkip,
  asModal = false,
  onCancel,
  showEverything = false,
}: ContentPickerProps) {
  const { t } = useI18n();
  const [selection, setSelection] = useState<ContentSelection>(initial);

  const songbookOptions = showEverything
    ? ALL_SONGBOOK_KEYS.map((key) => ({ key, name: SONGBOOK_NAMES[key] }))
    : (catalog?.songbooks ?? []);
  const bibleOptions = showEverything
    ? Object.entries(BIBLE_LABELS).map(([key, name]) => ({ key, name }))
    : (catalog?.bibles ?? []);
  const offersMessages = showEverything || (catalog?.messages?.count ?? 0) > 0;

  const toggleSongbook = (key: SongBookKey, checked: boolean) =>
    setSelection((prev) => ({
      ...prev,
      songbooks: checked
        ? [...prev.songbooks, key]
        : prev.songbooks.filter((k) => k !== key),
    }));

  const toggleBible = (key: string, checked: boolean) =>
    setSelection((prev) => ({
      ...prev,
      bibles: checked
        ? [...prev.bibles, key]
        : prev.bibles.filter((k) => k !== key),
    }));

  const empty = isSelectionEmpty(selection);
  const sectionClass =
    "bg-surface-secondary/30 border border-border rounded-md p-3";
  const headingClass =
    "block text-[10px] font-semibold text-text-secondary uppercase tracking-wide mb-2";

  const body = (
    <>
      <div className={sectionClass}>
        <span className={headingClass}>{t.common.songbooks}</span>
        {songbookOptions.length > 0 ? (
          <div className="space-y-1.5">
            {songbookOptions.map((book) => {
              const songs = "songs" in book ? Number(book.songs) : 0;
              return (
                <Checkbox
                  key={book.key}
                  checked={selection.songbooks.includes(book.key)}
                  onChange={(checked) => toggleSongbook(book.key, checked)}
                  label={
                    songs
                      ? t.contentPicker.songCount(book.name, songs)
                      : book.name
                  }
                />
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-text-muted">
            {t.contentPicker.nothingPublished}
          </p>
        )}
      </div>

      <div className={sectionClass}>
        <span className={headingClass}>{t.common.bibles}</span>
        {bibleOptions.length > 0 ? (
          <div className="space-y-1.5">
            {bibleOptions.map((bible) => (
              <Checkbox
                key={bible.key}
                checked={selection.bibles.includes(bible.key)}
                onChange={(checked) => toggleBible(bible.key, checked)}
                label={bible.name}
              />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-text-muted">
            {t.contentPicker.nothingPublished}
          </p>
        )}
      </div>

      <div className={sectionClass}>
        <span className={headingClass}>{t.common.messages}</span>
        {!offersMessages ? (
          <p className="text-[11px] text-text-muted">
            {t.contentPicker.nothingPublished}
          </p>
        ) : (
          <Checkbox
            checked={selection.messages}
            onChange={(checked) =>
              setSelection((prev) => ({ ...prev, messages: checked }))
            }
            label={
              catalog?.messages?.count
                ? t.contentPicker.allSermonsCount(catalog.messages.count)
                : t.contentPicker.allSermons
            }
            hint={
              catalog?.messages?.sizeMb
                ? t.contentPicker.sizeHint(catalog.messages.sizeMb)
                : undefined
            }
          />
        )}
      </div>
    </>
  );

  const footer = (
    <div className="flex items-center gap-2 pt-1">
      <p className="flex-1 text-[11px] text-text-muted leading-snug">
        {empty
          ? t.contentPicker.emptyHint
          : t.contentPicker.changeLaterHint}
      </p>
      {asModal && onCancel ? (
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-semibold rounded border border-border text-text-secondary transition-colors enabled:hover:bg-surface-hover enabled:hover:text-text-primary"
        >
          {t.common.cancel}
        </button>
      ) : (
        <button
          onClick={onSkip}
          className="px-3 py-1.5 text-xs font-semibold rounded border border-border text-text-secondary transition-colors enabled:hover:bg-surface-hover enabled:hover:text-text-primary"
        >
          {t.contentPicker.skip}
        </button>
      )}
      <button
        onClick={() => onConfirm(selection)}
        className="px-3 py-1.5 text-xs font-semibold rounded bg-primary text-white transition-colors hover:bg-primary-hover"
      >
        {empty ? t.contentPicker.continueWithoutData : t.contentPicker.download}
      </button>
    </div>
  );

  if (asModal) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
        <div className="w-full max-w-md max-h-[85vh] flex flex-col bg-surface rounded-lg border border-border shadow-xl">
          <div className="shrink-0 px-6 pt-5 pb-2">
            <h2 className="text-lg font-semibold text-text-primary">
              {t.contentPicker.modalTitle}
            </h2>
            <p className="text-[11px] text-text-muted leading-snug mt-1">
              {t.contentPicker.modalHint}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-3">
            {body}
          </div>
          <div className="shrink-0 px-6 pb-5">{footer}</div>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen w-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-border rounded-lg shadow-xl px-6 py-6 space-y-3">
        <div>
          <div className="flex items-start gap-2">
            <h1 className="flex-1 text-lg font-semibold text-text-primary">
              {t.contentPicker.firstRunTitle}
            </h1>
            <LanguageSwitch />
          </div>
          <p className="text-[11px] text-text-muted leading-snug mt-1">
            {t.contentPicker.firstRunHint}
          </p>
        </div>
        {body}
        {footer}
      </div>
    </main>
  );
}
