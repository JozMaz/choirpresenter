"use client";

import type { ApiItem } from "../lib/types";
import { useState } from "react";
import {
  entryTitle,
  songEntryKey,
  type SelectedEntry,
} from "../lib/selection";
import { useI18n } from "../lib/i18n/context";
import Icon, { type IconName } from "./Icon";
import SongListRow from "./SongListRow";
import ConfirmDialog from "./ConfirmDialog";

interface SelectedPanelProps {
  customSongs: ApiItem[];
  entries: SelectedEntry[];
  activeKey: string | null;
  liveKey: string | null;
  selectedKeys: Set<string>;
  onOpen: (entry: SelectedEntry, goLive: boolean) => void;
  onShow: (item: ApiItem) => void;
  onPlay: (item: ApiItem) => void;
  onSelect: (item: ApiItem) => void;
  onRemove: (key: string) => void;
  onReorder: (fromKey: string, toKey: string) => void;
  onClearAll: () => void;
}

const KIND_ICON: Record<SelectedEntry["kind"], IconName> = {
  song: "Music",
  bible: "BookOpen",
  message: "Mic",
};

export default function SelectedPanel({
  customSongs,
  entries,
  activeKey,
  liveKey,
  selectedKeys,
  onOpen,
  onShow,
  onPlay,
  onSelect,
  onRemove,
  onReorder,
  onClearAll,
}: SelectedPanelProps) {
  const { t } = useI18n();
  const [confirmClear, setConfirmClear] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const endDrag = () => {
    setDragKey(null);
    setOverKey(null);
  };

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <ConfirmDialog
        open={confirmClear}
        title={t.selectedPanel.confirmClearTitle}
        message={t.selectedPanel.confirmClearMessage(entries.length)}
        confirmLabel={t.selectedPanel.clearAll}
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
            {t.selectedPanel.mySongsCount(customSongs.length)}
          </h2>
          <div className="space-y-0.5 max-h-50 overflow-y-auto">
            {customSongs.map((item) => (
              <SongListRow
                key={`custom-${item.id}`}
                item={item}
                isSelected={selectedKeys.has(songEntryKey("custom", item.id))}
                isActive={activeKey === songEntryKey("custom", item.id)}
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
            {t.selectedPanel.selectedCount(entries.length)}
          </h2>
          {entries.length > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              title={t.selectedPanel.clearAllHint}
              className="px-2 py-0.5 text-[10px] font-semibold text-danger hover:bg-danger hover:text-white rounded transition-colors flex items-center gap-1"
            >
              <Icon name="Trash2" size={11} />
              {t.selectedPanel.clearAll}
            </button>
          )}
        </div>

        <div className="space-y-0.5">
          {entries.map((entry) => {
            const { main, sub } = entryTitle(entry);
            const isLive = liveKey === entry.key;
            const isPreselected = activeKey === entry.key && !isLive;
            const isOver = overKey === entry.key && dragKey !== entry.key;
            return (
              <div
                key={entry.key}
                draggable
                onDragStart={(e) => {
                  setDragKey(entry.key);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overKey !== entry.key) setOverKey(entry.key);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragKey && dragKey !== entry.key) {
                    onReorder(dragKey, entry.key);
                  }
                  endDrag();
                }}
                onDragEnd={endDrag}
                onClick={() => onOpen(entry, false)}
                onDoubleClick={() => onOpen(entry, true)}
                title={t.selectedPanel.openOrGoLive}
                className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                  dragKey === entry.key ? "opacity-40" : ""
                } ${
                  isOver
                    ? "border-primary bg-primary/10"
                    : isLive
                      ? "bg-primary/20 border-primary"
                      : isPreselected
                        ? "bg-amber-500/15 border-amber-500/70"
                        : "bg-surface-secondary border-border hover:bg-surface-hover"
                }`}
              >
                <Icon
                  name="GripVertical"
                  size={12}
                  className="shrink-0 text-text-muted cursor-grab"
                />
                <Icon
                  name={KIND_ICON[entry.kind]}
                  size={11}
                  className="shrink-0 text-text-muted"
                />
                <span className="flex-1 min-w-0 flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold text-primary truncate">
                    {main}
                  </span>
                  {sub && (
                    <span className="text-[10px] text-text-muted truncate shrink-0 max-w-24">
                      {sub}
                    </span>
                  )}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(entry.key);
                  }}
                  title={t.selectedPanel.removeFromSelection}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-danger hover:bg-danger hover:text-white transition-colors"
                >
                  <Icon name="X" size={14} />
                </button>
              </div>
            );
          })}
          {entries.length === 0 && (
            <p className="text-text-muted text-xs text-center py-2">
              {t.selectedPanel.empty}
            </p>
          )}
          {entries.length > 1 && (
            <p className="text-text-muted text-[10px] text-center pt-1">
              {t.selectedPanel.reorderHint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
