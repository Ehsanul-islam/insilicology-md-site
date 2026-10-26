import { useEffect, useRef } from "react";
import type { FigureKind } from "./data/types";
import { FIGURE_META } from "./data/figures";

/**
 * Watermarked placeholder plot, drawn only when a figure has no uploaded
 * image (the design preview). Shapes imitate typical GROMACS figures so the
 * layout can be judged; every value is invented and labelled as such.
 */

const C1 = "#1f77b4";
const C2 = "#ff7f0e";
const C3 = "#2ca02c";
const VIRIDIS = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
const RDBU = [[33, 102, 172], [146, 197, 222], [247, 247, 247], [244, 165, 130], [178, 24, 43]];

const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};
const noise = (x: number, seed: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i + seed * 57.3);
  const b = hash(i + 1 + seed * 57.3);
  return a + (b - a) * f * f * (3 - 2 * f);
};
const gauss = (i: number, seed: number) => (hash(i * 1.1 + seed) + hash(i * 2.3 + seed + 7) + hash(i * 3.7 + seed + 13) - 1.5) / 0.5;

function cmap(stops: number[][], u: number) {
  u = Math.max(0, Math.min(1, u));
  const p = u * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(p));
  const f = p - i;
  const a = stops[i];
  const b = stops[i + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}

export function drawPlaceholderPlot(canvas: HTMLCanvasElement, kind: FigureKind, ligands: string[], seedKey: string, watermark = true) {
  const w = canvas.clientWidth || 300;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.round(w * dpr);
  const H = Math.round(w * 0.72 * dpr);
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const c = canvas.getContext("2d");
  if (!c) return;
  const meta = FIGURE_META[kind];
  const s = W / 420;
  const seed = seedKey.length * 3.7 + kind.length;
  const ligs = ligands.length ? ligands : ["Ligand"];
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, W, H);
  const cbar = kind === "pca" || kind === "fel" || kind === "dccm";
  const L = 62 * s;
  const R = W - (cbar ? 64 : 16) * s;
  const T = 16 * s;
  const B = H - 46 * s;
  const pw = R - L;
  const ph = B - T;
  const fs = (px: number) => `${px * s}px Arial, "Helvetica Neue", sans-serif`;
  const ligColor = (i: number) => (i === 0 ? C2 : C3);

  const axes = (xmin: number, xmax: number, xt: number[] | null, ymin: number, ymax: number, yt: number[], fmtY?: (v: number) => string) => {
    c.strokeStyle = "#e6e6e6";
    c.lineWidth = s;
    yt.forEach((v) => {
      const y = B - ((v - ymin) / (ymax - ymin)) * ph;
      c.beginPath();
      c.moveTo(L, y);
      c.lineTo(R, y);
      c.stroke();
    });
    c.fillStyle = "#222";
    c.font = fs(11);
    c.textAlign = "center";
    c.textBaseline = "top";
    xt?.forEach((v) => {
      const x = L + ((v - xmin) / (xmax - xmin)) * pw;
      c.fillRect(x - 0.5 * s, B, s, 4 * s);
      c.fillText(String(v), x, B + 6 * s);
    });
    c.textAlign = "right";
    c.textBaseline = "middle";
    yt.forEach((v) => {
      const y = B - ((v - ymin) / (ymax - ymin)) * ph;
      c.fillRect(L - 4 * s, y - 0.5 * s, 4 * s, s);
      c.fillText(fmtY ? fmtY(v) : String(v), L - 7 * s, y);
    });
  };
  const frame = () => {
    c.strokeStyle = "#222";
    c.lineWidth = s;
    c.strokeRect(L, T, pw, ph);
    c.fillStyle = "#222";
    c.font = fs(12.5);
    c.textAlign = "center";
    c.textBaseline = "alphabetic";
    c.fillText(meta.x, (L + R) / 2, H - 10 * s);
    c.save();
    c.translate(16 * s, (T + B) / 2);
    c.rotate(-Math.PI / 2);
    c.fillText(meta.y, 0, 0);
    c.restore();
  };
  const series = (fn: (x: number, i: number) => number, xmin: number, xmax: number, ymin: number, ymax: number, color: string, lw = 1.1, n = 400) => {
    c.strokeStyle = color;
    c.lineWidth = lw * s;
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const xv = xmin + ((xmax - xmin) * i) / n;
      const yv = Math.max(ymin, Math.min(ymax, fn(xv, i)));
      const x = L + ((xv - xmin) / (xmax - xmin)) * pw;
      const y = B - ((yv - ymin) / (ymax - ymin)) * ph;
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.stroke();
  };
  const legend = (items: [string, string][]) => {
    c.font = fs(11);
    c.textAlign = "left";
    c.textBaseline = "middle";
    const lw = Math.max(...items.map((it) => c.measureText(it[0]).width));
    const bw = lw + 34 * s;
    const bh = items.length * 16 * s + 8 * s;
    const x0 = R - bw - 8 * s;
    const y0 = T + 8 * s;
    c.fillStyle = "rgba(255,255,255,0.9)";
    c.fillRect(x0, y0, bw, bh);
    c.strokeStyle = "#cfcfcf";
    c.lineWidth = s;
    c.strokeRect(x0, y0, bw, bh);
    items.forEach(([label, color], i) => {
      const y = y0 + 12 * s + i * 16 * s;
      c.strokeStyle = color;
      c.lineWidth = 2 * s;
      c.beginPath();
      c.moveTo(x0 + 8 * s, y);
      c.lineTo(x0 + 24 * s, y);
      c.stroke();
      c.fillStyle = "#222";
      c.fillText(label, x0 + 29 * s, y);
    });
  };
  const colorbar = (stops: number[][], label: string, ticks: number[], vmin: number, vmax: number) => {
    const x0 = R + 12 * s;
    const bw = 12 * s;
    for (let i = 0; i < 100; i++) {
      c.fillStyle = cmap(stops, 1 - i / 99);
      c.fillRect(x0, T + (i * ph) / 100, bw, ph / 100 + 1);
    }
    c.strokeStyle = "#222";
    c.lineWidth = s;
    c.strokeRect(x0, T, bw, ph);
    c.fillStyle = "#222";
    c.font = fs(10);
    c.textAlign = "left";
    c.textBaseline = "middle";
    ticks.forEach((v) => c.fillText(String(v), x0 + bw + 4 * s, B - ((v - vmin) / (vmax - vmin)) * ph));
    c.save();
    c.translate(W - 6 * s, (T + B) / 2);
    c.rotate(-Math.PI / 2);
    c.textAlign = "center";
    c.font = fs(10.5);
    c.fillText(label, 0, 0);
    c.restore();
  };

  switch (kind) {
    case "rmsd":
      axes(0, 100, [0, 20, 40, 60, 80, 100], 0, 0.5, [0, 0.1, 0.2, 0.3, 0.4, 0.5], (v) => v.toFixed(1));
      series((x, i) => 0.06 + 0.17 * (1 - Math.exp(-x / 7)) + 0.012 * gauss(i, seed), 0, 100, 0, 0.5, C1);
      ligs.forEach((_, j) =>
        series((x, i) => 0.08 + (0.14 + j * 0.05) * (1 - Math.exp(-x / 4)) + (x > 60 && j === 1 ? 0.04 : 0) + 0.02 * gauss(i, seed + 9 + j), 0, 100, 0, 0.5, ligColor(j)),
      );
      frame();
      legend([["Protein backbone", C1], ...ligs.map((l, j) => [l, ligColor(j)] as [string, string])]);
      break;
    case "rmsf":
      axes(1, 323, [1, 50, 100, 150, 200, 250, 300], 0, 0.6, [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6], (v) => v.toFixed(1));
      series(
        (x) =>
          0.06 +
          Math.exp(-(((x - 125) / 6) ** 2)) * 0.22 +
          Math.exp(-(((x - 222) / 5) ** 2)) * 0.3 +
          Math.exp(-(((x - 300) / 8) ** 2)) * 0.18 +
          (x > 315 ? (x - 315) * 0.04 : 0) +
          (x < 6 ? (6 - x) * 0.05 : 0) +
          0.05 * noise(x * 0.4, seed) ** 2,
        1, 323, 0, 0.6, C1, 1.1, 322,
      );
      frame();
      legend([["Chain A Cα", C1]]);
      break;
    case "rg":
      axes(0, 100, [0, 20, 40, 60, 80, 100], 1.85, 2.0, [1.86, 1.89, 1.92, 1.95, 1.98], (v) => v.toFixed(2));
      series((x, i) => 1.935 - 0.012 * (1 - Math.exp(-x / 15)) + 0.006 * gauss(i, seed), 0, 100, 1.85, 2.0, C1);
      frame();
      legend([["Protein", C1]]);
      break;
    case "sasa":
      axes(0, 100, [0, 20, 40, 60, 80, 100], 125, 150, [125, 130, 135, 140, 145, 150]);
      series((x, i) => 140 - 3 * (1 - Math.exp(-x / 20)) + 1.4 * Math.sin(x / 9 + seed) + 1.1 * gauss(i, seed), 0, 100, 125, 150, C1);
      frame();
      legend([["Protein", C1]]);
      break;
    case "hbond": {
      axes(0, 100, [0, 20, 40, 60, 80, 100], 0, 7, [0, 1, 2, 3, 4, 5, 6, 7]);
      const nb = 250;
      ligs.forEach((_, j) => {
        const bw = pw / nb;
        c.fillStyle = ligColor(j);
        c.globalAlpha = 0.35;
        for (let i = 0; i < nb; i++) {
          const v = Math.max(0, Math.round((j ? 3 : 2) + 1.4 * gauss(i, seed + j * 5)));
          c.fillRect(L + i * bw, B - (v / 7) * ph, Math.max(1, bw * 0.8), (v / 7) * ph);
        }
        c.globalAlpha = 1;
        series((x) => (j ? 3 : 2) + 0.25 * Math.sin(x / 11 + j), 0, 100, 0, 7, ligColor(j), 1.8, 120);
      });
      frame();
      legend(ligs.map((l, j) => [`${l}, running mean`, ligColor(j)] as [string, string]));
      break;
    }
    case "contacts": {
      const res = ["Res 1", "Res 2", "Res 3", "Res 4", "Res 5", "Res 6", "Res 7", "Res 8", "Res 9", "Res 10"];
      axes(0, 100, [0, 20, 40, 60, 80, 100], 0, res.length, []);
      const rh = ph / res.length;
      const nf = 100;
      c.font = fs(10);
      c.textAlign = "right";
      c.textBaseline = "middle";
      res.forEach((r, ri) => {
        const y = T + ri * rh;
        c.fillStyle = "#222";
        c.fillText(r, L - 6 * s, y + rh / 2);
        for (let f = 0; f < nf; f++) {
          if (noise(f * 0.35 + ri * 17, seed) > 0.25 + (ri % 4) * 0.12) {
            c.fillStyle = ri % 2 ? C1 : "#3b8bc2";
            c.fillRect(L + (f * pw) / nf, y + 2 * s, pw / nf + 0.5, rh - 4 * s);
          }
        }
      });
      frame();
      break;
    }
    case "mmpbsa": {
      const terms: [string, number][] = [["ΔE vdW", -165], ["ΔE elec", -42], ["ΔG polar", 88], ["ΔG nonpolar", -17], ["ΔG bind", -136]];
      const vmin = -200;
      const vmax = 100;
      axes(0, 1, null, vmin, vmax, [-200, -150, -100, -50, 0, 50, 100]);
      const zy = B - ((0 - vmin) / (vmax - vmin)) * ph;
      c.strokeStyle = "#222";
      c.lineWidth = s;
      c.beginPath();
      c.moveTo(L, zy);
      c.lineTo(R, zy);
      c.stroke();
      const slot = pw / terms.length;
      const scale = 1 + (seedKey.length % 3) * 0.12;
      terms.forEach(([name, val], i) => {
        const v = val * scale;
        const x = L + i * slot + slot * 0.2;
        const y = B - ((v - vmin) / (vmax - vmin)) * ph;
        c.fillStyle = i === 4 ? C2 : C1;
        c.fillRect(x, Math.min(y, zy), slot * 0.6, Math.abs(zy - y));
        const e = 9 * s + i * s;
        const mx = x + slot * 0.3;
        c.strokeStyle = "#222";
        c.beginPath();
        c.moveTo(mx, y - e);
        c.lineTo(mx, y + e);
        c.moveTo(mx - slot * 0.1, y - e);
        c.lineTo(mx + slot * 0.1, y - e);
        c.moveTo(mx - slot * 0.1, y + e);
        c.lineTo(mx + slot * 0.1, y + e);
        c.stroke();
        c.fillStyle = "#222";
        c.font = fs(10.5);
        c.textAlign = "center";
        c.textBaseline = "top";
        c.fillText(name, mx, B + 6 * s);
      });
      frame();
      break;
    }
    case "pca":
      axes(-4, 4, [-4, -2, 0, 2, 4], -3, 3, [-3, -2, -1, 0, 1, 2, 3]);
      for (let i = 0; i < 900; i++) {
        const tt = i / 900;
        const cx = tt < 0.5 ? -1.4 : 1.6;
        const cy = tt < 0.5 ? 0.6 : -0.5;
        const px = cx + 0.9 * gauss(i, seed) + (tt - 0.5) * 0.8;
        const py = cy + 0.7 * gauss(i, seed + 3);
        c.fillStyle = cmap(VIRIDIS, tt);
        c.fillRect(L + ((px + 4) / 8) * pw - 1.5 * s, B - ((py + 3) / 6) * ph - 1.5 * s, 3 * s, 3 * s);
      }
      frame();
      colorbar(VIRIDIS, "Time (ns)", [0, 25, 50, 75, 100], 0, 100);
      break;
    case "fel": {
      axes(-4, 4, [-4, -2, 0, 2, 4], -3, 3, [-3, -2, -1, 0, 1, 2, 3]);
      const nx = 80;
      const ny = 60;
      for (let a = 0; a < nx; a++) {
        for (let b = 0; b < ny; b++) {
          const xv = -4 + (8 * (a + 0.5)) / nx;
          const yv = -3 + (6 * (b + 0.5)) / ny;
          const e1 = ((xv + 1.4) / 1.3) ** 2 + ((yv - 0.6) / 1.0) ** 2;
          const e2 = ((xv - 1.6) / 1.0) ** 2 + ((yv + 0.5) / 0.9) ** 2 + 0.4;
          const g = Math.min(e1, e2) * 3.2 + 0.6 * noise(a * 0.3 + b * 0.7, seed);
          const q = (Math.floor(Math.min(15, g) / 1.5) * 1.5) / 15;
          c.fillStyle = cmap(VIRIDIS, q);
          c.fillRect(L + (a * pw) / nx, B - ((b + 1) * ph) / ny, pw / nx + 0.6, ph / ny + 0.6);
        }
      }
      frame();
      colorbar(VIRIDIS, "ΔG (kJ/mol)", [0, 5, 10, 15], 0, 15);
      break;
    }
    case "dccm": {
      axes(1, 323, [1, 100, 200, 300], 1, 323, [1, 100, 200, 300]);
      const m = 64;
      const cw = pw / m;
      const ch = ph / m;
      for (let p = 0; p < m; p++) {
        for (let q = 0; q < m; q++) {
          const v =
            p === q
              ? 1
              : Math.exp(-Math.abs(p - q) / 4) * 0.9 +
                0.55 * Math.sin(p / 7 + seed) * Math.sin(q / 7 + seed) * (Math.abs(p - q) > 8 ? 1 : 0.3) +
                0.12 * (noise(p * 0.5 + q * 0.37, seed) - 0.5);
          c.fillStyle = cmap(RDBU, (Math.max(-1, Math.min(1, v)) + 1) / 2);
          c.fillRect(L + p * cw, B - (q + 1) * ch, cw + 0.6, ch + 0.6);
        }
      }
      frame();
      colorbar(RDBU, "Correlation", [-1, -0.5, 0, 0.5, 1], -1, 1);
      break;
    }
    default:
      axes(0, 100, [0, 50, 100], 0, 1, [0, 0.5, 1]);
      frame();
  }

  if (watermark && w >= 160) {
    c.save();
    c.translate((L + R) / 2, (T + B) / 2);
    c.rotate(-0.22);
    c.fillStyle = "rgba(0,0,0,0.07)";
    c.font = `bold ${30 * s}px Arial, sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("PLACEHOLDER DATA", 0, 0);
    c.restore();
  }
}

type Props = { kind: FigureKind; ligands: string[]; seedKey: string; label: string };

export function PlaceholderPlot({ kind, ligands, seedKey, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ligKey = ligands.join("+");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const draw = () => drawPlaceholderPlot(el, kind, ligKey ? ligKey.split("+") : [], seedKey);
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [kind, ligKey, seedKey]);
  return <canvas ref={ref} className="md-plot-ph" role="img" aria-label={`${label} placeholder plot with invented values`} />;
}
