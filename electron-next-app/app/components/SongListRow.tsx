"use client";

import type { ApiItem } from "../lib/types";
import type { HighlightResult } from "../lib/searchHighlight";
import HighlightedText from "./HighlightedText";
import Icon from "./Icon";

interface SongListRowProps {
  item: ApiItem;
  isSelected: boolean;
  onShow: () => void;
  onSelect: () => void;
  onEdit?: () => void;
  showId?: boolean;
  /** Zvýraznění matchnutých výrazů v title — vázané na aktivní search. */
  titleHl?: HighlightResult;
  /** Snippet z fullText s highlighty — zobrazí se pod titulem při searchi. */
  bodyHl?: HighlightResult;
}

export default function SongListRow({
  item,
  isSelected,
  onShow,
  onSelect,
  onEdit,
  showId = true,
  titleHl,
  bodyHl,
}: SongListRowProps) {
  const hasSnippet = bodyHl && bodyHl.segments.some((s) => s.hit);
  return (
    <div
      onClick={onShow}
      className={`flex justify-between items-${hasSnippet ? "start" : "center"} gap-2 px-2 ${hasSnippet ? "py-1" : "py-0"} bg-surface-secondary rounded border border-border hover:bg-border transition-colors cursor-pointer leading-tight`}
    >
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          {showId && (
            <span className="text-xs font-semibold text-primary shrink-0">
              {item.id}.
            </span>
          )}
          <span className="text-xs text-text-secondary truncate">
            {titleHl ? <HighlightedText result={titleHl} fallback={item.text} /> : item.text}
          </span>
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
          className="w-5 h-5 flex items-center justify-center rounded text-primary hover:bg-primary hover:text-white transition-colors disabled:text-disabled disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          <Icon name={isSelected ? "Check" : "ListPlus"} size={12} />
        </button>
      </div>
    </div>
  );
}
