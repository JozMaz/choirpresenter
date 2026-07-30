"use client";

import type { CloudManifest } from "./types";
import { wantsFile, type ContentSelection } from "./access";

const MANIFEST_KEY = "manifest.json";

export interface BootstrapProgress {
  phase: "init" | "checking" | "downloading" | "done" | "error";
  ratio: number;
  currentFile?: string;
  message?: string;
}

export type BootstrapListener = (p: BootstrapProgress) => void;

let inflight: Promise<void> | null = null;
let lastManifest: CloudManifest | null = null;
let manifestUpdateAvailable = false;
let updateListeners: Array<(available: boolean) => void> = [];

export function getLastManifest(): CloudManifest | null {
  return lastManifest;
}
export function isUpdateAvailable(): boolean {
  return manifestUpdateAvailable;
}
export function onUpdateAvailability(
  cb: (available: boolean) => void,
): () => void {
  updateListeners.push(cb);
  return () => {
    updateListeners = updateListeners.filter((l) => l !== cb);
  };
}
function setUpdateAvailable(v: boolean) {
  if (manifestUpdateAvailable === v) return;
  manifestUpdateAvailable = v;
  for (const l of updateListeners) l(v);
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

function filterManifest(
  manifest: CloudManifest,
  selection?: ContentSelection,
): CloudManifest {
  if (!selection) return manifest;
  const files: CloudManifest["files"] = {};
  for (const [key, entry] of Object.entries(manifest.files)) {
    if (wantsFile(key, selection)) files[key] = entry;
  }
  return { ...manifest, files };
}

async function downloadAll(
  manifest: CloudManifest,
  onProgress: BootstrapListener,
): Promise<void> {
  const api = window.api;
  if (!api) throw new Error("Electron IPC not available");

  const files = Object.entries(manifest.files);
  const total = Math.max(1, files.length);
  let done = 0;

  for (const [key] of files) {
    onProgress({
      phase: "downloading",
      ratio: done / total,
      currentFile: key,
    });
    const content = await api.dataFetchCloud(key);
    if (content === null) {
      throw new Error(`Cloud fetch failed for ${key}`);
    }
    const ok = await api.dataWriteLocal(key, content);
    if (!ok) throw new Error(`Local write failed for ${key}`);
    done++;
  }

  await api.dataWriteLocal(MANIFEST_KEY, JSON.stringify(manifest, null, 2));
  lastManifest = manifest;

  onProgress({ phase: "done", ratio: 1 });
}

export function bootstrap(
  onProgress: BootstrapListener,
  selection?: ContentSelection,
): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    onProgress({ phase: "init", ratio: 0 });
    const api = typeof window !== "undefined" ? window.api : undefined;
    if (!api) {
      onProgress({ phase: "done", ratio: 1 });
      return;
    }

    if (await api.dataLocalMode?.()) {
      onProgress({ phase: "done", ratio: 1 });
      return;
    }

    const hasLocal = await api.dataHasLocal();

    if (hasLocal) {
      const local = await loadLocalManifest();
      lastManifest = local;
      onProgress({ phase: "done", ratio: 1 });

      void (async () => {
        const remote = await fetchCloudManifest();
        if (remote && local && remote.version !== local.version) {
          setUpdateAvailable(true);
        }
      })();
      return;
    }

    onProgress({ phase: "checking", ratio: 0 });
    const remote = await fetchCloudManifest();
    if (!remote) {
      onProgress({
        phase: "error",
        ratio: 0,
        message:
          "Cloud unavailable and no local cache. Connect to internet and restart.",
      });
      throw new Error("No cloud and no cache");
    }

    await downloadAll(filterManifest(remote, selection), onProgress);
  })();
  return inflight;
}

export async function applyUpdate(
  onProgress: BootstrapListener,
  opts: { forceAll?: boolean; selection?: ContentSelection } = {},
): Promise<void> {
  const api = window.api;
  if (!api) throw new Error("Electron IPC not available");

  onProgress({ phase: "checking", ratio: 0 });
  const fullRemote = await fetchCloudManifest();
  if (!fullRemote) {
    onProgress({ phase: "error", ratio: 0, message: "Cloud unavailable" });
    return;
  }
  const remote = filterManifest(fullRemote, opts.selection);

  let toFetch: string[];
  if (opts.forceAll) {
    toFetch = Object.keys(remote.files);
  } else {
    const local = await loadLocalManifest();
    toFetch = [];
    for (const [key, entry] of Object.entries(remote.files)) {
      const localEntry = local?.files?.[key];
      if (!localEntry || localEntry.hash !== entry.hash) {
        toFetch.push(key);
      }
    }
  }

  const total = toFetch.length;
  let done = 0;
  for (const key of toFetch) {
    onProgress({
      phase: "downloading",
      ratio: done / Math.max(1, total),
      currentFile: key,
    });
    const content = await api.dataFetchCloud(key);
    if (content === null) {
      throw new Error(`Cloud fetch failed for ${key}`);
    }
    const ok = await api.dataWriteLocal(key, content);
    if (!ok) throw new Error(`Local write failed for ${key}`);
    done++;
  }
  await api.dataWriteLocal(MANIFEST_KEY, JSON.stringify(remote, null, 2));
  lastManifest = remote;
  setUpdateAvailable(false);
  onProgress({ phase: "done", ratio: 1 });
}
