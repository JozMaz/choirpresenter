"use client";

import type { ApiItem, SongSource } from "../lib/types";
import { useState } from "react";
import Icon from "./Icon";
import SongListRow from "./SongListRow";
import ConfirmDialog from "./ConfirmDialog";

interface SelectedPanelProps {
  customSongs: ApiItem[];
  selectedItems: ApiItem[];
  activeItem: ApiItem | null;
  onShow: (item: ApiItem) => void;
  onPlay: (item: ApiItem) => void;
  onSelect: (item: ApiItem) => void;
  onRemove: (id: string, source: SongSource) => void;
  onClearAll: () => void;
}

export default function SelectedPanel({
  customSongs,
  selectedItems,
  activeItem,
  onShow,
  onPlay,
  onSelect,
  onRemove,
  onClearAll,
}: SelectedPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const isSelected = (item: ApiItem) =>
    selectedItems.some((i) => i.id === item.id && i.source === item.source);
  const isActive = (item: ApiItem) =>
    activeItem?.id === item.id && activeItem?.source === item.source;

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <ConfirmDialog
        open={confirmClear}
        title="Clear selected songs?"
        message={`All ${selectedItems.length} songs will be removed from the selection. The songs themselves stay in their songbooks.`}
        confirmLabel="Clear all"
        icon="Trash2"
        onConfirm={() => {
          onClearAll();
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
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
                isActive={isActive(item)}
                onShow={() => onShow(item)}
                onPlay={() => onPlay(item)}
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
              onClick={() => setConfirmClear(true)}
              title="Clear all selected"
              className="px-2 py-0.5 text-[10px] font-semibold text-danger hover:bg-danger hover:text-white rounded transition-colors flex items-center gap-1"
            >
              <Icon name="Trash2" size={11} />
              Clear all
            </button>
          )}
        </div>

        <div className="space-y-0.5">
          {selectedItems.map((item) => (
            <div
              key={`${item.source}-${item.id}`}
              onClick={() => onShow(item)}
              onDoubleClick={() => onPlay(item)}
              title="Click to open, double-click to show it live"
              className={`flex justify-between items-center gap-2 px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                isActive(item)
                  ? "bg-primary/20 border-primary"
                  : "bg-surface-secondary border-border hover:bg-surface-hover"
              }`}
            >
              <span className="text-xs font-semibold text-primary truncate flex-1 min-w-0">
                {item.number !== null ? `${item.number}. ` : ""}
                {item.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id, item.source);
                }}
                title="Remove from selection"
                className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-danger hover:bg-danger hover:text-white transition-colors"
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
