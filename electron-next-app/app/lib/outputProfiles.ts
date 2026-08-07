import { LS_KEYS } from "./constants";
import { OUTPUT_IDS, type OutputId, type OutputMode } from "./outputs";
import type { BoxAlign, BoxMode, OverlayConfig } from "./types";

export type DisplayGroup = "songs" | "bible" | "messages";

export const DISPLAY_GROUPS: DisplayGroup[] = ["songs", "bible", "messages"];

export type ProfileField =
  | "fadeMs"
  | "textScale"
  | "tightLabels"
  | "edgeFade"
  | "boxModeX"
  | "boxModeY"
  | "boxAlignX"
  | "boxAlignY"
  | "boxPadX"
  | "boxPadY"
  | "boxWidth"
  | "boxHeight"
  | "boxScale"
  | "boxRadius"
  | "boxAlpha"
  | "boxOffsetX"
  | "boxOffsetY";

export const PROFILE_DEFAULTS: Record<OutputMode, Record<string, number>> = {
  fullscreen: { fadeMs: 320, textScale: 100 },
  lowerThirds: { fadeMs: 320, textScale: 100 },
};

export const OVERLAY_DEFAULTS = {
  edgeFade: 40,
  boxPadX: 4,
  boxPadY: 6,
  boxWidth: 106,
  boxHeight: 110,
  boxScale: 40,
  boxRadius: 30,
  boxAlpha: 50,
  boxOffsetX: 0,
  boxOffsetY: 0,
} as const;

export const DEFAULT_BG = "#000000";

export function profileKey(
  id: OutputId,
  mode: OutputMode,
  group: DisplayGroup,
  field: ProfileField,
): string {
  return `${LS_KEYS.outputProfiles}:${id}:${mode}:${group}:${field}`;
}

export function displayGroupFor(item: {
  isBible?: boolean;
  isMessage?: boolean;
}): DisplayGroup {
  if (item.isBible) return "bible";
  if (item.isMessage) return "messages";
  return "songs";
}

const readText = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeText = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.error(`Failed to persist ${key}`, err);
  }
};

export const readNumberAt = (key: string, fallback: number): number => {
  const raw = readText(key);
  const parsed = raw?.trim() ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const readFlagAt = (key: string, fallback: boolean): boolean => {
  const raw = readText(key);
  return raw === "true" ? true : raw === "false" ? false : fallback;
};

export const readBoxMode = (raw: string | null): BoxMode =>
  raw === "size" ? "size" : "padding";

export const readBoxAlign = (raw: string | null): BoxAlign =>
  raw === "start" || raw === "end" ? raw : "center";

export function readOverlayConfig(
  id: OutputId,
  mode: OutputMode,
  group: DisplayGroup,
): OverlayConfig {
  const at = (field: ProfileField) => profileKey(id, mode, group, field);
  const num = (field: keyof typeof OVERLAY_DEFAULTS) =>
    readNumberAt(at(field), OVERLAY_DEFAULTS[field]);
  const textScale = readNumberAt(at("textScale"), 100);
  return {
    edgeFade: num("edgeFade"),
    boxPadX: num("boxPadX"),
    boxPadY: num("boxPadY"),
    boxWidth: num("boxWidth"),
    boxHeight: num("boxHeight"),
    boxScale: num("boxScale"),
    boxRadius: num("boxRadius"),
    boxAlpha: num("boxAlpha"),
    boxOffsetX: num("boxOffsetX"),
    boxOffsetY: num("boxOffsetY"),
    boxModeX: readBoxMode(readText(at("boxModeX"))),
    boxModeY: readBoxMode(readText(at("boxModeY"))),
    boxAlignX: readBoxAlign(readText(at("boxAlignX"))),
    boxAlignY: readBoxAlign(readText(at("boxAlignY"))),
    fadeMs: readNumberAt(at("fadeMs"), PROFILE_DEFAULTS[mode].fadeMs),
    bibleScale: textScale,
    messageScale: textScale,
    tightLabels: readFlagAt(at("tightLabels"), mode === "lowerThirds"),
  };
}

// Preview-only override: the box the user tuned may be far too small to read in
// the side panel, so "Fit" reflows it to the whole frame. What leaves the app is
// always the untouched configuration above.
export function fittedOverlay(config: OverlayConfig): OverlayConfig {
  return {
    ...config,
    boxModeX: "padding",
    boxModeY: "padding",
    boxAlignX: "center",
    boxAlignY: "center",
    boxPadX: 4,
    boxPadY: 6,
    boxWidth: 106,
    boxHeight: 110,
    boxScale: 100,
    boxOffsetX: 0,
    boxOffsetY: 0,
  };
}

const LEGACY_OVERLAY_KEYS: Record<string, string> = {
  edgeFade: LS_KEYS.netEdgeFade,
  boxPadX: LS_KEYS.netBoxPadX,
  boxPadY: LS_KEYS.netBoxPadY,
  boxWidth: LS_KEYS.netBoxWidth,
  boxHeight: LS_KEYS.netBoxHeight,
  boxScale: LS_KEYS.netBoxScale,
  boxRadius: LS_KEYS.netBoxRadius,
  boxAlpha: LS_KEYS.netBoxAlpha,
  boxOffsetX: LS_KEYS.netBoxOffsetX,
  boxOffsetY: LS_KEYS.netBoxOffsetY,
  boxModeX: LS_KEYS.netBoxModeX,
  boxModeY: LS_KEYS.netBoxModeY,
  boxAlignX: LS_KEYS.netBoxAlignX,
  boxAlignY: LS_KEYS.netBoxAlignY,
  fadeMs: LS_KEYS.netFadeMs,
};

const copy = (from: string, to: string) => {
  const value = readText(from);
  if (value !== null && readText(to) === null) writeText(to, value);
};

// Both modes are seeded for both outputs, so whichever mode a slot is switched
// to it lands on the values that slot already behaved with, and switching back
// never finds the other mode empty. Legacy keys are left in place.
export function migrateProfiles(): void {
  if (readText(LS_KEYS.outputProfilesMigrated) === "true") return;

  const legacyScale = (prefix: "local" | "stream", group: DisplayGroup) =>
    group === "bible"
      ? prefix === "local"
        ? LS_KEYS.localBibleScale
        : LS_KEYS.streamBibleScale
      : group === "messages"
        ? prefix === "local"
          ? LS_KEYS.localMessageScale
          : LS_KEYS.streamMessageScale
        : null;

  for (const id of OUTPUT_IDS) {
    const prefix = id === "out1" ? "local" : "stream";
    const fadeKey = id === "out1" ? LS_KEYS.localFadeMs : LS_KEYS.streamFadeMs;
    const tightKey =
      id === "out1" ? LS_KEYS.localTightLabels : LS_KEYS.streamTightLabels;

    for (const mode of ["fullscreen", "lowerThirds"] as OutputMode[]) {
      for (const group of DISPLAY_GROUPS) {
        const at = (field: ProfileField) => profileKey(id, mode, group, field);

        // The overlay goes first so its own per-group fade wins over the
        // output-wide one below — copy() never overwrites an existing key.
        // Only out2 inherits it: that is the slot the network output lands on.
        if (id === "out2" && mode === "lowerThirds") {
          for (const [field, base] of Object.entries(LEGACY_OVERLAY_KEYS)) {
            copy(`${base}:${group}`, at(field as ProfileField));
          }
        }

        copy(fadeKey, at("fadeMs"));
        copy(tightKey, at("tightLabels"));

        const scaleKey = legacyScale(prefix, group);
        if (scaleKey) copy(scaleKey, at("textScale"));
      }
    }
  }

  writeText(LS_KEYS.outputProfilesMigrated, "true");
}
