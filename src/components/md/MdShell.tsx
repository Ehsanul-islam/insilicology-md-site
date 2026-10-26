"use client";

import type { ReactNode } from "react";
import { MdNav } from "./MdNav";
import { MdThemeContext, useMdTheme } from "./useMdTheme";

/** Client shell: owns the theme, renders the skip link and nav, and passes server-rendered pages through as children. */
export function MdShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useMdTheme();

  return (
    <MdThemeContext.Provider value={theme}>
      <div className="md-page" data-theme={theme}>
        <a className="md-skip" href="#md-main">Skip to content</a>
        <MdNav theme={theme} onToggleTheme={toggle} />
        <main id="md-main">{children}</main>
      </div>
    </MdThemeContext.Provider>
  );
}
