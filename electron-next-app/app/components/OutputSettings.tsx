"use client";

import { useEffect, useRef, useState } from "react";
import Checkbox from "./Checkbox";
import Icon from "./Icon";

const SLIDER_CLASS = `flex-1 min-w-0 h-3 appearance-none bg-transparent cursor-pointer outline-none
  [&::-webkit-slider-runnable-track]:h-0.75 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border-secondary
  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:-mt-[4.5px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary`;

interface OutputSettingsProps {
  fadeMs: number;
  onChangeFadeMs: (value: number) => void;
  bibleScale: number;
  onChangeBibleScale: (value: number) => void;
  messageScale: number;
  onChangeMessageScale: (value: number) => void;
  tightLabels: boolean;
  onChangeTightLabels: (value: boolean) => void;
}

function Row({
  label,
  min,
  max,
  step,
  unit,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] text-text-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={SLIDER_CLASS}
      />
      <span className="w-10 shrink-0 text-right text-[10px] font-mono tabular-nums text-text-secondary">
        {value}
        {unit}
      </span>
    </div>
  );
}

export default function OutputSettings({
  fadeMs,
  onChangeFadeMs,
  bibleScale,
  onChangeBibleScale,
  messageScale,
  onChangeMessageScale,
  tightLabels,
  onChangeTightLabels,
}: OutputSettingsProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Output settings"
        className="w-7 h-7 flex items-center justify-center rounded border border-border text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
      >
        <Icon name="Settings" size={13} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-30 w-64 p-2.5 space-y-1.5 bg-surface border border-border-secondary rounded-md shadow-xl">
          <Row
            label="Fade"
            min={0}
            max={1200}
            step={20}
            unit="ms"
            value={fadeMs}
            onChange={onChangeFadeMs}
          />
          <Row
            label="Bible text"
            min={40}
            max={200}
            step={5}
            unit="%"
            value={bibleScale}
            onChange={onChangeBibleScale}
          />
          <Row
            label="Sermon text"
            min={40}
            max={200}
            step={5}
            unit="%"
            value={messageScale}
            onChange={onChangeMessageScale}
          />
          <div className="pt-1">
            <Checkbox
              checked={tightLabels}
              onChange={onChangeTightLabels}
              label="Labels close to the text"
              hint="Bible and sermons: keeps the reference and the name next to the text instead of at the edges of the frame"
            />
          </div>
          <p className="pt-0.5 text-[10px] text-text-muted leading-snug">
            Fade is how long one slide takes to blend into the next. Bible text
            and Sermon text set how big a verse or a paragraph is allowed to get
            — longer ones still shrink to fit.
          </p>
        </div>
      )}
    </div>
  );
}
