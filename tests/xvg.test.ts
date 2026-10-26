import { describe, expect, it } from "vitest";
import { downsample, parseXvg, seriesPath } from "../src/lib/xvg";

const SAMPLE = `# This file was created by gmx rms
@    title "RMSD"
@    xaxis  label "Time (ns)"
@    yaxis  label "RMSD (nm)"
@TYPE xy
@ s0 legend "Backbone"
@ s1 legend "Ligand"
    0.0   0.00   0.00
    0.1   0.06   0.10
    0.2   0.09   0.12
`;

describe("parseXvg", () => {
  it("reads title, axis labels and legends", () => {
    const x = parseXvg(SAMPLE);
    expect(x.title).toBe("RMSD");
    expect(x.xLabel).toBe("Time (ns)");
    expect(x.yLabel).toBe("RMSD (nm)");
    expect(x.series.map((s) => s.legend)).toEqual(["Backbone", "Ligand"]);
  });

  it("splits columns into series and skips comments", () => {
    const x = parseXvg(SAMPLE);
    expect(x.series[0].points).toEqual([[0, 0], [0.1, 0.06], [0.2, 0.09]]);
    expect(x.series[1].points[2]).toEqual([0.2, 0.12]);
  });

  it("copes with CRLF, block separators and empty input", () => {
    expect(parseXvg("@ title \"T\"\r\n1 2\r\n&\r\n3 4\r\n").series[0].points).toEqual([[1, 2], [3, 4]]);
    expect(parseXvg("").series).toEqual([]);
  });

  it("ignores malformed data rows", () => {
    expect(parseXvg("1 2\nfoo bar\n3 4").series[0].points).toEqual([[1, 2], [3, 4]]);
  });
});

describe("downsample", () => {
  it("returns short series unchanged and caps long ones, keeping the extremes", () => {
    const pts: [number, number][] = Array.from({ length: 5000 }, (_, i) => [i, i === 2500 ? 99 : Math.sin(i / 50)]);
    const out = downsample(pts, 400);
    expect(out.length).toBeLessThanOrEqual(400);
    expect(Math.max(...out.map((p) => p[1]))).toBe(99);
    expect(downsample(pts.slice(0, 10), 400)).toHaveLength(10);
  });
});

describe("seriesPath", () => {
  it("maps points into the box with y flipped", () => {
    const g = seriesPath([[0, 0], [10, 1]], 100, 50);
    expect(g.path.startsWith("M0.0 ")).toBe(true);
    expect(g.xMin).toBe(0);
    expect(g.xMax).toBe(10);
    expect(seriesPath([], 100, 50).path).toBe("");
  });

  it("does not divide by zero for a flat line or a single x", () => {
    expect(seriesPath([[0, 5], [1, 5]], 100, 50).path).not.toMatch(/NaN|Infinity/);
    expect(seriesPath([[2, 1], [2, 3]], 100, 50).path).not.toMatch(/NaN|Infinity/);
  });
});
