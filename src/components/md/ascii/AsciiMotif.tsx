"use client";

import { useEffect, useRef } from "react";
import { useMdThemeValue, useReducedMotion } from "../useMdTheme";
import { drawGrid, readInk, sizeCanvas } from "./glyphGrid";
import { ANIMATED_MOTIFS, type MotifKind, motifLevels } from "./motifs";

type Props = {
  kind: MotifKind;
  cols?: number;
  rows?: number;
  /** Animate (wheel/docking only). Reduced-motion users always get a still frame. */
  animate?: boolean;
  className?: string;
  /** Provide when the motif conveys meaning; otherwise it is hidden from assistive tech. */
  label?: string;
};

/** A small procedural ASCII frame drawn with the shared glyph ramp. */
export function AsciiMotif({ kind, cols = 28, rows = 10, animate = false, className, label }: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useMdThemeValue();
  const reduced = useReducedMotion();
  const moving = animate && !reduced && ANIMATED_MOTIFS.has(kind);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let raf = 0;
    let last = 0;
    let visible = true;
    let width = Math.floor(wrap.getBoundingClientRect().width);

    const draw = (t: number) => {
      if (!width) return;
      sizeCanvas(canvas, width, cols, rows);
      // never let the canvas drive its container's width (avoids resize feedback loops)
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      drawGrid(canvas, motifLevels(kind, cols, rows, t / 1000), cols, rows, readInk(wrap));
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || t - last < 66) return;
      last = t;
      draw(t);
    };

    const ro = new ResizeObserver(([e]) => {
      width = Math.floor(e.contentRect.width);
      draw(performance.now());
    });
    ro.observe(wrap);

    let io: IntersectionObserver | null = null;
    if (moving) {
      io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
      io.observe(wrap);
    }

    draw(moving ? performance.now() : 0);
    if (moving) raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io?.disconnect();
    };
  }, [kind, cols, rows, moving, theme]);

  return (
    <span
      ref={wrapRef}
      className={`md-motif ${className ?? ""}`}
      style={{ aspectRatio: `${cols} / ${rows * 1.7}` }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <canvas ref={canvasRef} />
    </span>
  );
}
