"use client";

import Icon from "./Icon";

interface ActionBarProps {
  hasSong: boolean;
  blackoutActive: boolean;
  onToggleBlackout: () => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onAddToSelected?: () => void;
  isInSelected?: boolean;
  onStartNewSong?: () => void;
  onEditCurrentSong?: () => void;
  saveStatus?: "idle" | "saving" | "saved" | "local" | "error";
  saveDetail?: string | null;
}

export default function ActionBar({
  hasSong,
  blackoutActive,
  onToggleBlackout,
  onNavigatePrev,
  onNavigateNext,
  onAddToSelected,
  isInSelected,
  onStartNewSong,
  onEditCurrentSong,
  saveStatus = "idle",
  saveDetail = null,
}: ActionBarProps) {
  return (
    <div className="shrink-0 flex justify-between items-center px-4 pt-2 pb-1">
      <div className="flex items-center gap-2">
        {hasSong && (
          <>
            <button
              onClick={onNavigatePrev}
              className="w-7 h-7 flex items-center justify-center rounded-full text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
              title="Previous section (←/↑)"
            >
              <Icon name="ChevronLeft" size={16} />
            </button>
            <button
              onClick={onNavigateNext}
              className="w-7 h-7 flex items-center justify-center rounded-full text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
              title="Next section (→/↓)"
            >
              <Icon name="ChevronRight" size={16} />
            </button>
          </>
        )}
        <button
          onClick={onToggleBlackout}
          title={blackoutActive ? "Show text (X)" : "Hide text (X)"}
          className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
            blackoutActive
              ? "bg-primary text-white hover:bg-primary-hover"
              : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          }`}
        >
          <Icon name="Moon" size={15} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        {saveStatus === "saving" && (
          <span
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-text-secondary"
            title={saveDetail ?? "Saving to cloud..."}
          >
            <Icon name="Loader" size={12} className="animate-spin" />
            <span className="truncate max-w-72">{saveDetail ?? "Saving…"}</span>
          </span>
        )}
        {saveStatus === "saved" && (
          <span
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-success"
            title={saveDetail ?? "Synced to cloud"}
          >
            <Icon name="Check" size={12} />
            <span className="truncate max-w-72">{saveDetail ?? "Saved"}</span>
          </span>
        )}
        {saveStatus === "local" && (
          <span
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-text-secondary"
            title={
              saveDetail ??
              "No write token — saved only on this device. Open Settings to add a token."
            }
          >
            <Icon name="HardDrive" size={12} />
            <span className="truncate max-w-72">
              {saveDetail ?? "Local only"}
            </span>
          </span>
        )}
        {saveStatus === "error" && (
          <span
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-danger"
            title={
              saveDetail ??
              "Cloud sync failed — check internet or your write token"
            }
          >
            <Icon name="TriangleAlert" size={12} />
            <span className="truncate max-w-72">
              {saveDetail ?? "Cloud failed"}
            </span>
          </span>
        )}
        {hasSong && onAddToSelected && (
          <button
            onClick={onAddToSelected}
            disabled={isInSelected}
            className={`w-8 h-8 flex items-center justify-center rounded-full border transition-colors ${
              isInSelected
                ? "bg-success/15 border-success/40 text-success cursor-default"
                : "bg-surface-secondary border-border text-text-secondary hover:bg-primary hover:text-white hover:border-primary"
            }`}
            title={
              isInSelected
                ? "Already in selected songs"
                : "Add to selected songs"
            }
          >
            <Icon name={isInSelected ? "Check" : "ListPlus"} size={15} />
          </button>
        )}
        {hasSong && onEditCurrentSong && (
          <button
            onClick={onEditCurrentSong}
            className="w-8 h-8 flex items-center justify-center bg-surface-secondary border border-border text-text-secondary rounded-full hover:bg-primary hover:text-white hover:border-primary transition-colors"
            title="Edit current song"
          >
            <Icon name="Pencil" size={14} />
          </button>
        )}
        {onStartNewSong && (
          <button
            onClick={onStartNewSong}
            className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded-full text-lg hover:bg-primary-hover transition-colors"
            title="Add new song"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
