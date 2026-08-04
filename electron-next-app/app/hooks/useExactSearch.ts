"use client";

import { useCallback, useSyncExternalStore } from "react";
import { LS_KEYS } from "../lib/constants";

let exact = false;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    exact = localStorage.getItem(LS_KEYS.searchExact) === "true";
  } catch {
    exact = false;
  }
}

function subscribe(listener: () => void): () => void {
  hydrate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useExactSearch(): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => exact,
    () => false,
  );

  const setValue = useCallback((next: boolean) => {
    if (next === exact) return;
    exact = next;
    try {
      localStorage.setItem(LS_KEYS.searchExact, String(next));
    } catch {}
    emit();
  }, []);

  return [value, setValue];
}
