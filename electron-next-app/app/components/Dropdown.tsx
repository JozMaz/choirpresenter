"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

export interface DropdownOption<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface DropdownProps<T extends string | number> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
}

export default function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
  placeholder = "—",
  className = "",
  buttonClassName = "",
}: DropdownProps<T>) {
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

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-1 px-2 py-1 text-xs rounded border border-border-secondary bg-surface text-text-primary hover:bg-surface-hover disabled:opacity-60 transition-colors ${buttonClassName}`}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <Icon
          name={open ? "ChevronUp" : "ChevronDown"}
          size={12}
          className="shrink-0 text-text-muted"
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-40 min-w-full max-h-56 overflow-y-auto bg-surface border border-border-secondary rounded-md shadow-xl">
          {options.map((o) => {
            const isSel = o.value === value;
            return (
              <button
                key={String(o.value)}
                type="button"
                disabled={o.disabled}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-left transition-colors ${
                  isSel
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:bg-surface-hover"
                } disabled:opacity-40 disabled:hover:bg-transparent`}
              >
                <span className="truncate">{o.label}</span>
                {isSel && <Icon name="Check" size={12} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
