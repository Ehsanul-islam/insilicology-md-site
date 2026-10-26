/* Glyph-grid renderer for the small ASCII surfaces (search lens, motifs).
 * A frame is a Uint8Array of ramp indices (0 = blank … 5 = densest glyph),
 * row-major on a cols × rows grid. Glyphs are pre-drawn once per (cell size,
 * ink colour) into an atlas and blitted per cell, so the grid stays regular
 * whatever the font's glyph coverage is.
 */

export const GLYPH_RAMP = [" ", "·", ":", "+", "▪", "■"] as const;

/** Monospace cell proportions (height / width). */
export const CELL_ASPECT = 1.7;

const MONO_STACK = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

type Atlas = { canvas: HTMLCanvasElement; cw: number; ch: number };
const atlasCache = new Map<string, Atlas>();

function getAtlas(cw: number, ch: number, ink: string): Atlas {
  const key = `${cw.toFixed(2)}|${ch.toFixed(2)}|${ink}`;
  const hit = atlasCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  const w = Math.ceil(cw);
  const h = Math.ceil(ch);
  canvas.width = w * GLYPH_RAMP.length;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(ch * 0.82)}px ${MONO_STACK}`;
    for (let i = 1; i < GLYPH_RAMP.length; i++) {
      const g = GLYPH_RAMP[i];
      // ▪ and ■ are drawn as squares so their size is exact on every platform
      if (g === "■" || g === "▪") {
        const s = g === "■" ? Math.min(cw, ch) * 0.86 : Math.min(cw, ch) * 0.56;
        ctx.fillRect(i * w + (w - s) / 2, (h - s) / 2, s, s);
      } else {
        ctx.fillText(g, i * w + w / 2, h / 2 + ch * 0.04);
      }
    }
  }
  const atlas = { canvas, cw: w, ch: h };
  if (atlasCache.size > 24) atlasCache.clear();
  atlasCache.set(key, atlas);
  return atlas;
}

/** Size a visible canvas for a grid at a given CSS width. */
export function sizeCanvas(canvas: HTMLCanvasElement, cssWidth: number, cols: number, rows: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = (cssWidth / cols) * dpr;
  const w = Math.round(cw * cols);
  const h = Math.round(cw * CELL_ASPECT * rows);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${(cssWidth / cols) * CELL_ASPECT * rows}px`;
}

export function drawGrid(canvas: HTMLCanvasElement, levels: Uint8Array, cols: number, rows: number, ink: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cw = canvas.width / cols;
  const ch = canvas.height / rows;
  const atlas = getAtlas(cw, ch, ink);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const l = levels[y * cols + x];
      if (l) ctx.drawImage(atlas.canvas, l * atlas.cw, 0, atlas.cw, atlas.ch, x * cw, y * ch, cw, ch);
    }
  }
}

/** Parse pre-rendered rows of digit strings into a level grid. */
export function framesToLevels(rowsText: string[]) {
  const cols = Math.max(...rowsText.map((r) => r.length));
  const rows = rowsText.length;
  const levels = new Uint8Array(cols * rows);
  rowsText.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) levels[y * cols + x] = r.charCodeAt(x) - 48;
  });
  return { levels, cols, rows };
}

export function readInk(el: Element | null, varName = "--md-ink") {
  if (!el) return "#161616";
  return getComputedStyle(el).getPropertyValue(varName).trim() || "#161616";
}
