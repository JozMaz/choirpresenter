"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { LS_KEYS } from "../constants";
import {
  DEFAULT_LANG,
  DICTIONARIES,
  readLang,
  type Dict,
  type Lang,
} from "./index";

const listeners = new Set<() => void>();
let current: Lang | null = null;

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

const getSnapshot = (): Lang => {
  if (current === null) {
    try {
      current = readLang(localStorage.getItem(LS_KEYS.language));
    } catch {
      current = DEFAULT_LANG;
    }
  }
  return current;
};

const getServerSnapshot = (): Lang => DEFAULT_LANG;

function storeLang(next: Lang) {
  if (current === next) return;
  current = next;
  try {
    localStorage.setItem(LS_KEYS.language, next);
  } catch (err) {
    console.error("Failed to persist language", err);
  }
  for (const listener of listeners) listener();
}

interface I18nValue {
  lang: Lang;
  t: Dict;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nValue>({
  lang: DEFAULT_LANG,
  t: DICTIONARIES[DEFAULT_LANG],
  setLang: storeLang,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = lang;
    window.api?.setLanguage?.(lang);
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({ lang, t: DICTIONARIES[lang], setLang: storeLang }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
