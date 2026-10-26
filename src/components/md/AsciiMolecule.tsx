"use client";

import { useEffect, useRef, useState } from "react";
import { useMdThemeValue } from "./useMdTheme";
import { mountAscii, type AsciiFocus, type AsciiHandle } from "./asciiEngine";

export interface AsciiMoleculeProps {
  pdbId: string;
  ligandResn?: string;
  focus?: AsciiFocus;
  zoom?: number;
  /** Grid size in glyph cells: [cols, rows]. */
  size?: [number, number];
  cell?: number;
  autoSpin?: boolean;
  label?: string;
  /** Current theme, so glyph tones follow the toggle. */
  theme?: string;
  /** Pre-rendered glyph frame shown until the live render is ready (and as the no-WebGL fallback). */
  ssrFrame?: string;
  className?: string;
}

/** Halftone ASCII render of a real PDB structure (3Dmol.js → glyph grid). */
export function AsciiMolecule({
  pdbId,
  ligandResn,
  focus = "whole",
  zoom = 1,
  size = [140, 140],
  cell = 4,
  autoSpin = true,
  label,
  theme: themeProp,
  ssrFrame,
  className,
}: AsciiMoleculeProps) {
  const ctxTheme = useMdThemeValue();
  const theme = themeProp ?? ctxTheme;
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<AsciiHandle | null>(null);
  const [fallback, setFallback] = useState<string | null>(ssrFrame ?? null);
  const [cols, rows] = size;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = pdbId.toLowerCase();
    handle.current = mountAscii(el, {
      pdbUrl: `/structures/${id}.pdb`,
      ligandResn,
      focus,
      zoom,
      cols,
      rows,
      cell,
      autoSpin,
      label,
      onReady: () => setFallback(null),
      onFallback: () => {
        if (ssrFrame) return;
        fetch(`/structures/${id}-${focus}.txt`)
          .then((r) => (r.ok ? r.text() : ""))
          .then((t) => setFallback(t || " "))
          .catch(() => setFallback(" "));
      },
    });
    return () => {
      handle.current?.destroy();
      handle.current = null;
    };
    // autoSpin is applied live below, so pausing does not reload the structure
  }, [pdbId, ligandResn, focus, zoom, cols, rows, cell, label]);

  useEffect(() => {
    handle.current?.setAutoSpin(autoSpin);
  }, [autoSpin]);

  useEffect(() => {
    // wait a frame so the new theme's custom properties are applied
    const r = requestAnimationFrame(() => handle.current?.refreshTheme());
    return () => cancelAnimationFrame(r);
  }, [theme]);

  return (
    <div
      ref={ref}
      className={["md-ascii", className].filter(Boolean).join(" ")}
      style={{ aspectRatio: `${cols} / ${rows}`, ["--md-cols" as string]: cols }}
    >
      {fallback !== null && (
        <pre className="md-ascii-fallback" role="img" aria-label={label || "Molecular structure"}>
          {fallback}
        </pre>
      )}
    </div>
  );
}

export default AsciiMolecule;
