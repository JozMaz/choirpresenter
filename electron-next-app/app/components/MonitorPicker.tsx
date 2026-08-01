"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DisplayInfo } from "../lib/types";
import Icon from "./Icon";

interface MonitorPickerProps {
  displays: DisplayInfo[];
  selectedDisplayId: number | null;
  onSelectDisplayId: (id: number | null) => void;
  onRefreshDisplays: () => void;
  hdmiActive: boolean;
  onToggleHdmi: () => void;
}

const resolution = (d: DisplayInfo) => `${d.bounds.width}×${d.bounds.height}`;

const MENU_WIDTH = 224;
const VIEWPORT_MARGIN = 8;

export default function MonitorPicker({
  displays,
  selectedDisplayId,
  onSelectDisplayId,
  onRefreshDisplays,
  hdmiActive,
  onToggleHdmi,
}: MonitorPickerProps) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const available = useMemo(
    () => displays.filter((d) => !d.isCurrent),
    [displays],
  );
  const selected = available.find((d) => d.id === selectedDisplayId) ?? null;

  useEffect(() => {
    if (
      selectedDisplayId !== null &&
      !available.some((d) => d.id === selectedDisplayId)
    ) {
      onSelectDisplayId(null);
    }
  }, [available, selectedDisplayId, onSelectDisplayId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleOpen = () => {
    if (!open) {
      onRefreshDisplays();
      const rect = rootRef.current?.getBoundingClientRect();
      setAlignRight(
        rect !== undefined &&
          rect.left + MENU_WIDTH > window.innerWidth - VIEWPORT_MARGIN,
      );
    }
    setOpen((v) => !v);
  };

  return (
    <div ref={rootRef} className="ml-auto relative flex items-center gap-2">
      <button
        onClick={toggleOpen}
        disabled={hdmiActive}
        title={
          hdmiActive ? "Stop the output to change monitor" : "Choose monitor"
        }
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-border-secondary bg-surface text-text-primary hover:bg-surface-hover disabled:opacity-50 transition-colors"
      >
        <Icon name="Monitor" size={13} />
        <span className="truncate max-w-32">
          {selected ? selected.label : "Choose monitor"}
        </span>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={13} />
      </button>

      {open && (
        <div
          className={`absolute top-full mt-1 z-30 w-56 bg-surface border border-border-secondary rounded-md shadow-xl overflow-hidden ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          {available.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-text-muted leading-relaxed">
              No other monitor connected.
              <span className="block text-text-secondary mt-0.5">
                Connect a projector or a second screen.
              </span>
            </p>
          ) : (
            available.map((d) => {
              const isSel = d.id === selectedDisplayId;
              return (
                <button
                  key={d.id}
                  onClick={() => {
                    onSelectDisplayId(d.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    isSel
                      ? "bg-primary text-white"
                      : "text-text-secondary hover:bg-surface-hover"
                  }`}
                >
                  <Icon name="Monitor" size={14} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold truncate">
                      {d.label}
                    </span>
                    <span
                      className={`block text-[10px] ${
                        isSel ? "text-white/70" : "text-text-muted"
                      }`}
                    >
                      {resolution(d)}
                    </span>
                  </span>
                  {isSel && <Icon name="Check" size={14} />}
                </button>
              );
            })
          )}
        </div>
      )}

      <button
        disabled={!selected}
        onClick={onToggleHdmi}
        className={`text-xs px-2 py-1 rounded font-semibold transition-colors ${
          hdmiActive
            ? "bg-danger hover:bg-danger-hover text-white"
            : "bg-primary hover:bg-primary-hover text-white disabled:opacity-40"
        }`}
      >
        {hdmiActive ? "Stop" : "Start"}
      </button>
    </div>
  );
}
