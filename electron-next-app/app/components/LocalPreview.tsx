"use client";

import type { DisplayInfo } from "../lib/types";
import FadeSetting from "./FadeSetting";
import MonitorPicker from "./MonitorPicker";
import OutputFrame from "./OutputFrame";

interface LocalPreviewProps {
  html: string;
  blackoutActive: boolean;
  displays: DisplayInfo[];
  selectedDisplayId: number | null;
  setSelectedDisplayId: (id: number | null) => void;
  hdmiActive: boolean;
  onToggleHdmi: () => void;
  onRefreshDisplays: () => void;
  dividerWidth?: number;
  fadeMs: number;
  onChangeFadeMs: (value: number) => void;
}

export default function LocalPreview({
  html,
  blackoutActive,
  displays,
  selectedDisplayId,
  setSelectedDisplayId,
  hdmiActive,
  onToggleHdmi,
  onRefreshDisplays,
  dividerWidth,
  fadeMs,
  onChangeFadeMs,
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
        <FadeSetting value={fadeMs} onChange={onChangeFadeMs} />
      </div>
      <div className="border border-border rounded overflow-hidden">
        <OutputFrame
          html={html}
          blackout={blackoutActive}
          dividerWidth={dividerWidth}
          fadeMs={fadeMs}
        />
      </div>
    </div>
  );
}
