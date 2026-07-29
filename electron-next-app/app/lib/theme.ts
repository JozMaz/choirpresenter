export type ThemePref = "dark" | "light" | "system";

export const THEME_KEY = "app:theme";

export function getThemePref(): ThemePref {
  if (typeof window === "undefined") return "dark";
  const raw = localStorage.getItem(THEME_KEY);
  return raw === "light" || raw === "system" ? raw : "dark";
}

export function resolveTheme(pref: ThemePref): "dark" | "light" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return pref;
}

export function applyTheme(pref: ThemePref) {
  document.documentElement.dataset.theme = resolveTheme(pref);
}

export function setThemePref(pref: ThemePref) {
  localStorage.setItem(THEME_KEY, pref);
  applyTheme(pref);
}

export function watchSystemTheme(): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  const onChange = () => {
    if (getThemePref() === "system") applyTheme("system");
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var r=t==="light"?"light":t==="system"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):"dark";document.documentElement.dataset.theme=r;}catch(e){document.documentElement.dataset.theme="dark";}})();`;
