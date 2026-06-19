"use client";

import type { ApiItem } from "../lib/types";
import SongListRow from "./SongListRow";

interface SongListsProps {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  nowaPiesnAll: ApiItem[];
  songsPlEnAll: ApiItem[];
  filteredNowaPiesn: ApiItem[];
  filteredSongsPlEn: ApiItem[];
  selectedItems: ApiItem[];
  onShow: (item: ApiItem) => void;
  onSelect: (item: ApiItem) => void;
}

export default function SongLists({
  searchTerm,
  setSearchTerm,
  nowaPiesnAll,
  songsPlEnAll,
  filteredNowaPiesn,
  filteredSongsPlEn,
  selectedItems,
  onShow,
  onSelect,
}: SongListsProps) {
  const isSelected = (item: ApiItem) =>
    selectedItems.some((i) => i.id === item.id && i.source === item.source);

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="shrink-0 pt-2 px-2">
        <input
          type="text"
          placeholder="Search all songs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-border-secondary rounded focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary placeholder-text-muted"
        />
      </div>

      <div className="flex-1 flex flex-col gap-1 pb-2 mt-1 min-h-0">
        <div className="flex-1 flex flex-col overflow-hidden">
          <h2 className="text-xs font-semibold text-text-primary px-2 py-0.5 bg-surface shrink-0">
            Nowa Pieśń ({filteredNowaPiesn.length})
          </h2>
          <div className="flex-1 overflow-y-auto px-2">
            <div className="space-y-0.5">
              {filteredNowaPiesn.map((item, index) => (
                <SongListRow
                  key={`${item.source}-${item.id}-${index}`}
                  item={item}
                  isSelected={isSelected(item)}
                  onShow={() => onShow(item)}
                  onSelect={() => onSelect(item)}
                />
              ))}
              {filteredNowaPiesn.length === 0 && nowaPiesnAll.length > 0 && (
                <p className="text-text-muted text-xs text-center py-2">
                  No results
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <h2 className="text-xs font-semibold text-text-primary px-2 py-0.5 bg-surface shrink-0">
            Songs PL/EN ({filteredSongsPlEn.length})
          </h2>
          <div className="flex-1 overflow-y-auto px-2">
            <div className="space-y-0.5">
              {filteredSongsPlEn.map((item, index) => (
                <SongListRow
                  key={`${item.source}-${item.id}-${index}`}
                  item={item}
                  isSelected={isSelected(item)}
                  onShow={() => onShow(item)}
                  onSelect={() => onSelect(item)}
                />
              ))}
              {filteredSongsPlEn.length === 0 && songsPlEnAll.length > 0 && (
                <p className="text-text-muted text-xs text-center py-2">
                  No results
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {nowaPiesnAll.length === 0 && songsPlEnAll.length === 0 && (
        <div className="px-4 pb-4">
          <p className="text-text-muted text-sm text-center py-4 bg-surface-secondary rounded">
            Loading data...
          </p>
        </div>
      )}
    </div>
  );
}
