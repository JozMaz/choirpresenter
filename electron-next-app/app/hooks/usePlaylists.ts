"use client";

import { useCallback, useEffect, useState } from "react";
import type { SongSource } from "../lib/types";

export interface PlaylistSong {
  source: SongSource;
  id: number;
  /** Cached title pro rychlý display (skutečný titul se bere z dataByBook). */
  title: string;
}

export interface Playlist {
  id: string;
  name: string;
  songs: PlaylistSong[];
}

/**
 * Per-token playlistové složky uložené v localStorage.
 * Klíč: `playlists:{tokenSuffix}` — různé tokeny mají různé sady.
 *
 * Když token chybí (read-only mode), použije se "default" key, takže
 * uživatel bez tokenu pořád může mít své vlastní playlisty lokálně.
 */
function storageKey(token: string | null): string {
  return `playlists:${token ? token.slice(-12) : "default"}`;
}

export function usePlaylists(token: string | null) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loaded, setLoaded] = useState(false);
  const key = storageKey(token);

  // Load on key change
  useEffect(() => {
    setLoaded(false);
    try {
      const raw = localStorage.getItem(key);
      setPlaylists(raw ? (JSON.parse(raw) as Playlist[]) : []);
    } catch {
      setPlaylists([]);
    }
    setLoaded(true);
  }, [key]);

  const persist = useCallback(
    (next: Playlist[]) => {
      setPlaylists(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch (err) {
        console.error("Failed to persist playlists:", err);
      }
    },
    [key],
  );

  const createPlaylist = useCallback(
    (name: string): Playlist => {
      const trimmed = name.trim() || "New folder";
      const p: Playlist = {
        id: crypto.randomUUID(),
        name: trimmed,
        songs: [],
      };
      persist([...playlists, p]);
      return p;
    },
    [persist, playlists],
  );

  const renamePlaylist = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim() || "Untitled";
      persist(
        playlists.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
      );
    },
    [persist, playlists],
  );

  const deletePlaylist = useCallback(
    (id: string) => {
      persist(playlists.filter((p) => p.id !== id));
    },
    [persist, playlists],
  );

  const addSong = useCallback(
    (playlistId: string, song: PlaylistSong) => {
      persist(
        playlists.map((p) => {
          if (p.id !== playlistId) return p;
          // Skip duplicates (same source + id).
          if (
            p.songs.some((s) => s.source === song.source && s.id === song.id)
          ) {
            return p;
          }
          return { ...p, songs: [...p.songs, song] };
        }),
      );
    },
    [persist, playlists],
  );

  const removeSong = useCallback(
    (playlistId: string, source: SongSource, id: number) => {
      persist(
        playlists.map((p) =>
          p.id === playlistId
            ? {
                ...p,
                songs: p.songs.filter(
                  (s) => !(s.source === source && s.id === id),
                ),
              }
            : p,
        ),
      );
    },
    [persist, playlists],
  );

  const reorderSong = useCallback(
    (playlistId: string, fromIdx: number, toIdx: number) => {
      persist(
        playlists.map((p) => {
          if (p.id !== playlistId) return p;
          const next = [...p.songs];
          const [moved] = next.splice(fromIdx, 1);
          next.splice(toIdx, 0, moved);
          return { ...p, songs: next };
        }),
      );
    },
    [persist, playlists],
  );

  return {
    playlists,
    loaded,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addSong,
    removeSong,
    reorderSong,
  };
}
