"use client";

import Icon from "./Icon";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  hint?: string;
  className?: string;
}

export default function Checkbox({
  checked,
  onChange,
  label,
  hint,
  className = "",
}: CheckboxProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      title={hint}
      className={`flex items-center gap-1.5 text-left group ${className}`}
    >
      <span
        className={`w-4 h-4 shrink-0 rounded flex items-center justify-center border transition-colors ${
          checked
            ? "bg-primary border-primary text-white"
            : "bg-surface border-border-secondary group-hover:border-primary"
        }`}
      >
        {checked && <Icon name="Check" size={11} />}
      </span>
      <span className="text-[11px] text-text-secondary leading-snug">
        {label}
      </span>
    </button>
  );
}
