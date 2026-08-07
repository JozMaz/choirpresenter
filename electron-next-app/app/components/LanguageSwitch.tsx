"use client";

import { LANGUAGES } from "../lib/i18n";
import { useI18n } from "../lib/i18n/context";

export default function LanguageSwitch({
  className = "",
}: {
  className?: string;
}) {
  const { lang, setLang } = useI18n();
  return (
    <div
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-surface-secondary ${className}`}
    >
      {LANGUAGES.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => setLang(option.code)}
          className={`px-2.5 py-0.5 text-[11px] font-semibold rounded transition-colors ${
            lang === option.code
              ? "bg-primary text-white"
              : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
