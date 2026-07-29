"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  className?: string;
}

export default function Toggle({
  checked,
  onChange,
  label,
  description,
  className = "",
}: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between gap-3 w-full text-left ${className}`}
    >
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold text-text-primary">
          {label}
        </span>
        {description && (
          <span className="block text-[10px] text-text-muted leading-snug">
            {description}
          </span>
        )}
      </span>
      <span
        className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-border-secondary"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
