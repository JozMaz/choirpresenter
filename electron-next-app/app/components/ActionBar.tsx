"use client";

import { useI18n } from "../lib/i18n/context";
import Icon from "./Icon";

interface ActionBarProps {
  hasSong: boolean;
  blackoutActive: boolean;
  onToggleBlackout: () => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onToggleSelected?: () => void;
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
  onToggleSelected,
  isInSelected,
  onStartNewSong,
  onEditCurrentSong,
  saveStatus = "idle",
  saveDetail = null,
}: ActionBarProps) {
  const { t } = useI18n();
  return (
    <div className="shrink-0 flex items-center px-4 py-2">
      <div className="flex-1 flex items-center gap-2">
        {saveStatus === "saving" && (
          <span
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-text-secondary"
            title={saveDetail ?? t.saveStatus.savingToCloud}
          >
            <Icon name="Loader" size={12} className="animate-spin" />
            <span className="truncate max-w-72">
              {saveDetail ?? t.saveStatus.savingShort}
            </span>
          </span>
        )}
        {saveStatus === "saved" && (
          <span
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-success"
            title={saveDetail ?? t.saveStatus.syncedToCloud}
          >
            <Icon name="Check" size={12} />
            <span className="truncate max-w-72">
              {saveDetail ?? t.saveStatus.saved}
            </span>
          </span>
        )}
        {saveStatus === "local" && (
          <span
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-text-secondary"
            title={saveDetail ?? t.saveStatus.localOnlyHint}
          >
            <Icon name="HardDrive" size={12} />
            <span className="truncate max-w-72">
              {saveDetail ?? t.saveStatus.localOnly}
            </span>
          </span>
        )}
        {saveStatus === "error" && (
          <span
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-danger"
            title={saveDetail ?? t.saveStatus.cloudFailedHint}
          >
            <Icon name="TriangleAlert" size={12} />
            <span className="truncate max-w-72">
              {saveDetail ?? t.saveStatus.cloudFailed}
            </span>
          </span>
        )}
        {hasSong && onToggleSelected && (
          <button
            onClick={onToggleSelected}
            className={`w-8 h-8 flex items-center justify-center rounded-full border transition-colors ${
              isInSelected
                ? "bg-success/15 border-success/40 text-success hover:bg-danger hover:border-danger hover:text-white"
                : "bg-surface-secondary border-border text-text-secondary hover:bg-primary hover:text-white hover:border-primary"
            }`}
            title={
              isInSelected
                ? t.actionBar.removeFromSelected
                : t.actionBar.addToSelected
            }
          >
            <Icon name={isInSelected ? "Check" : "ListPlus"} size={15} />
          </button>
        )}
        {hasSong && onEditCurrentSong && (
          <button
            onClick={onEditCurrentSong}
            className="w-8 h-8 flex items-center justify-center bg-surface-secondary border border-border text-text-secondary rounded-full hover:bg-primary hover:text-white hover:border-primary transition-colors"
            title={t.actionBar.editCurrentSong}
          >
            <Icon name="Pencil" size={14} />
          </button>
        )}
        {onStartNewSong && (
          <button
            onClick={onStartNewSong}
            className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded-full text-lg hover:bg-primary-hover transition-colors"
            title={t.actionBar.addNewSong}
          >
            +
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {hasSong && (
          <>
            <button
              onClick={onNavigatePrev}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-secondary border border-border text-text-secondary hover:bg-primary hover:text-white hover:border-primary transition-colors"
              title={t.actionBar.previousPart}
            >
              <Icon name="ChevronLeft" size={16} />
            </button>
            <button
              onClick={onNavigateNext}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-secondary border border-border text-text-secondary hover:bg-primary hover:text-white hover:border-primary transition-colors"
              title={t.actionBar.nextPart}
            >
              <Icon name="ChevronRight" size={16} />
            </button>
          </>
        )}
      </div>
      <div className="flex-1 flex items-center justify-end">
        <button
          onClick={onToggleBlackout}
          title={
            blackoutActive ? t.actionBar.showText : t.actionBar.hideText
          }
          className={`w-8 h-8 flex items-center justify-center rounded-full border transition-colors ${
            blackoutActive
              ? "bg-primary border-primary text-white hover:bg-primary-hover"
              : "bg-surface-secondary border-border text-text-secondary hover:bg-primary hover:text-white hover:border-primary"
          }`}
        >
          <Icon name="Moon" size={15} />
        </button>
      </div>
    </div>
  );
}
