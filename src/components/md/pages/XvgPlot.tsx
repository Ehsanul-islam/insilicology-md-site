import { niceTicks } from "../../../lib/xvg";

/** The data stored in `record_files.parsed` (see toPlotData in src/lib/xvg.ts). */
export type PlotData = {
  title?: string;
  xLabel?: string;
  yLabel?: string;
  series: { legend: string; points: [number, number][] }[];
};

const W = 640;
const H = 320;
const M = { l: 58, r: 16, t: 16, b: 48 };

const fmt = (v: number) => {
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(1);
  return String(Number(v.toPrecision(4)));
};

/**
 * Line plot as plain SVG. It renders on the server (no script), so the figure is in the page HTML that
 * search engines and no-JS visitors get. Series differ by dash pattern as well as weight, so they stay
 * readable without colour.
 */
export function XvgPlot({ data, caption, id }: { data: PlotData; caption: string; id: string }) {
  const series = data.series.filter((s) => s.points.length > 1);
  if (!series.length) return null;

  const all = series.flatMap((s) => s.points);
  const xMin = Math.min(...all.map((p) => p[0]));
  const xMax = Math.max(...all.map((p) => p[0]));
  let yMin = Math.min(...all.map((p) => p[1]));
  let yMax = Math.max(...all.map((p) => p[1]));
  const pad = (yMax - yMin || Math.abs(yMax) || 1) * 0.06;
  yMin -= pad;
  yMax += pad;

  const pw = W - M.l - M.r;
  const ph = H - M.t - M.b;
  const sx = (x: number) => M.l + (xMax === xMin ? 0 : ((x - xMin) / (xMax - xMin)) * pw);
  const sy = (y: number) => M.t + ph - ((y - yMin) / (yMax - yMin)) * ph;
  const xt = niceTicks(xMin, xMax, 6);
  const yt = niceTicks(yMin, yMax, 5);
  const named = series.filter((s) => s.legend);
  const summary = `${caption}. ${series.length} data series, x from ${fmt(xMin)} to ${fmt(xMax)}${data.xLabel ? ` ${data.xLabel}` : ""}.`;

  return (
    <figure className="md-plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`} preserveAspectRatio="xMidYMid meet">
        <title id={`${id}-t`}>{data.title || caption}</title>
        <desc id={`${id}-d`}>{summary}</desc>
        {yt.map((v) => (
          <g key={`y${v}`}>
            <line className="md-plot__grid" x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} />
            <text className="md-plot__tick" x={M.l - 8} y={sy(v) + 4} textAnchor="end">{fmt(v)}</text>
          </g>
        ))}
        {xt.map((v) => (
          <g key={`x${v}`}>
            <line className="md-plot__axis" x1={sx(v)} x2={sx(v)} y1={M.t + ph} y2={M.t + ph + 4} />
            <text className="md-plot__tick" x={sx(v)} y={M.t + ph + 18} textAnchor="middle">{fmt(v)}</text>
          </g>
        ))}
        <rect className="md-plot__frame" x={M.l} y={M.t} width={pw} height={ph} />
        {series.map((s, i) => (
          <polyline
            key={i}
            className={`md-plot__line md-plot__line--${i % 8}`}
            fill="none"
            points={s.points.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ")}
          />
        ))}
        {data.xLabel && <text className="md-plot__label" x={M.l + pw / 2} y={H - 8} textAnchor="middle">{data.xLabel}</text>}
        {data.yLabel && (
          <text className="md-plot__label" transform={`translate(14 ${M.t + ph / 2}) rotate(-90)`} textAnchor="middle">{data.yLabel}</text>
        )}
      </svg>
      {named.length > 0 && (
        <ul className="md-plot__legend">
          {series.map((s, i) =>
            s.legend ? (
              <li key={i}>
                <svg width="28" height="10" aria-hidden="true"><line className={`md-plot__line md-plot__line--${i % 8}`} x1="0" x2="28" y1="5" y2="5" /></svg>
                {s.legend}
              </li>
            ) : null,
          )}
        </ul>
      )}
    </figure>
  );
}
