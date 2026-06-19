"use client";

import type { DisplayInfo } from "../lib/types";

interface MonitorPickerProps {
  displays: DisplayInfo[];
  selectedDisplayId: number | null;
  onSelectDisplayId: (id: number | null) => void;
  onRefreshDisplays: () => void;
  hdmiActive: boolean;
  onToggleHdmi: () => void;
}

export default function MonitorPicker({
  displays,
  selectedDisplayId,
  onSelectDisplayId,
  onRefreshDisplays,
  hdmiActive,
  onToggleHdmi,
}: MonitorPickerProps) {
  return (
    <>
      <select
        className="ml-auto text-xs px-1 py-0.5 rounded border border-border-secondary bg-surface text-text-primary"
        value={selectedDisplayId ?? ""}
        onMouseDown={onRefreshDisplays}
        onChange={(e) =>
          onSelectDisplayId(e.target.value ? Number(e.target.value) : null)
        }
      >
        <option value="">Monitor…</option>
        {displays.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
            {d.primary ? " (primary)" : ""}
          </option>
        ))}
      </select>
      <button
        disabled={!selectedDisplayId}
        onClick={onToggleHdmi}
        className={`text-xs px-2 py-0.5 rounded font-medium ${
          hdmiActive
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-primary hover:bg-primary-hover text-white disabled:opacity-40 disabled:cursor-not-allowed"
        }`}
      >
        {hdmiActive ? "Stop" : "HDMI"}
      </button>
    </>
  );
}
