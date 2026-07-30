"use client";

import type { ApiItem } from "../lib/types";
import { getSelectionTitle } from "../lib/songAdapter";
import Icon from "./Icon";

interface SelectionHeaderProps {
  currentSong: ApiItem | null;
  onUnselect: () => void;
  onRestoreSelection: () => void;
  canRestoreSelection: boolean;
}

export default function SelectionHeader({
  currentSong,
  onUnselect,
  onRestoreSelection,
  canRestoreSelection,
}: SelectionHeaderProps) {
  const { main, sub } = getSelectionTitle(currentSong);
  return (
    <div className="shrink-0 flex items-center gap-1.5 px-4 pt-3 pb-2">
      <div className="min-w-0 flex-1">
        <h2
          className="text-lg font-semibold text-text-primary truncate"
          title={sub ? `${main} — ${sub}` : main}
        >
          {main}
        </h2>
        {sub && (
          <span className="block text-[11px] text-text-muted truncate">
            {sub}
          </span>
        )}
      </div>
      <button
        onClick={onRestoreSelection}
        disabled={!canRestoreSelection}
        title={
          canRestoreSelection
            ? "Put back what you just unselected"
            : "Nothing to put back"
        }
        className="w-7 h-7 shrink-0 flex items-center justify-center rounded border border-border-secondary text-text-secondary transition-colors enabled:hover:bg-primary enabled:hover:text-white enabled:hover:border-primary disabled:opacity-40"
      >
        <Icon name="Undo2" size={13} />
      </button>
      <button
        onClick={onUnselect}
        disabled={!currentSong}
        title={
          currentSong
            ? "Unselect — clears this list and both outputs"
            : "Nothing is selected"
        }
        className="px-2.5 py-1 shrink-0 text-xs font-semibold rounded border border-border-secondary text-text-secondary transition-colors enabled:hover:bg-surface-hover enabled:hover:text-text-primary disabled:opacity-40"
      >
        Unselect
      </button>
    </div>
  );
}
