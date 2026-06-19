"use client";

import { useEffect, useMemo, useState } from "react";
import newSongJson from "../../api/SongBooks/new-song-converted.json";
import newSongPlGbJson from "../../api/SongBooks/new-song-pl-gb-converted.json";
import pielgrzymJson from "../../api/SongBooks/pielgrzym-converted.json";
import roboczyJson from "../../api/SongBooks/roboczy-converted.json";
import childrenJson from "../../api/SongBooks/children-converted.json";
import {
  processBilingualSongbook,
  processPlOnlySongbook,
} from "../lib/songProcessing";
import type { ApiItem, Song, SongBookKey } from "../lib/types";

/** Konfigurace songbooks: lidsky label + formát + případně bundled fallback. */
export const SONGBOOKS: {
  key: SongBookKey;
  label: string;
  bilingual: boolean;
  fallback: { Songs?: Song[] };
}[] = [
  {
    key: "newSong",
    label: "New Song",
    bilingual: false,
    fallback: newSongJson as unknown as { Songs?: Song[] },
  },
  {
    key: "newSongPlGb",
    label: "New Song PL/EN",
    bilingual: true,
    fallback: newSongPlGbJson as unknown as { Songs?: Song[] },
  },
  {
    key: "pielgrzym",
    label: "Pielgrzym",
    bilingual: false,
    fallback: pielgrzymJson as unknown as { Songs?: Song[] },
  },
  {
    key: "roboczy",
    label: "Roboczy",
    bilingual: true,
    fallback: roboczyJson as unknown as { Songs?: Song[] },
  },
  {
    key: "children",
    label: "Children",
    bilingual: true,
    fallback: childrenJson as unknown as { Songs?: Song[] },
  },
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
        let data: Song[] | null = null;
        if (api?.readSongBook) {
          try {
            const r = await api.readSongBook(book.key);
            if (r?.Songs) data = r.Songs;
          } catch (err) {
            console.error(`Failed to read songbook ${book.key}`, err);
          }
        }
        if (!data) data = book.fallback.Songs ?? [];
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
  ): Promise<void> => {
    let snapshot: Song[] = [];
    setRaw((prev) => {
      const arr = prev[book] || [];
      const idx = arr.findIndex((s) => s.ID === song.ID);
      const next =
        idx >= 0
          ? arr.map((s, i) => (i === idx ? song : s))
          : [...arr, song];
      snapshot = next;
      return { ...prev, [book]: next };
    });
    if (window.api?.writeSongBook) {
      await window.api.writeSongBook(book, { Songs: snapshot });
    }
  };

  const deleteSong = async (book: SongBookKey, id: number): Promise<void> => {
    let snapshot: Song[] = [];
    setRaw((prev) => {
      const arr = prev[book] || [];
      const next = arr.filter((s) => s.ID !== id);
      snapshot = next;
      return { ...prev, [book]: next };
    });
    if (window.api?.writeSongBook) {
      await window.api.writeSongBook(book, { Songs: snapshot });
    }
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
