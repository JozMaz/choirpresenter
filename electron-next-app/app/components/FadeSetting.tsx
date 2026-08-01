"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

const FADE_SLIDER_CLASS = `flex-1 min-w-0 h-3 appearance-none bg-transparent cursor-pointer outline-none
  [&::-webkit-slider-runnable-track]:h-0.75 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border-secondary
  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:-mt-[4.5px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary`;

const FADE_MIN = 0;
const FADE_MAX = 1200;
const FADE_STEP = 20;

interface FadeSettingProps {
  value: number;
  onChange: (value: number) => void;
}

export default function FadeSetting({ value, onChange }: FadeSettingProps) {
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
        title="Crossfade speed"
        className="w-7 h-7 flex items-center justify-center rounded border border-border text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
      >
        <Icon name="Settings" size={13} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-30 w-56 p-2.5 bg-surface border border-border-secondary rounded-md shadow-xl">
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-[10px] text-text-muted">
              Fade
            </span>
            <input
              type="range"
              min={FADE_MIN}
              max={FADE_MAX}
              step={FADE_STEP}
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              className={FADE_SLIDER_CLASS}
            />
            <span className="w-10 shrink-0 text-right text-[10px] font-mono tabular-nums text-text-secondary">
              {value}ms
            </span>
          </div>
          <p className="mt-1.5 text-[10px] text-text-muted leading-snug">
            How long one slide takes to fade into the next on this output. Zero
            switches instantly.
          </p>
        </div>
      )}
    </div>
  );
}
