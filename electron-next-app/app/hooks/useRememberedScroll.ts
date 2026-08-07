"use client";

import { useLayoutEffect, useRef } from "react";
import { recallScroll, rememberScroll } from "../lib/libraryState";

export function useRememberedScroll<T extends HTMLElement>(
  key: string,
  ready: boolean,
) {
  const ref = useRef<T>(null);
  const restoredFor = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !ready || restoredFor.current === key) return;
    restoredFor.current = key;
    el.scrollTop = recallScroll(key);
  }, [key, ready]);

  const onScroll = () => {
    if (restoredFor.current !== key || !ref.current) return;
    rememberScroll(key, ref.current.scrollTop);
  };

  return { ref, onScroll };
}
