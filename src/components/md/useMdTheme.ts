"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type MdTheme = "light" | "dark";

/** Current theme for components deep in the page (ASCII canvases re-read their ink on change). */
export const MdThemeContext = createContext<MdTheme>("light");
export const useMdThemeValue = () => useContext(MdThemeContext);

/** True when the visitor prefers reduced motion; follows changes live. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
export const THEME_KEY = "insilicology-md-theme";

/** Inline <head> script: sets html[data-theme] before first paint (no flash). Keep in sync with the hook below. */
export const THEME_INIT_SCRIPT = `try{var k="${THEME_KEY}",s=localStorage.getItem(k);var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;document.documentElement.style.background=t==="dark"?"#0e0e0e":"#ffffff"}catch(e){}`;

function applyToDocument(t: MdTheme) {
  document.documentElement.dataset.theme = t;
  document.documentElement.style.background = t === "dark" ? "#0e0e0e" : "#ffffff";
}

function stored(): MdTheme | null {
  try {
    const s = localStorage.getItem(THEME_KEY);
    return s === "light" || s === "dark" ? s : null;
  } catch {
    return null; // storage unavailable
  }
}

/** Page-scoped theme: OS default, remembered once the visitor toggles. */
export function useMdTheme() {
  // server and first client render agree on "light"; the head script has already painted the right theme
  const [theme, setTheme] = useState<MdTheme>("light");
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const s = stored();
    const t: MdTheme = s ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(t);
    setPinned(!!s);
  }, []);

  useEffect(() => {
    if (pinned) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [pinned]);

  useEffect(() => {
    applyToDocument(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* storage unavailable */
      }
      return next;
    });
    setPinned(true);
  }, []);

  return { theme, toggle };
}
