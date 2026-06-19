"use client";

import { useEffect, useState } from "react";
import type { Bible, BibleKey } from "../lib/bibleData";

type BiblesState = Record<BibleKey, Bible | null>;

const initialState: BiblesState = {
  warszawska: null,
  gdanska: null,
};

/**
 * Načte obě polské bible přes Electron IPC. Main proces už vrací JSON string
 * (parsovaný přes V8/vm), takže tady stačí JSON.parse.
 */
export function useBibles() {
  const [bibles, setBibles] = useState<BiblesState>(initialState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const api = window.api;
      if (!api?.readBible) {
        setLoaded(true);
        return;
      }

      const parse = async (key: BibleKey): Promise<Bible | null> => {
        try {
          const raw = await api.readBible(key);
          if (!raw) return null;
          return JSON.parse(raw) as Bible;
        } catch (err) {
          console.error(`Failed to parse bible ${key}`, err);
          return null;
        }
      };

      const [warszawska, gdanska] = await Promise.all([
        parse("warszawska"),
        parse("gdanska"),
      ]);

      if (!cancelled) {
        setBibles({ warszawska, gdanska });
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { bibles, loaded };
}
