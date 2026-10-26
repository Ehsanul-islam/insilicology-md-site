"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { MdTheme } from "./useMdTheme";

const LINKS = [
  ["Home", "/"],
  ["Tutorials", "/tutorials"],
  ["Blog", "/blog"],
  ["Contact", "/contact"],
] as const;

function ThemeIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 1.75a7.25 7.25 0 0 1 0 14.5z" fill="currentColor" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
      {open ? (
        <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" />
      ) : (
        <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.5" />
      )}
    </svg>
  );
}

export function MdNav({ theme, onToggleTheme }: { theme: MdTheme; onToggleTheme: () => void }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="md-nav">
      <nav className="md-wrap" aria-label="MD simulation service">
        <div className="md-nav-row">
          <Link className="md-brand" href="/" aria-label="Insilicology home">
            <span className="md-brand-mark" aria-hidden="true">─◆─</span> Insilicology
          </Link>
          <ul className="md-links">
            {LINKS.map(([label, href]) => (
              <li key={href}>
                <Link href={href} aria-current={isCurrent(href) ? "page" : undefined}>{label}</Link>
              </li>
            ))}
          </ul>
          <div className="md-actions">
            <button
              type="button"
              className="md-icon-btn"
              onClick={onToggleTheme}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              <ThemeIcon />
            </button>
            <button
              type="button"
              className="md-icon-btn md-menu-btn"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="md-drawer"
              onClick={() => setOpen((v) => !v)}
            >
              <MenuIcon open={open} />
            </button>
            <Link className="md-btn md-btn-primary" href="/contact">Get a quote</Link>
          </div>
        </div>
        {open && (
          <div className="md-drawer" id="md-drawer">
            <ul>
              {LINKS.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} aria-current={isCurrent(href) ? "page" : undefined} onClick={() => setOpen(false)}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
    </header>
  );
}
