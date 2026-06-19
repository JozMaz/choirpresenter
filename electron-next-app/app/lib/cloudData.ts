"use client";

import type { CloudManifest } from "./types";

/**
 * Cloud data bootstrap & sync.
 *
 * Datový tok:
 *   1) App startuje → `bootstrap()` zkontroluje lokální cache
 *   2) Bez cache → fetch manifest → download všech souborů → save na disk
 *   3) S cache → fetch manifest async → porovnání verzí → "Update available"
 *      (samotný download až na klik tlačítka v UI)
 *
 * Veškeré IO běží přes window.api (Electron IPC). V čistém browseru
 * (Next dev server bez Electronu) tato logika gracefully selže a appka
 * spadne do bundle fallback módu, který je v hlavním procesu zachován.
 */

const MANIFEST_KEY = "manifest.json";

export interface BootstrapProgress {
  /** "checking", "downloading", "done", "error". */
  phase: "init" | "checking" | "downloading" | "done" | "error";
  /** Ratio 0..1 — combined progress (jen smysl má phase=downloading). */
  ratio: number;
  /** Aktuální soubor — pro splash UI. */
  currentFile?: string;
  /** Pro debug. */
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
export function onUpdateAvailability(cb: (available: boolean) => void): () => void {
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

/**
 * Stáhne všechny soubory z manifestu na disk, ohlašuje progress.
 * Po dokončení uloží i samotný manifest (= signál že download proběhl celý).
 */
async function downloadAll(
  manifest: CloudManifest,
  onProgress: BootstrapListener,
): Promise<void> {
  const api = window.api;
  if (!api) throw new Error("Electron IPC not available");

  const files = Object.entries(manifest.files);
  const total = files.length;
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

  // Manifest se zapisuje POSLEDNÍ — slouží jako sentinel "download kompletní".
  // Při příštím startu data-has-local detekuje jeho přítomnost.
  await api.dataWriteLocal(
    MANIFEST_KEY,
    JSON.stringify(manifest, null, 2),
  );
  lastManifest = manifest;

  onProgress({ phase: "done", ratio: 1 });
}

/**
 * Spustí bootstrap. Pokud běží, vrátí existující promise.
 * Jednotky:
 *   - First start (no cache): downloadne všechno, ratio 0→1 lineárně
 *   - Subsequent start (cache exists): fetch manifest na pozadí (instant ratio=1
 *     z hlediska UI), pokud version diff → setUpdateAvailable(true)
 */
export function bootstrap(onProgress: BootstrapListener): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    onProgress({ phase: "init", ratio: 0 });
    const api = typeof window !== "undefined" ? window.api : undefined;
    if (!api) {
      // Bez Electronu (browser preview) — neumíme nic
      onProgress({ phase: "done", ratio: 1 });
      return;
    }

    const hasLocal = await api.dataHasLocal();

    if (hasLocal) {
      // Načti lokální manifest pro info
      const local = await loadLocalManifest();
      lastManifest = local;
      onProgress({ phase: "done", ratio: 1 });

      // Async fetch cloud manifest pro update check (nečekáme na to)
      void (async () => {
        const remote = await fetchCloudManifest();
        if (remote && local && remote.version !== local.version) {
          setUpdateAvailable(true);
        }
      })();
      return;
    }

    // Bez cache → musíme downloadnout
    onProgress({ phase: "checking", ratio: 0 });
    const remote = await fetchCloudManifest();
    if (!remote) {
      onProgress({
        phase: "error",
        ratio: 0,
        message:
          "Cloud unavailable and no local cache. Connect to internet and restart.",
      });
      // Pošli i error event, ale promise rejectujeme aby caller mohl reagovat
      throw new Error("No cloud and no cache");
    }

    await downloadAll(remote, onProgress);
  })();
  return inflight;
}

/**
 * Manuální update: aplikuje aktuální cloud manifest, stáhne změněné soubory.
 * Volat z tlačítka "Update" v UI.
 */
export async function applyUpdate(onProgress: BootstrapListener): Promise<void> {
  const api = window.api;
  if (!api) throw new Error("Electron IPC not available");

  onProgress({ phase: "checking", ratio: 0 });
  const remote = await fetchCloudManifest();
  if (!remote) {
    onProgress({ phase: "error", ratio: 0, message: "Cloud unavailable" });
    return;
  }
  const local = await loadLocalManifest();
  // Diff: soubory se změněným hashem (nebo nové)
  const changedKeys: string[] = [];
  for (const [key, entry] of Object.entries(remote.files)) {
    const localEntry = local?.files?.[key];
    if (!localEntry || localEntry.hash !== entry.hash) {
      changedKeys.push(key);
    }
  }
  // (Mazání odstraněných souborů by mohlo přijít sem; pro Phase 1 ignoruj.)

  const total = changedKeys.length;
  let done = 0;
  for (const key of changedKeys) {
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
