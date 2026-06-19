"use client";

import { buildSearchIndex } from "./textUtils";
import type {
  MessageTextEntry,
  MessageTitlesEntry,
} from "./types";

export interface ChunkRow {
  date: string;
  title: string;
  chunkIdx: number;
  pnum: number;
  text: string;
  idx: string;
}

let cachedTitles: MessageTitlesEntry[] | null = null;
let cachedChunks: ChunkRow[] | null = null;
let scheduled = false;
let buildPromise: Promise<ChunkRow[]> | null = null;
let listeners: Array<() => void> = [];

export function getCachedTitles(): MessageTitlesEntry[] | null {
  return cachedTitles;
}

export function isMessageChunkIndexReady(): boolean {
  return cachedChunks !== null;
}

/**
 * Build celé struktury — načte titles + všechny per-message texty z lokální
 * cache přes Electron IPC, pak postaví search index.
 */
async function build(): Promise<ChunkRow[]> {
  const api = typeof window !== "undefined" ? window.api : undefined;
  if (!api) {
    cachedTitles = [];
    cachedChunks = [];
    return [];
  }

  const titles = (await api.readMessageTitles()) ?? [];
  cachedTitles = titles;

  // Načti všechny zprávy paralelně (limit konkurence, aby IPC roundtripy
  // nezasypaly main proces). 16 paralelních readů je rozumný.
  const list: ChunkRow[] = [];
  const CONCURRENCY = 16;
  let i = 0;
  const work: Promise<void>[] = [];

  const runOne = async (entry: MessageTitlesEntry) => {
    const data = await api.readMessageText(entry.date);
    if (!data) return;
    const fallbackTitle = data.title || entry.titles[0]?.title || entry.date;
    for (let cIdx = 0; cIdx < data.chunks.length; cIdx++) {
      const c = data.chunks[cIdx];
      list.push({
        date: entry.date,
        title: fallbackTitle,
        chunkIdx: cIdx,
        pnum: c.pnum,
        text: c.text,
        idx: buildSearchIndex(c.text),
      });
    }
  };

  while (i < titles.length) {
    const batch = titles.slice(i, i + CONCURRENCY).map(runOne);
    work.length = 0;
    work.push(...batch);
    await Promise.all(work);
    i += CONCURRENCY;
  }

  cachedChunks = list;
  return list;
}

/** Asynchronní getter — vrátí cached nebo vybuilduje. */
export async function getMessageChunkIndex(): Promise<ChunkRow[]> {
  if (cachedChunks) return cachedChunks;
  if (buildPromise) return buildPromise;
  buildPromise = build();
  const result = await buildPromise;
  const ls = listeners;
  listeners = [];
  for (const l of ls) l();
  return result;
}

/**
 * Nakopne build na pozadí (idle / next tick). Idempotentní.
 * Volitelný onDone callback se zavolá až je hotovo.
 */
export function prebuildMessageChunkIndex(onDone?: () => void): void {
  if (cachedChunks) {
    onDone?.();
    return;
  }
  if (onDone) listeners.push(onDone);
  if (scheduled || typeof window === "undefined") return;
  scheduled = true;
  const run = () => {
    void getMessageChunkIndex();
  };
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(run);
  } else {
    setTimeout(run, 0);
  }
}

/** Vrátí texty jedné konkrétní zprávy. Z cache, jinak load přes IPC. */
export async function getMessageText(
  dateKey: string,
): Promise<MessageTextEntry | null> {
  const api = typeof window !== "undefined" ? window.api : undefined;
  if (!api) return null;
  return api.readMessageText(dateKey);
}
