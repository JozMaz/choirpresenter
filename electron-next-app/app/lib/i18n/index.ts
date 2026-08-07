import { en, type Dict } from "./en";
import { pl } from "./pl";

export type { Dict } from "./en";
export type Lang = "en" | "pl";

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pl", label: "Polski" },
];

export const DICTIONARIES: Record<Lang, Dict> = { en, pl };

export const DEFAULT_LANG: Lang = "en";

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "pl";
}

export function detectLang(): Lang {
  if (typeof navigator === "undefined") return DEFAULT_LANG;
  return navigator.languages?.some((l) => l.toLowerCase().startsWith("pl")) ||
    navigator.language?.toLowerCase().startsWith("pl")
    ? "pl"
    : DEFAULT_LANG;
}

export function readLang(raw: string | null): Lang {
  return isLang(raw) ? raw : detectLang();
}
