"use client";

import type { ApiItem, SongSource } from "../lib/types";
import Icon from "./Icon";
import SongListRow from "./SongListRow";

interface SelectedPanelProps {
  customSongs: ApiItem[];
  selectedItems: ApiItem[];
  onShow: (item: ApiItem) => void;
  onSelect: (item: ApiItem) => void;
  onRemove: (id: number, source: SongSource) => void;
  onClearAll: () => void;
}

const sourceLabel = (source: SongSource): string => {
  if (source === "newSong") return "NS";
  if (source === "newSongPlGb") return "NS-EN";
  if (source === "pielgrzym") return "Pi";
  if (source === "roboczy") return "Ro";
  if (source === "children") return "Ch";
  if (source === "custom") return "My";
  return "PL/EN";
};

export default function SelectedPanel({
  customSongs,
  selectedItems,
  onShow,
  onSelect,
  onRemove,
  onClearAll,
}: SelectedPanelProps) {
  const isSelected = (item: ApiItem) =>
    selectedItems.some((i) => i.id === item.id && i.source === item.source);

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      {customSongs.length > 0 && (
        <div className="shrink-0 px-2 pt-2">
          <h2 className="text-xs font-semibold text-text-primary mb-1">
            My Songs ({customSongs.length})
          </h2>
          <div className="space-y-0.5 max-h-50 overflow-y-auto">
            {customSongs.map((item) => (
              <SongListRow
                key={`custom-${item.id}`}
                item={item}
                isSelected={isSelected(item)}
                onShow={() => onShow(item)}
                onSelect={() => onSelect(item)}
                showId={false}
              />
            ))}
          </div>
          <div className="border-t border-border mt-2"></div>
        </div>
      )}

      <div className="flex-1 p-2 overflow-auto">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-xs font-semibold text-text-primary">
            Selected songs ({selectedItems.length})
          </h2>
          {selectedItems.length > 0 && (
            <button
              onClick={() => {
                if (confirm(`Clear all ${selectedItems.length} selected songs?`))
                  onClearAll();
              }}
              title="Clear all selected"
              className="px-2 py-0.5 text-[10px] font-semibold text-danger hover:bg-danger hover:text-white rounded transition-colors flex items-center gap-1"
            >
              <Icon name="Trash2" size={11} />
              Clear all
            </button>
          )}
        </div>

        <div className="space-y-1">
          {selectedItems.map((item) => (
            <div
              key={`${item.source}-${item.id}`}
              onClick={() => onShow(item)}
              className="flex justify-between items-center px-2 py-1 bg-surface-secondary rounded border border-border hover:bg-border transition-colors cursor-pointer"
            >
              <span className="text-xs text-text-primary truncate">
                [{sourceLabel(item.source)}] {item.text}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id, item.source);
                }}
                title="Remove from selection"
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-danger hover:bg-danger hover:text-white transition-colors"
              >
                <Icon name="X" size={14} />
              </button>
            </div>
          ))}
          {selectedItems.length === 0 && (
            <p className="text-text-muted text-xs text-center py-2">
              No selected songs
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
