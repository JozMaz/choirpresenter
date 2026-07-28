"use client";

import type { DisplayInfo } from "../lib/types";
import Icon from "./Icon";
import MonitorPicker from "./MonitorPicker";
import OutputFrame from "./OutputFrame";

interface LocalPreviewProps {
  html: string;
  blackoutActive: boolean;
  onToggleBlackout: () => void;
  displays: DisplayInfo[];
  selectedDisplayId: number | null;
  setSelectedDisplayId: (id: number | null) => void;
  hdmiActive: boolean;
  onToggleHdmi: () => void;
  onRefreshDisplays: () => void;
}

export default function LocalPreview({
  html,
  blackoutActive,
  onToggleBlackout,
  displays,
  selectedDisplayId,
  setSelectedDisplayId,
  hdmiActive,
  onToggleHdmi,
  onRefreshDisplays,
}: LocalPreviewProps) {
  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-semibold text-text-primary">Local</h2>
        <MonitorPicker
          displays={displays}
          selectedDisplayId={selectedDisplayId}
          onSelectDisplayId={setSelectedDisplayId}
          onRefreshDisplays={onRefreshDisplays}
          hdmiActive={hdmiActive}
          onToggleHdmi={onToggleHdmi}
        />
      </div>
      <div className="border border-border rounded overflow-hidden">
        <OutputFrame html={html} blackout={blackoutActive} />
      </div>
      <div className="mt-2 h-7 flex justify-start items-center">
        <button
          onClick={onToggleBlackout}
          title={blackoutActive ? "Show text" : "Hide text (blackout)"}
          className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
            blackoutActive
              ? "bg-primary text-white hover:bg-primary-hover"
              : "text-text-secondary hover:bg-surface-secondary"
          }`}
        >
          <Icon name="Moon" size={16} />
        </button>
      </div>
    </div>
  );
}
