/** Parser and server-side SVG path builder for GROMACS .xvg files. */

export type XvgSeries = { legend: string; points: [number, number][] };
export type Xvg = { title: string; xLabel: string; yLabel: string; series: XvgSeries[] };

const unquote = (s: string) => s.trim().replace(/^"|"$/g, "");

export function parseXvg(text: string): Xvg {
  const out: Xvg = { title: "", xLabel: "", yLabel: "", series: [] };
  const legends: string[] = [];
  const rows: number[][] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("@")) {
      const title = line.match(/^@\s+title\s+(.*)$/);
      const xl = line.match(/^@\s+xaxis\s+label\s+(.*)$/);
      const yl = line.match(/^@\s+yaxis\s+label\s+(.*)$/);
      const lg = line.match(/^@\s+s(\d+)\s+legend\s+(.*)$/);
      if (title) out.title = unquote(title[1]);
      else if (xl) out.xLabel = unquote(xl[1]);
      else if (yl) out.yLabel = unquote(yl[1]);
      else if (lg) legends[Number(lg[1])] = unquote(lg[2]);
      continue;
    }
    if (line.startsWith("&")) continue;
    const nums = line.split(/\s+/).map(Number);
    if (nums.length >= 2 && nums.every(Number.isFinite)) rows.push(nums);
  }

  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  for (let c = 1; c < cols; c++) {
    const points = rows.filter((r) => r.length > c).map((r) => [r[0], r[c]] as [number, number]);
    out.series.push({ legend: legends[c - 1] || (cols > 2 ? `Series ${c}` : ""), points });
  }
  return out;
}

/** Reduce to at most `max` points by keeping the min and max of each bucket, so peaks survive. */
export function downsample(points: [number, number][], max = 400): [number, number][] {
  if (points.length <= max) return points;
  const buckets = Math.floor(max / 2);
  const size = points.length / buckets;
  const out: [number, number][] = [];
  for (let b = 0; b < buckets; b++) {
    const slice = points.slice(Math.floor(b * size), Math.floor((b + 1) * size));
    if (!slice.length) continue;
    let lo = slice[0];
    let hi = slice[0];
    for (const p of slice) {
      if (p[1] < lo[1]) lo = p;
      if (p[1] > hi[1]) hi = p;
    }
    out.push(...([lo, hi].sort((a, b) => a[0] - b[0]) as [number, number][]));
  }
  return out;
}

export type PlotGeometry = { path: string; xMin: number; xMax: number; yMin: number; yMax: number };

/** SVG polyline path for one series in a width x height box, with the y-axis padded by 5%. */
export function seriesPath(points: [number, number][], width: number, height: number): PlotGeometry {
  if (!points.length) return { path: "", xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  const pad = (yMax - yMin || Math.abs(yMax) || 1) * 0.05;
  yMin -= pad;
  yMax += pad;
  const sx = (x: number) => (xMax === xMin ? 0 : ((x - xMin) / (xMax - xMin)) * width);
  const sy = (y: number) => height - ((y - yMin) / (yMax - yMin)) * height;
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join("");
  return { path, xMin, xMax, yMin, yMax };
}
