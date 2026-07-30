"use client";

import Icon from "./Icon";

interface TopBarProps {
  onOpenSettings: () => void;
}

export default function TopBar({ onOpenSettings }: TopBarProps) {
  return (
    <header className="shrink-0 h-10 flex items-center justify-between px-3 border-b border-border bg-surface">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            className="w-3.5 h-3.5 text-white"
            fill="currentColor"
            aria-hidden
          >
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
          </svg>
        </span>
        <span className="text-sm font-semibold text-text-primary">
          ChoirPresenter
        </span>
      </div>
      <button
        onClick={onOpenSettings}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        title="Settings"
      >
        <Icon name="Settings" size={16} />
        <span className="text-xs font-semibold">Settings</span>
      </button>
    </header>
  );
}
