import { LS_KEYS } from "./constants";

export type OutputId = "out1" | "out2";
export type OutputType = "hdmi" | "ip";
export type OutputMode = "fullscreen" | "lowerThirds";

export const OUTPUT_IDS: OutputId[] = ["out1", "out2"];

export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  hdmi: "HDMI",
  ip: "IP",
};

export const DEFAULT_OUTPUT_NAMES: Record<OutputId, string> = {
  out1: "Output 1",
  out2: "Output 2",
};

export const MAX_OUTPUT_DELAY_MS = 20000;

export interface OutputDef {
  name: string;
  enabled: boolean;
  type: OutputType;
  mode: OutputMode;
  delayMs: number;
  delayPreview: boolean;
}

export type OutputsConfig = Record<OutputId, OutputDef>;

export const DEFAULT_OUTPUTS: OutputsConfig = {
  out1: {
    name: DEFAULT_OUTPUT_NAMES.out1,
    enabled: true,
    type: "hdmi",
    mode: "fullscreen",
    delayMs: 0,
    delayPreview: false,
  },
  out2: {
    name: DEFAULT_OUTPUT_NAMES.out2,
    enabled: false,
    type: "hdmi",
    mode: "lowerThirds",
    delayMs: 0,
    delayPreview: false,
  },
};

export function outputName(def: OutputDef, id: OutputId): string {
  return def.name.trim() || DEFAULT_OUTPUT_NAMES[id];
}

export function supportsTransparency(def: OutputDef): boolean {
  return def.mode === "lowerThirds" && def.type === "ip";
}

function normalizeDef(value: unknown, fallback: OutputDef): OutputDef {
  const raw = (value ?? {}) as Partial<Record<keyof OutputDef, unknown>>;
  return {
    name: typeof raw.name === "string" ? raw.name : fallback.name,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled,
    type: raw.type === "hdmi" || raw.type === "ip" ? raw.type : fallback.type,
    mode:
      raw.mode === "fullscreen" || raw.mode === "lowerThirds"
        ? raw.mode
        : fallback.mode,
    delayMs:
      typeof raw.delayMs === "number" && Number.isFinite(raw.delayMs)
        ? Math.min(MAX_OUTPUT_DELAY_MS, Math.max(0, Math.round(raw.delayMs)))
        : fallback.delayMs,
    delayPreview:
      typeof raw.delayPreview === "boolean"
        ? raw.delayPreview
        : fallback.delayPreview,
  };
}

export function normalizeOutputs(value: unknown): OutputsConfig {
  const raw = (value ?? {}) as Partial<Record<OutputId, unknown>>;
  const out = {} as OutputsConfig;
  for (const id of OUTPUT_IDS) {
    out[id] = normalizeDef(raw[id], DEFAULT_OUTPUTS[id]);
  }
  if (!out.out1.enabled && !out.out2.enabled) out.out1.enabled = true;
  return out;
}

const has = (key: string): boolean => {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
};

// A pre-0.6 install always ran Local plus Stream, and optionally mirrored one of
// them over the network. Those two slots become out1 and out2 so nothing the
// user had configured disappears behind a disabled output.
function migratedOutputs(): OutputsConfig | null {
  const legacy =
    has(LS_KEYS.outputConfig) ||
    has(LS_KEYS.netMirror) ||
    has(LS_KEYS.localFadeMs) ||
    has(LS_KEYS.streamFadeMs) ||
    has(LS_KEYS.out2Bg);
  if (!legacy) return null;

  let usedNetwork = false;
  try {
    const raw = localStorage.getItem(LS_KEYS.visiblePreviews);
    usedNetwork = raw !== null && raw.includes("network");
  } catch {
    usedNetwork = false;
  }
  if (!usedNetwork) {
    usedNetwork = ["songs", "bible", "messages"].some((group) =>
      has(`${LS_KEYS.netBoxScale}:${group}`),
    );
  }

  return {
    out1: {
      name: DEFAULT_OUTPUT_NAMES.out1,
      enabled: true,
      type: "hdmi",
      mode: "fullscreen",
      delayMs: 0,
      delayPreview: false,
    },
    out2: {
      name: DEFAULT_OUTPUT_NAMES.out2,
      enabled: true,
      type: usedNetwork ? "ip" : "hdmi",
      mode: "lowerThirds",
      delayMs: 0,
      delayPreview: false,
    },
  };
}

export function readOutputs(raw: string | null): OutputsConfig {
  if (raw !== null) {
    try {
      return normalizeOutputs(JSON.parse(raw));
    } catch {
      return normalizeOutputs(null);
    }
  }
  return migratedOutputs() ?? normalizeOutputs(null);
}
