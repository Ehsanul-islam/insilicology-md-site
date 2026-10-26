"use client";

import { useEffect, useRef } from "react";
import { useMdThemeValue, useReducedMotion } from "../useMdTheme";
import { FALLBACK_WHOLE } from "./fallbackFrames";
import { CELL_ASPECT, drawGrid, framesToLevels, readInk, sizeCanvas } from "./glyphGrid";

export type LensMode = "idle" | "searching" | "empty";

const BASE = framesToLevels(FALLBACK_WHOLE);

/**
 * Interactive ASCII magnifying glass over a protein (pre-rendered from 1AFS).
 * idle: the lens drifts and follows the pointer, magnifying what is under it.
 * searching: the lens scans quickly. empty: nothing shows inside the lens.
 * Drawn in the protein glyph colour so it matches the molecule it hands over to.
 */
export function SearchLens({ mode }: { mode: LensMode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useMdThemeValue();
  const reduced = useReducedMotion();
  const st = useRef({ x: BASE.cols / 2, y: BASE.rows / 2, tx: BASE.cols / 2, ty: BASE.rows / 2, pointerAt: 0, mode, ink: "#111111", w: 0 });
  st.current.mode = mode;

  useEffect(() => {
    st.current.ink = readInk(wrapRef.current, "--md-glyph-hi");
  }, [theme]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const { cols, rows, levels: base } = BASE;
    const out = new Uint8Array(cols * rows);
    const s = st.current;
    let raf = 0;
    let last = 0;
    let visible = true;

    const fit = () => {
      const r = wrap.getBoundingClientRect();
      // fit the whole frame inside the box: width-limited or height-limited
      s.w = Math.floor(Math.min(r.width, (r.height * cols) / (rows * CELL_ASPECT)));
    };

    const draw = (t: number) => {
      if (!s.w) return;
      const idle = t - s.pointerAt > 1800;
      const speed = s.mode === "searching" ? 2.6 : 0.45;
      if (idle && !reduced) {
        s.tx = cols * 0.5 + cols * 0.24 * Math.cos((t / 1000) * speed);
        s.ty = rows * 0.5 + rows * 0.2 * Math.sin((t / 1000) * speed * 1.3);
      }
      s.x += (s.tx - s.x) * 0.25;
      s.y += (s.ty - s.y) * 0.25;
      const rad = cols * 0.14;
      const zoom = 1.9;
      const empty = s.mode === "empty";
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const dx = x - s.x;
          const dy = (y - s.y) * CELL_ASPECT;
          const d = Math.hypot(dx, dy);
          let v = 0;
          if (Math.abs(d - rad) < 0.8) v = 5;
          else if (d < rad) {
            if (!empty) {
              const sx = Math.round(s.x + dx / zoom);
              const sy = Math.round(s.y + (y - s.y) / zoom);
              v = sx >= 0 && sy >= 0 && sx < cols && sy < rows ? base[sy * cols + sx] : 0;
            }
          } else {
            const along = (dx + dy) / Math.SQRT2;
            const across = (dx - dy) / Math.SQRT2;
            if (along > rad && along < rad * 1.9 && Math.abs(across) < 1.3) v = 5;
            else {
              const b = base[i];
              v = b ? (b >= 3 ? 2 : 1) : 0;
            }
          }
          out[i] = v;
        }
      }
      sizeCanvas(canvas, s.w, cols, rows);
      drawGrid(canvas, out, cols, rows, s.ink);
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || t - last < 66) return;
      last = t;
      draw(t);
    };

    const ro = new ResizeObserver(() => {
      fit();
      draw(performance.now());
    });
    ro.observe(wrap);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(wrap);
    fit();
    draw(0);
    if (!reduced) raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
    // re-run on mode/theme so reduced-motion users still get an updated still frame
  }, [reduced, mode, theme]);

  const onMove = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const s = st.current;
    s.pointerAt = performance.now();
    s.tx = ((e.clientX - r.left) / r.width) * BASE.cols;
    s.ty = ((e.clientY - r.top) / r.height) * BASE.rows;
  };

  const label =
    mode === "empty"
      ? "ASCII magnifying glass over a protein, with nothing inside the lens."
      : "Interactive ASCII magnifying glass over a protein structure. Move the pointer over it to look through the lens.";

  return (
    <div ref={wrapRef} className="md-lens" role="img" aria-label={label} onPointerMove={onMove}>
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
