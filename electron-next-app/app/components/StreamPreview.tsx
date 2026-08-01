"use client";

import type { DisplayInfo } from "../lib/types";
import OutputSettings from "./OutputSettings";
import MonitorPicker from "./MonitorPicker";
import OutputFrame from "./OutputFrame";

interface StreamPreviewProps {
  html: string;
  positionText: string;
  blackoutActive: boolean;
  bg: string;
  displays: DisplayInfo[];
  selectedDisplayId: number | null;
  setSelectedDisplayId: (id: number | null) => void;
  hdmiActive: boolean;
  onToggleHdmi: () => void;
  onRefreshDisplays: () => void;
  dividerWidth?: number;
  fadeMs: number;
  onChangeFadeMs: (value: number) => void;
  bibleScale: number;
  onChangeBibleScale: (value: number) => void;
  messageScale: number;
  onChangeMessageScale: (value: number) => void;
  tightLabels: boolean;
  onChangeTightLabels: (value: boolean) => void;
}

export default function StreamPreview({
  html,
  positionText,
  blackoutActive,
  bg,
  displays,
  selectedDisplayId,
  setSelectedDisplayId,
  hdmiActive,
  onToggleHdmi,
  onRefreshDisplays,
  dividerWidth,
  fadeMs,
  onChangeFadeMs,
  bibleScale,
  onChangeBibleScale,
  messageScale,
  onChangeMessageScale,
  tightLabels,
  onChangeTightLabels,
}: StreamPreviewProps) {
  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-semibold text-text-primary">Stream</h2>
        <MonitorPicker
          displays={displays}
          selectedDisplayId={selectedDisplayId}
          onSelectDisplayId={setSelectedDisplayId}
          onRefreshDisplays={onRefreshDisplays}
          hdmiActive={hdmiActive}
          onToggleHdmi={onToggleHdmi}
        />
        <OutputSettings
          fadeMs={fadeMs}
          onChangeFadeMs={onChangeFadeMs}
          bibleScale={bibleScale}
          onChangeBibleScale={onChangeBibleScale}
          messageScale={messageScale}
          onChangeMessageScale={onChangeMessageScale}
          tightLabels={tightLabels}
          onChangeTightLabels={onChangeTightLabels}
        />
      </div>
      <div className="border border-border rounded overflow-hidden">
        <OutputFrame
          html={html}
          blackout={blackoutActive}
          bg={bg}
          dividerWidth={dividerWidth}
          fadeMs={fadeMs}
          bibleScale={bibleScale}
          messageScale={messageScale}
          tightLabels={tightLabels}
        />
      </div>
      <div className="mt-2 h-7 flex justify-end items-center">
        <span className="text-xs text-text-muted">{positionText}</span>
      </div>
    </div>
  );
}
