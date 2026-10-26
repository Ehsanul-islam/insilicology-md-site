import { useEffect } from "react";
import { MdNav } from "./components/md/MdNav";
import { MdHero } from "./components/md/MdHero";
import { Showcase } from "./components/md/showcase/Showcase";
import { MdThemeContext, useMdTheme } from "./components/md/useMdTheme";

export default function App() {
  const { theme, toggle } = useMdTheme();

  // keep the area outside the page (overscroll) in the same theme
  useEffect(() => {
    document.documentElement.style.background = theme === "dark" ? "#0e0e0e" : "#ffffff";
  }, [theme]);

  return (
    <MdThemeContext.Provider value={theme}>
      <div className="md-page" data-theme={theme}>
        <a className="md-skip" href="#md-main">Skip to content</a>
        <MdNav theme={theme} onToggleTheme={toggle} />
        <main id="md-main">
          <MdHero theme={theme} />
          <Showcase />
          {/* Next sections: 01 Simulations, 02 Analysis, 03 Pricing, 05 Reviews, 06 Services, 07 Contact */}
        </main>
      </div>
    </MdThemeContext.Provider>
  );
}
