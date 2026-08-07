"use client";

import type { CloudManifest, CloudManifestEntry } from "./types";
import { wantsFile, type ContentSelection } from "./access";

const MANIFEST_KEY = "manifest.json";

export const NO_CACHE_ERROR = "NO_CLOUD_NO_CACHE";

export interface BootstrapProgress {
  phase: "init" | "checking" | "downloading" | "done" | "error";
  ratio: number;
  currentFile?: string;
  message?: string;
}

export type BootstrapListener = (p: BootstrapProgress) => void;

let inflight: Promise<void> | null = null;
let lastManifest: CloudManifest | null = null;
export function getLastManifest(): CloudManifest | null {
  return lastManifest;
}

async function loadLocalManifest(): Promise<CloudManifest | null> {
  const api = typeof window !== "undefined" ? window.api : undefined;
  if (!api) return null;
  const raw = await api.dataReadLocal(MANIFEST_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CloudManifest;
  } catch {
    return null;
  }
}

async function fetchCloudManifest(): Promise<CloudManifest | null> {
  const api = typeof window !== "undefined" ? window.api : undefined;
  if (!api) return null;
  const raw = await api.dataFetchManifest();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CloudManifest;
  } catch {
    return null;
  }
}

export interface SyncPlan {
  toFetch: string[];
  ledgerFiles: Record<string, CloudManifestEntry>;
}

export function planSync(
  remoteFiles: Record<string, CloudManifestEntry>,
  ledgerFiles: Record<string, CloudManifestEntry>,
  onDisk: Set<string>,
  selection: ContentSelection | undefined,
  forceAll = false,
): SyncPlan {
  const wanted = Object.entries(remoteFiles).filter(
    ([key]) => !selection || wantsFile(key, selection),
  );

  const toFetch: string[] = [];
  const ledger: Record<string, CloudManifestEntry> = {};

  for (const [key, entry] of Object.entries(ledgerFiles)) {
    if (onDisk.has(key)) ledger[key] = entry;
  }

  for (const [key, entry] of wanted) {
    const known = ledger[key];
    const stale = !known || known.hash !== entry.hash;
    if (forceAll || !onDisk.has(key) || stale) {
      toFetch.push(key);
    }
    ledger[key] = entry;
  }

  return { toFetch, ledgerFiles: ledger };
}

async function runSync(
  onProgress: BootstrapListener,
  selection: ContentSelection | undefined,
  forceAll: boolean,
): Promise<void> {
  const api = typeof window !== "undefined" ? window.api : undefined;
  if (!api) {
    onProgress({ phase: "done", ratio: 1 });
    return;
  }

  if (await api.dataLocalMode?.()) {
    onProgress({ phase: "done", ratio: 1 });
    return;
  }

  onProgress({ phase: "checking", ratio: 0 });
  const remote = await fetchCloudManifest();
  const ledger = await loadLocalManifest();

  if (!remote) {
    if (ledger) {
      lastManifest = ledger;
      onProgress({ phase: "done", ratio: 1 });
      return;
    }
    onProgress({ phase: "error", ratio: 0, message: NO_CACHE_ERROR });
    throw new Error(NO_CACHE_ERROR);
  }

  const ledgerFiles = ledger?.files ?? {};
  const candidates = Array.from(
    new Set([...Object.keys(remote.files), ...Object.keys(ledgerFiles)]),
  );
  const presence = await api.dataHasFiles(candidates);
  const onDisk = new Set(candidates.filter((_, i) => presence[i]));

  const plan = planSync(remote.files, ledgerFiles, onDisk, selection, forceAll);

  const total = Math.max(1, plan.toFetch.length);
  let done = 0;
  for (const key of plan.toFetch) {
    onProgress({ phase: "downloading", ratio: done / total, currentFile: key });
    const content = await api.dataFetchCloud(key);
    if (content === null) throw new Error(`Cloud fetch failed for ${key}`);
    const ok = await api.dataWriteLocal(key, content);
    if (!ok) throw new Error(`Local write failed for ${key}`);
    done++;
  }

  const nextManifest: CloudManifest = {
    version: remote.version,
    generatedAt: remote.generatedAt,
    files: plan.ledgerFiles,
  };
  await api.dataWriteLocal(MANIFEST_KEY, JSON.stringify(nextManifest, null, 2));
  lastManifest = nextManifest;

  onProgress({ phase: "done", ratio: 1 });
}

export function bootstrap(
  onProgress: BootstrapListener,
  selection?: ContentSelection,
): Promise<void> {
  if (inflight) return inflight;
  const run = runSync(onProgress, selection, false).finally(() => {
    inflight = null;
  });
  inflight = run;
  return run;
}

export async function applyUpdate(
  onProgress: BootstrapListener,
  opts: { forceAll?: boolean; selection?: ContentSelection } = {},
): Promise<void> {
  await runSync(onProgress, opts.selection, opts.forceAll === true);
}
