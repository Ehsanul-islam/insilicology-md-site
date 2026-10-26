/**
 * Procedural ASCII motifs for section frames, card icons and decorative
 * mini-plots. These are illustrations, never data: plots have no axes,
 * no numbers, and are generated from fixed seeds.
 */

export type MotifKind =
  | "complex" | "apo" | "ppi" | "membrane"
  | "rmsd" | "rmsf" | "rg" | "sasa" | "hbond" | "mmpbsa" | "fel" | "dccm"
  | "docking" | "ngs" | "network" | "dft"
  | "wheel" | "helix" | "search" | "quote" | "table";

type Field = (u: number, v: number, t: number) => number;

// Deterministic value noise -------------------------------------------------
function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}
function noise1(x: number, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i + seed * 57.3);
  const b = hash(i + 1 + seed * 57.3);
  return a + (b - a) * f * f * (3 - 2 * f);
}
function noise2(x: number, y: number, seed = 0) {
  const i = Math.floor(x), j = Math.floor(y);
  const fx = x - i, fy = y - j;
  const h = (a: number, b: number) => hash(a * 15.7 + b * 311.3 + seed * 7.1);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const top = h(i, j) + (h(i + 1, j) - h(i, j)) * sx;
  const bot = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * sx;
  return top + (bot - top) * sy;
}

const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** A globular "protein" blob with ribbon-like striations. */
function blob(u: number, v: number, cx: number, cy: number, r: number, seed: number) {
  const dx = u - cx, dy = v - cy;
  const a = Math.atan2(dy, dx);
  const wobble = 0.82 + 0.28 * noise1(a * 2.2 + 5, seed) + 0.08 * Math.sin(a * 5 + seed);
  const d = Math.hypot(dx, dy) / (r * wobble);
  if (d > 1) return 0;
  const stripes = 0.55 + 0.45 * Math.sin((dx * 0.6 + dy) * 46 + noise2(u * 9, v * 9, seed) * 5);
  const body = 0.35 + 0.65 * (1 - d * d);
  return clamp(body * (0.4 + 0.6 * stripes) * 0.8);
}

function spot(u: number, v: number, cx: number, cy: number, r: number) {
  const d = Math.hypot(u - cx, (v - cy) * 1.1) / r;
  return d > 1 ? 0 : 1 - d * 0.25;
}

/** Plot a curve y = f(u) (0..1, 0 at bottom) as a glyph stroke. */
function curve(fn: (u: number) => number, thickness = 0.06): Field {
  return (u, v) => {
    const y = 1 - fn(u);
    const d = Math.abs(v - y) / thickness;
    return d > 1 ? 0 : 0.95 - d * 0.5;
  };
}

function bars(vals: (i: number) => number, n: number, gap = 0.35, fill = 0.75): Field {
  return (u, v) => {
    const i = Math.floor(u * n);
    const within = u * n - i;
    if (within < gap / 2 || within > 1 - gap / 2) return 0;
    const h = vals(i);
    return 1 - v <= h ? fill : 0;
  };
}

const FIELDS: Record<MotifKind, Field> = {
  complex: (u, v) => Math.max(
    blob(u, v, 0.38, 0.48, 0.3, 1) * 0.85,
    blob(u, v, 0.64, 0.55, 0.26, 2) * 0.6,
    spot(u, v, 0.52, 0.42, 0.07),
  ),
  apo: (u, v) => {
    const b = blob(u, v, 0.5, 0.5, 0.36, 3) * 0.85;
    const ring = Math.abs(Math.hypot(u - 0.66, (v - 0.36) * 1.1) - 0.07);
    return ring < 0.018 ? 1 : b;
  },
  ppi: (u, v) => Math.max(blob(u, v, 0.31, 0.5, 0.25, 4) * 0.85, blob(u, v, 0.7, 0.5, 0.24, 5) * 0.55),
  membrane: (u, v) => {
    const heads = (y: number) => (Math.abs(v - y) < 0.05 && Math.sin(u * 70) > 0.1 ? 1 : 0);
    const tails = v > 0.3 && v < 0.7 && Math.sin(u * 70 + 1.6) > 0.82 ? 0.38 : 0;
    return Math.max(heads(0.26), heads(0.74), tails);
  },

  rmsd: curve((u) => clamp(0.12 + 0.55 * (1 - Math.exp(-u * 9)) + 0.09 * (noise1(u * 30, 1) - 0.5))),
  rmsf: bars((i) => 0.15 + 0.6 * Math.pow(noise1(i * 0.9, 2), 2.2) + (i % 17 === 3 ? 0.25 : 0), 36, 0.2, 0.7),
  rg: curve((u) => 0.58 + 0.08 * (noise1(u * 22, 3) - 0.5) - 0.06 * u),
  sasa: curve((u) => 0.5 + 0.12 * Math.sin(u * 8) * (noise1(u * 4, 4)) + 0.08 * (noise1(u * 35, 5) - 0.5)),
  hbond: bars((i) => Math.round(1 + 4 * noise1(i * 1.7, 6)) / 6, 28, 0.3, 0.8),
  mmpbsa: (u, v) => {
    const row = Math.floor(v * 5);
    const within = v * 5 - row;
    if (within < 0.25 || within > 0.75) return 0;
    const len = [0.82, 0.55, 0.68, 0.3, 0.44][row];
    return u <= len ? (row === 0 ? 0.95 : 0.6) : 0;
  },
  fel: (u, v) => {
    const e = Math.min(
      Math.hypot(u - 0.36, (v - 0.46) * 1.4),
      Math.hypot(u - 0.68, (v - 0.6) * 1.3) * 1.25,
    ) + 0.05 * noise2(u * 6, v * 6, 7);
    const band = (e * 18) % 1;
    if (e < 0.06) return 1;
    return band < 0.32 ? clamp(0.9 - e * 1.6) : 0;
  },
  dccm: (u, v) => {
    const i = Math.floor(u * 14), j = Math.floor(v * 14);
    if (i === j) return 1;
    const c = Math.sin(i * 0.9) * Math.sin(j * 0.9) + 0.35 * (noise2(i, j, 8) - 0.5);
    return clamp(Math.abs(c) * 0.9);
  },

  docking: (u, v, t) => {
    const gap = 0.07 + 0.05 * Math.sin(t * 0.9);
    return Math.max(blob(u, v, 0.32 - gap, 0.5, 0.26, 9) * 0.85, blob(u, v, 0.68 + gap, 0.5, 0.25, 10) * 0.55);
  },
  ngs: (u, v) => {
    const row = Math.floor(v * 7);
    const within = v * 7 - row;
    if (within < 0.3 || within > 0.7) return 0;
    const start = noise1(row * 3.1, 11) * 0.45;
    const len = 0.35 + noise1(row * 1.3, 12) * 0.35;
    return u > start && u < start + len ? 0.55 + 0.4 * (Math.sin(u * 60 + row) > 0.6 ? 1 : 0) : 0;
  },
  network: (u, v) => {
    const nodes = [[0.2, 0.3], [0.5, 0.18], [0.8, 0.35], [0.35, 0.7], [0.66, 0.78], [0.52, 0.48]];
    let best = 0;
    for (const [x, y] of nodes) best = Math.max(best, spot(u, v, x, y, 0.06));
    const edges = [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [0, 1], [3, 4], [2, 4]];
    for (const [a, b] of edges) {
      const [x1, y1] = nodes[a], [x2, y2] = nodes[b];
      const dx = x2 - x1, dy = y2 - y1;
      const t = clamp(((u - x1) * dx + (v - y1) * dy) / (dx * dx + dy * dy));
      const d = Math.hypot(u - (x1 + t * dx), (v - (y1 + t * dy)) * 1.2);
      if (d < 0.018) best = Math.max(best, 0.4);
    }
    return best;
  },
  dft: (u, v) => {
    const dx = u - 0.5, dy = (v - 0.5) * 1.15;
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const lobe = Math.abs(Math.cos(a * 3)) * 0.34;
    if (r < 0.06) return 1;
    if (Math.abs(r - lobe) < 0.025) return 0.7;
    return r < lobe ? 0.22 : 0;
  },

  wheel: (u, v, t) => {
    const dx = u - 0.5, dy = (v - 0.5) * 1.05;
    const r = Math.hypot(dx, dy);
    if (r > 0.45 || r < 0.14) return 0;
    const a = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1;
    const head = (t * 0.18) % 1;
    const dist = (head - a + 1) % 1;
    return dist < 0.7 ? clamp(1 - dist * 1.35) : 0;
  },
  helix: (u, v) => {
    const y1 = 0.5 + 0.32 * Math.sin(u * Math.PI * 6);
    const y2 = 0.5 - 0.32 * Math.sin(u * Math.PI * 6);
    const front = Math.cos(u * Math.PI * 6) > 0;
    const d1 = Math.abs(v - y1), d2 = Math.abs(v - y2);
    if (d1 < 0.09) return front ? 0.95 : 0.45;
    if (d2 < 0.09) return front ? 0.45 : 0.95;
    return Math.sin(u * Math.PI * 24) > 0.85 && v > Math.min(y1, y2) && v < Math.max(y1, y2) ? 0.3 : 0;
  },
  search: (u, v) => {
    const r = Math.hypot(u - 0.42, (v - 0.42) * 1.1);
    if (Math.abs(r - 0.24) < 0.05) return 0.95;
    if (r < 0.2) return blob(u, v, 0.42, 0.42, 0.18, 13) * 0.6;
    const along = (u - 0.6) - (v - 0.6);
    return Math.abs(along) < 0.06 && u > 0.6 && u < 0.88 && v > 0.6 ? 0.95 : 0;
  },
  quote: (u, v) => Math.max(spot(u, v, 0.35, 0.4, 0.12), spot(u, v, 0.65, 0.4, 0.12)) * (v < 0.55 ? 1 : 0),
  table: (u, v) => {
    const row = (v * 5) % 1 < 0.14;
    const col = (u * 4) % 1 < 0.06;
    return row || col ? 0.5 : 0;
  },
};

/** Shapes keep their proportions in wide frames; plots stretch to fill. */
const SHAPES = new Set<MotifKind>(["complex", "apo", "ppi", "docking", "network", "dft", "wheel", "search", "quote"]);

export function motifLevels(kind: MotifKind, cols: number, rows: number, t = 0, cellAspect = 1.7) {
  const f = FIELDS[kind];
  const out = new Uint8Array(cols * rows);
  const a = SHAPES.has(kind) ? (rows * cellAspect) / cols : 1;
  for (let y = 0; y < rows; y++) {
    const v = (y + 0.5) / rows;
    for (let x = 0; x < cols; x++) {
      const u = 0.5 + ((x + 0.5) / cols - 0.5) / a;
      const d = Math.min(1, f(u, v, t) * 1.2);
      out[y * cols + x] = d < 0.08 ? 0 : d < 0.25 ? 1 : d < 0.45 ? 2 : d < 0.65 ? 3 : d < 0.88 ? 4 : 5;
    }
  }
  return out;
}

export const ANIMATED_MOTIFS = new Set<MotifKind>(["wheel", "docking"]);
