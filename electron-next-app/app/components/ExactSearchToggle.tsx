"use client";

import { useI18n } from "../lib/i18n/context";
import Icon from "./Icon";

interface ExactSearchToggleProps {
  exact: boolean;
  onChange: (exact: boolean) => void;
}

export default function ExactSearchToggle({
  exact,
  onChange,
}: ExactSearchToggleProps) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => onChange(!exact)}
      title={exact ? t.exactSearch.on : t.exactSearch.off}
      aria-pressed={exact}
      className={`shrink-0 w-7 h-[26px] flex items-center justify-center rounded border transition-colors ${
        exact
          ? "border-primary bg-primary text-white"
          : "border-border-secondary text-text-muted hover:text-text-primary hover:border-primary/60"
      }`}
    >
      <Icon name="Quote" size={13} />
    </button>
  );
}
