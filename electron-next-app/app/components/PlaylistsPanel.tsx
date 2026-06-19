"use client";

import { useState } from "react";
import type { ApiItem, SongBookKey } from "../lib/types";
import type { Playlist, PlaylistSong } from "../hooks/usePlaylists";
import Icon from "./Icon";

interface PlaylistsPanelProps {
  playlists: Playlist[];
  dataByBook: Record<SongBookKey, ApiItem[]>;
  customSongs: ApiItem[];
  /** Aktuálně načtená píseň v playeru — slouží pro "+ Add current" button. */
  currentSong: ApiItem | null;
  onCreatePlaylist: (name: string) => Playlist;
  onRenamePlaylist: (id: string, name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onAddSong: (playlistId: string, song: PlaylistSong) => void;
  onRemoveSong: (
    playlistId: string,
    source: PlaylistSong["source"],
    id: number,
  ) => void;
  /** Načte píseň do playeru (preview + HDMI). */
  onShowSong: (item: ApiItem) => void;
}

/**
 * Najde ApiItem v aktuálních datech podle source + id.
 * Vrátí null pokud píseň byla mezitím smazaná z dat.
 */
function lookupItem(
  source: PlaylistSong["source"],
  id: number,
  dataByBook: Record<SongBookKey, ApiItem[]>,
  customSongs: ApiItem[],
): ApiItem | null {
  if (source === "custom") {
    return customSongs.find((s) => s.id === id) ?? null;
  }
  const arr = dataByBook[source as SongBookKey] || [];
  return arr.find((s) => s.id === id) ?? null;
}

export default function PlaylistsPanel({
  playlists,
  dataByBook,
  customSongs,
  currentSong,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onAddSong,
  onRemoveSong,
  onShowSong,
}: PlaylistsPanelProps) {
  const canAddCurrent = !!(
    currentSong &&
    !currentSong.isBible &&
    !currentSong.isMessage
  );

  const addCurrentTo = (playlistId: string) => {
    if (!canAddCurrent || !currentSong) return;
    onAddSong(playlistId, {
      source: currentSong.source,
      id: currentSong.id,
      title: currentSong.title || currentSong.text || "",
    });
  };
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startCreate = () => {
    const name = prompt("Folder name:");
    if (!name) return;
    const p = onCreatePlaylist(name);
    setOpenIds((prev) => new Set(prev).add(p.id));
  };

  const startRename = (p: Playlist) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const commitRename = () => {
    if (editingId) onRenamePlaylist(editingId, editName);
    setEditingId(null);
    setEditName("");
  };

  const confirmDelete = (p: Playlist) => {
    if (!confirm(`Delete folder "${p.name}"? Songs inside the folder are not deleted from the songbook.`))
      return;
    onDeletePlaylist(p.id);
  };

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="shrink-0 px-2 pt-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text-secondary">
          {playlists.length} folder{playlists.length === 1 ? "" : "s"}
        </span>
        <button
          onClick={startCreate}
          className="px-2 py-1 text-xs font-semibold bg-primary text-white rounded hover:bg-primary-hover transition-colors flex items-center gap-1"
          title="Create new folder"
        >
          <Icon name="FolderPlus" size={12} />
          New folder
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pt-2 pb-2 mt-1">
        {playlists.length === 0 && (
          <p className="text-text-muted text-xs text-center py-4">
            No folders yet.
            <br />
            Create one and add songs from the Songbooks tab.
          </p>
        )}
        {playlists.map((p) => {
          const isOpen = openIds.has(p.id);
          const isEditing = editingId === p.id;
          return (
            <div key={p.id} className="mb-1">
              <div
                className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${
                  isOpen
                    ? "bg-surface-secondary text-primary"
                    : "text-text-secondary hover:bg-surface-secondary/50"
                }`}
              >
                <button
                  onClick={() => toggleOpen(p.id)}
                  className="shrink-0"
                  title={isOpen ? "Collapse" : "Expand"}
                >
                  <Icon
                    name={isOpen ? "ChevronDown" : "ChevronRight"}
                    size={12}
                  />
                </button>
                {isEditing ? (
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") {
                        setEditingId(null);
                        setEditName("");
                      }
                    }}
                    className="flex-1 px-1 py-0 text-xs font-semibold border border-border-secondary rounded bg-surface text-text-primary"
                  />
                ) : (
                  <span
                    onDoubleClick={() => startRename(p)}
                    className="flex-1 text-xs font-semibold truncate cursor-pointer"
                    title="Double-click to rename"
                  >
                    {p.name} ({p.songs.length})
                  </span>
                )}
                {canAddCurrent && (
                  <button
                    onClick={() => addCurrentTo(p.id)}
                    title="Add current song"
                    className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-success hover:bg-success hover:text-white transition-colors"
                  >
                    <Icon name="Plus" size={12} />
                  </button>
                )}
                <button
                  onClick={() => startRename(p)}
                  title="Rename"
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-text-secondary hover:bg-text-secondary hover:text-white transition-colors"
                >
                  <Icon name="Pencil" size={10} />
                </button>
                <button
                  onClick={() => confirmDelete(p)}
                  title="Delete folder"
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-danger hover:bg-danger hover:text-white transition-colors"
                >
                  <Icon name="Trash2" size={10} />
                </button>
              </div>

              {isOpen && (
                <div className="ml-3 mt-0.5 mb-1 border-l border-border pl-2 space-y-0.5">
                  {p.songs.length === 0 && (
                    <p className="text-text-muted text-[11px] text-center py-1 italic">
                      Empty. Add songs from the Songbooks tab.
                    </p>
                  )}
                  {p.songs.map((song) => {
                    const item = lookupItem(
                      song.source,
                      song.id,
                      dataByBook,
                      customSongs,
                    );
                    return (
                      <div
                        key={`${song.source}-${song.id}`}
                        onClick={() => item && onShowSong(item)}
                        className={`flex justify-between items-center gap-2 px-2 py-0 rounded border leading-tight ${
                          item
                            ? "bg-surface-secondary border-border hover:bg-border cursor-pointer"
                            : "bg-surface-secondary/30 border-border/30 cursor-not-allowed opacity-50"
                        }`}
                        title={item ? "Click to load" : "Song no longer in songbook"}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {song.id > 0 && (
                            <span className="text-xs font-semibold text-primary shrink-0">
                              {song.id}.
                            </span>
                          )}
                          <span className="text-xs text-text-secondary truncate">
                            {item?.title ?? song.title}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveSong(p.id, song.source, song.id);
                          }}
                          title="Remove from folder"
                          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-text-muted hover:bg-danger hover:text-white transition-colors"
                        >
                          <Icon name="X" size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
