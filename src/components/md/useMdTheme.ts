import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type MdTheme = "light" | "dark";

/** Current theme for components deep in the page (ASCII canvases re-read their ink on change). */
export const MdThemeContext = createContext<MdTheme>("light");
export const useMdThemeValue = () => useContext(MdThemeContext);

/** True when the visitor prefers reduced motion; follows changes live. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
const KEY = "insilicology-md-theme";

function initial(): MdTheme {
  try {
    const s = localStorage.getItem(KEY);
    if (s === "light" || s === "dark") return s;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Page-scoped theme: OS default, remembered once the visitor toggles. */
export function useMdTheme() {
  const [theme, setTheme] = useState<MdTheme>(initial);
  const [pinned, setPinned] = useState(() => {
    try {
      return !!localStorage.getItem(KEY);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (pinned) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [pinned]);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* storage unavailable */
      }
      return next;
    });
    setPinned(true);
  }, []);

  return { theme, toggle };
}
