"use client";

import { buildSearchIndex } from "./textUtils";
import type { MessageTextEntry, MessageTitlesEntry } from "./types";

export interface ChunkRow {
  date: string;
  title: string;
  chunkIdx: number;
  pnum: number;
  text: string;
  idx: string;
}

export function messageDateYear(date: string): string {
  const yy = Number(date.slice(0, 2));
  if (!Number.isFinite(yy)) return "";
  return String(yy >= 30 ? 1900 + yy : 2000 + yy);
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

async function build(): Promise<ChunkRow[]> {
  const api = typeof window !== "undefined" ? window.api : undefined;
  if (!api) {
    cachedTitles = [];
    cachedChunks = [];
    return [];
  }

  const titles = (await api.readMessageTitles()) ?? [];
  cachedTitles = titles;

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

export async function getMessageText(
  dateKey: string,
): Promise<MessageTextEntry | null> {
  const api = typeof window !== "undefined" ? window.api : undefined;
  if (!api) return null;
  return api.readMessageText(dateKey);
}
