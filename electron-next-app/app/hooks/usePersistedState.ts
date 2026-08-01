"use client";

import { useEffect, useRef, useState } from "react";

export function usePersistedState<T>(
  key: string,
  initialValue: T,
  parse?: (raw: string | null) => T,
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);
  const justHydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (parse) setValue(parse(raw));
      else if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch (err) {
      console.error(`Failed to hydrate ${key}`, err);
    }
    justHydrated.current = true;
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    // When the key changes, `value` is still the previous key's — skip that one
    // pass so it is not written over what we just read.
    if (justHydrated.current) {
      justHydrated.current = false;
      return;
    }
    try {
      const serialized =
        typeof value === "string" || typeof value === "number"
          ? String(value)
          : JSON.stringify(value);
      localStorage.setItem(key, serialized);
    } catch (err) {
      console.error(`Failed to persist ${key}`, err);
    }
  }, [key, value, hydrated]);

  return [value, setValue, hydrated];
}
