import { LS_KEYS } from "./constants";
import { DEFAULT_MAX_LINES } from "./slideSplit";
import type { ApiItem, SongSource } from "./types";

export type OutputScope = SongSource | "bible" | "messages";

export type OutputKey = "local" | "stream";

export type GroupMode =
  { kind: "section" } | { kind: "stored" } | { kind: "max"; lines: number };

export interface OutputChrome {
  header: boolean;
  sequence: boolean;
  footer: boolean;
  secondary: boolean;
}

export interface OutputSettings {
  group: GroupMode;
  chrome: OutputChrome;
}

export type OutputPair = Record<OutputKey, OutputSettings>;

export type OutputConfig = Record<OutputScope, OutputPair>;

export const OUTPUT_SCOPE_ORDER: OutputScope[] = [
  "newSong",
  "newSongPlGb",
  "pielgrzym",
  "roboczy",
  "children",
  "custom",
  "bible",
  "messages",
];

export const OUTPUT_KEYS: OutputKey[] = ["local", "stream"];

export const MIN_GROUP_LINES = 1;
export const MAX_GROUP_LINES = 8;

const songPair = (): OutputPair => ({
  local: {
    group: { kind: "section" },
    chrome: { header: true, sequence: true, footer: true, secondary: true },
  },
  stream: {
    group: { kind: "stored" },
    chrome: { header: false, sequence: false, footer: false, secondary: false },
  },
});

const readerPair = (header: boolean): OutputPair => ({
  local: {
    group: { kind: "section" },
    chrome: { header, sequence: false, footer: true, secondary: false },
  },
  stream: {
    group: { kind: "stored" },
    chrome: { header, sequence: false, footer: true, secondary: false },
  },
});

export const DEFAULT_OUTPUT_CONFIG: OutputConfig = {
  newSong: songPair(),
  newSongPlGb: songPair(),
  pielgrzym: songPair(),
  roboczy: songPair(),
  children: songPair(),
  custom: songPair(),
  bible: readerPair(true),
  messages: readerPair(false),
};

export function outputScopeFor(item: ApiItem): OutputScope {
  if (item.isBible) return "bible";
  if (item.isMessage) return "messages";
  return item.source;
}

export function outputSettingsFor(
  item: ApiItem,
  output: OutputKey,
  config: OutputConfig,
): OutputSettings {
  const scope = outputScopeFor(item);
  return (config[scope] ?? DEFAULT_OUTPUT_CONFIG[scope])[output];
}

function normalizeGroup(value: unknown, fallback: GroupMode): GroupMode {
  const raw = value as { kind?: string; lines?: unknown } | null;
  if (!raw || typeof raw.kind !== "string") return fallback;
  if (raw.kind === "section" || raw.kind === "stored")
    return { kind: raw.kind };
  if (raw.kind !== "max") return fallback;
  const lines = typeof raw.lines === "number" ? Math.round(raw.lines) : NaN;
  if (!Number.isFinite(lines)) return { kind: "max", lines: DEFAULT_MAX_LINES };
  return {
    kind: "max",
    lines: Math.min(MAX_GROUP_LINES, Math.max(MIN_GROUP_LINES, lines)),
  };
}

function normalizeChrome(value: unknown, fallback: OutputChrome): OutputChrome {
  const raw = (value ?? {}) as Partial<Record<keyof OutputChrome, unknown>>;
  const pick = (field: keyof OutputChrome) =>
    typeof raw[field] === "boolean" ? (raw[field] as boolean) : fallback[field];
  return {
    header: pick("header"),
    sequence: pick("sequence"),
    footer: pick("footer"),
    secondary: pick("secondary"),
  };
}

function normalizeConfig(value: unknown): OutputConfig {
  const raw = (value ?? {}) as Partial<
    Record<OutputScope, Partial<Record<OutputKey, unknown>>>
  >;
  const out = {} as OutputConfig;
  for (const scope of OUTPUT_SCOPE_ORDER) {
    const fallbackPair = DEFAULT_OUTPUT_CONFIG[scope];
    const rawPair = raw[scope] ?? {};
    out[scope] = {
      local: normalizeSettings(rawPair.local, fallbackPair.local),
      stream: normalizeSettings(rawPair.stream, fallbackPair.stream),
    };
  }
  return out;
}

function normalizeSettings(
  value: unknown,
  fallback: OutputSettings,
): OutputSettings {
  const raw = (value ?? {}) as { group?: unknown; chrome?: unknown };
  return {
    group: normalizeGroup(raw.group, fallback.group),
    chrome: normalizeChrome(raw.chrome, fallback.chrome),
  };
}

function withStreamSecondary(enabled: boolean): OutputConfig {
  const config = normalizeConfig(null);
  for (const scope of OUTPUT_SCOPE_ORDER) {
    config[scope].stream.chrome.secondary = enabled;
  }
  return config;
}

export function readOutputConfig(raw: string | null): OutputConfig {
  if (raw !== null) {
    try {
      return normalizeConfig(JSON.parse(raw));
    } catch {
      return normalizeConfig(null);
    }
  }
  try {
    const legacy = localStorage.getItem(LS_KEYS.legacyOut2SecondLang);
    if (legacy !== null) return withStreamSecondary(legacy === "true");
  } catch {
    /* localStorage unavailable */
  }
  return normalizeConfig(null);
}
