"use client";

import type { ApiItem } from "../lib/types";
import type { HighlightResult } from "../lib/searchHighlight";
import HighlightedText from "./HighlightedText";
import Icon from "./Icon";

interface SongListRowProps {
  item: ApiItem;
  isSelected: boolean;
  isActive?: boolean;
  onShow: () => void;
  onPlay?: () => void;
  onSelect: () => void;
  onEdit?: () => void;
  showId?: boolean;
  titleHl?: HighlightResult;
  bodyHl?: HighlightResult;
  bookLabel?: string;
}

export default function SongListRow({
  item,
  isSelected,
  isActive = false,
  onShow,
  onPlay,
  onSelect,
  onEdit,
  showId = true,
  titleHl,
  bodyHl,
  bookLabel,
}: SongListRowProps) {
  const hasSnippet = bodyHl && bodyHl.segments.some((s) => s.hit);
  return (
    <div
      onClick={onShow}
      onDoubleClick={onPlay}
      title={onPlay ? "Click to open, double-click to show it live" : undefined}
      className={`flex justify-between items-${hasSnippet ? "start" : "center"} gap-2 px-2 ${hasSnippet ? "py-1" : "py-0"} rounded border transition-colors cursor-pointer leading-tight ${
        isActive
          ? "bg-primary/20 border-primary"
          : "bg-surface-secondary border-border hover:bg-surface-hover"
      }`}
    >
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          {showId && item.number !== null && (
            <span className="text-xs font-semibold text-primary shrink-0">
              {item.number}.
            </span>
          )}
          <span className="text-xs text-text-secondary truncate">
            {titleHl ? (
              <HighlightedText result={titleHl} fallback={item.title} />
            ) : (
              item.title
            )}
          </span>
          {bookLabel && (
            <span className="text-[9px] text-text-muted shrink-0 ml-auto">
              {bookLabel}
            </span>
          )}
        </div>
        {hasSnippet && (
          <span className="text-[11px] text-text-muted line-clamp-2 leading-snug pl-2">
            <HighlightedText result={bodyHl!} />
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Edit song"
            className="w-5 h-5 flex items-center justify-center rounded text-text-secondary hover:bg-text-secondary hover:text-white transition-colors"
          >
            <Icon name="Pencil" size={11} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isSelected) onSelect();
          }}
          disabled={isSelected}
          title={isSelected ? "Already selected" : "Add to selection"}
          className="w-5 h-5 flex items-center justify-center rounded text-primary hover:bg-primary hover:text-white transition-colors disabled:text-disabled disabled:hover:bg-transparent"
        >
          <Icon name={isSelected ? "Check" : "ListPlus"} size={12} />
        </button>
      </div>
    </div>
  );
}
