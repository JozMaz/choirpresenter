"use client";

import { useEffect, useMemo, useState } from "react";
import { toApiItem, SONGBOOK_NAMES } from "../lib/songAdapter";
import type {
  ApiItem,
  SongBookKey,
  SongEntry,
  Songbook,
  WriteResult,
} from "../lib/types";

export const SONGBOOK_KEYS: SongBookKey[] = [
  "newSong",
  "newSongPlGb",
  "pielgrzym",
  "roboczy",
  "children",
];

type SongbooksState = Record<SongBookKey, Songbook>;

const emptyState = (): SongbooksState =>
  SONGBOOK_KEYS.reduce(
    (acc, key) => ({ ...acc, [key]: { name: SONGBOOK_NAMES[key], songs: [] } }),
    {} as SongbooksState,
  );

const NOT_WRITTEN: WriteResult = { localOk: false, cloudOk: null };

export function useSongbooks() {
  const [raw, setRaw] = useState<SongbooksState>(emptyState());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const api = window.api;
      const next: SongbooksState = emptyState();

      for (const key of SONGBOOK_KEYS) {
        if (!api?.readSongBook) continue;
        try {
          const book = await api.readSongBook(key);
          if (book?.songs) {
            next[key] = {
              name: book.name || SONGBOOK_NAMES[key],
              songs: book.songs,
            };
          }
        } catch (err) {
          console.error(`Failed to read songbook ${key}`, err);
        }
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

  const dataByBook = useMemo(() => {
    const out = {} as Record<SongBookKey, ApiItem[]>;
    for (const key of SONGBOOK_KEYS) {
      const book = raw[key];
      out[key] = book.songs.map((s) => toApiItem(s, key, book.name));
    }
    return out;
  }, [raw]);

  const bookNames = useMemo(() => {
    const out = {} as Record<SongBookKey, string>;
    for (const key of SONGBOOK_KEYS) out[key] = raw[key].name;
    return out;
  }, [raw]);

  const findSongById = (book: SongBookKey, id: string): SongEntry | undefined =>
    raw[book].songs.find((s) => s.id === id);

  const write = async (
    book: SongBookKey,
    songs: SongEntry[],
  ): Promise<WriteResult> => {
    const previous = raw[book];
    const next: Songbook = { name: previous.name, songs };
    setRaw((prev) => ({ ...prev, [book]: next }));

    if (!window.api?.writeSongBook) {
      setRaw((prev) => ({ ...prev, [book]: previous }));
      return NOT_WRITTEN;
    }

    try {
      const result = await window.api.writeSongBook(book, next);
      if (!result.localOk) {
        setRaw((prev) => ({ ...prev, [book]: previous }));
      }
      return result;
    } catch (err) {
      setRaw((prev) => ({ ...prev, [book]: previous }));
      throw err;
    }
  };

  const upsertSong = async (
    book: SongBookKey,
    song: SongEntry,
  ): Promise<WriteResult> => {
    const songs = raw[book].songs;
    const idx = songs.findIndex((s) => s.id === song.id);
    return write(
      book,
      idx >= 0 ? songs.map((s, i) => (i === idx ? song : s)) : [...songs, song],
    );
  };

  const deleteSongById = async (
    book: SongBookKey,
    id: string,
  ): Promise<WriteResult> => {
    const songs = raw[book].songs;
    const next = songs.filter((s) => s.id !== id);
    if (next.length === songs.length) {
      console.warn(`deleteSongById: no song with id ${id} in ${book}`);
      return NOT_WRITTEN;
    }
    return write(book, next);
  };

  return {
    loaded,
    dataByBook,
    bookNames,
    findSongById,
    upsertSong,
    deleteSongById,
  };
}
