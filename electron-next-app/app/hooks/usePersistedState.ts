"use client";

import { useEffect, useState } from "react";

/**
 * Stejné API jako useState, ale stav se hydratuje z localStorage při mountu
 * a každá změna se zapisuje zpět. Nepřepíše uložená data initialValue, protože
 * write probíhá až po hydrataci.
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
  parse?: (raw: string) => T,
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        setValue(parse ? parse(raw) : (JSON.parse(raw) as T));
      }
    } catch (err) {
      console.error(`Failed to hydrate ${key}`, err);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
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
