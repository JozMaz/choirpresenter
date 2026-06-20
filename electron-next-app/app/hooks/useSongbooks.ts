"use client";

import { useEffect, useMemo, useState } from "react";
import {
  processBilingualSongbook,
  processPlOnlySongbook,
} from "../lib/songProcessing";
import type { ApiItem, Song, SongBookKey } from "../lib/types";

/**
 * Konfigurace songbooks: lidský label + formát.
 * Data se načítají runtime přes Electron IPC z lokální cache (cloud download).
 */
export const SONGBOOKS: {
  key: SongBookKey;
  label: string;
  bilingual: boolean;
}[] = [
  { key: "newSong", label: "New Song", bilingual: false },
  { key: "newSongPlGb", label: "New Song PL/EN", bilingual: true },
  { key: "pielgrzym", label: "Pielgrzym", bilingual: false },
  { key: "roboczy", label: "Roboczy", bilingual: true },
  { key: "children", label: "Children", bilingual: true },
];

type SongbooksState = Record<SongBookKey, Song[]>;

const emptyState = (): SongbooksState =>
  SONGBOOKS.reduce(
    (acc, b) => ({ ...acc, [b.key]: [] }),
    {} as SongbooksState,
  );

/**
 * Načte všechny songbooky přes Electron IPC (s fallbackem na bundled JSON).
 * Poskytuje upsert / delete operace, které updatují stav i přepíšou JSON na disku.
 */
export function useSongbooks() {
  const [raw, setRaw] = useState<SongbooksState>(emptyState());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const api = window.api;
      const next: SongbooksState = emptyState();

      for (const book of SONGBOOKS) {
        let data: Song[] = [];
        if (api?.readSongBook) {
          try {
            const r = await api.readSongBook(book.key);
            if (r?.Songs) data = r.Songs;
          } catch (err) {
            console.error(`Failed to read songbook ${book.key}`, err);
          }
        }
        next[book.key] = data;
      }

      if (!cancelled) {
        setRaw(next);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Mapa per-book ApiItem[] derivována z raw. */
  const dataByBook = useMemo(() => {
    const out: Record<SongBookKey, ApiItem[]> = emptyState() as unknown as Record<
      SongBookKey,
      ApiItem[]
    >;
    for (const book of SONGBOOKS) {
      const songs = raw[book.key] || [];
      out[book.key] = songs.map((s) =>
        book.bilingual
          ? processBilingualSongbook(s, book.key)
          : processPlOnlySongbook(s, book.key),
      );
    }
    return out;
  }, [raw]);

  const findSong = (book: SongBookKey, id: number): Song | undefined =>
    (raw[book] || []).find((s) => s.ID === id);

  const upsertSong = async (
    book: SongBookKey,
    song: Song,
  ): Promise<{ localOk: boolean; cloudOk: boolean | null }> => {
    // Snapshot SYNCHRONNĚ z aktuálního raw (closure).
    // POZOR: setRaw callback se nevolá synchronně v React 18 — kdybychom
    // snapshot updatovali uvnitř callbacku, writeSongBook by čekal a měl
    // by initial value [] → cloud + cache by dostaly prázdný songbook.
    const arr = raw[book] || [];
    const idx = song.Guid
      ? arr.findIndex((s) => s.Guid === song.Guid)
      : arr.findIndex((s) => s.ID === song.ID && song.ID > 0);
    const next = idx >= 0
      ? arr.map((s, i) => (i === idx ? song : s))
      : [...arr, song];
    setRaw((prev) => ({ ...prev, [book]: next }));
    if (window.api?.writeSongBook) {
      return await window.api.writeSongBook(book, { Songs: next });
    }
    return { localOk: false, cloudOk: null };
  };

  const deleteSong = async (
    book: SongBookKey,
    id: number,
  ): Promise<{ localOk: boolean; cloudOk: boolean | null }> => {
    const arr = raw[book] || [];
    const next = arr.filter((s) => s.ID !== id);
    setRaw((prev) => ({ ...prev, [book]: next }));
    if (window.api?.writeSongBook) {
      return await window.api.writeSongBook(book, { Songs: next });
    }
    return { localOk: false, cloudOk: null };
  };

  return {
    loaded,
    dataByBook,
    raw,
    findSong,
    upsertSong,
    deleteSong,
  };
}
