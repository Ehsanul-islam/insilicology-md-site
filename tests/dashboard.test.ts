import { describe, expect, it } from "vitest";
import { fromCrossref, fromRcsb, normaliseDoi } from "../src/lib/dashboard/citation";
import { checkUpload, checklist, isDeletable, isEditable, isPdbId, isSubmittable, kindFromFilename, safeFileName, type AnalysisRules } from "../src/lib/dashboard/validate";
import { niceTicks, parseTable, toPlotData, parseXvg } from "../src/lib/xvg";

const rmsd: AnalysisRules = { slug: "rmsd", name: "RMSD analysis", allowed: ["xvg", "csv", "png"], required: ["xvg"], maxMb: 50 };

describe("file names and kinds", () => {
  it("finds the kind from the extension", () => {
    expect(kindFromFilename("rmsd_backbone.XVG")).toBe("xvg");
    expect(kindFromFilename("md.xtc")).toBe("xtc");
    expect(kindFromFilename("photo.jpeg")).toBe("png");
    expect(kindFromFilename("topol.top")).toBe("itp");
    expect(kindFromFilename("noextension")).toBe("other");
  });
  it("makes names safe for Storage paths", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("my file (1).xvg")).toBe("my-file-1.xvg");
    expect(safeFileName("C:\\data\\RMSD ä.XVG")).toBe("RMSD-a.xvg");
    expect(safeFileName("....")).toBe("file");
  });
});

describe("checkUpload", () => {
  it("accepts allowed kinds and returns a safe name", () => {
    expect(checkUpload({ name: "my rmsd.xvg", size: 1000 }, rmsd)).toEqual({ ok: true, kind: "xvg", name: "my-rmsd.xvg" });
  });
  it("refuses empty, wrong-kind and oversize files", () => {
    expect(checkUpload({ name: "a.xvg", size: 0 }, rmsd)).toMatchObject({ ok: false });
    expect(checkUpload({ name: "a.xtc", size: 10 }, rmsd)).toMatchObject({ ok: false, error: expect.stringContaining(".xvg") });
    expect(checkUpload({ name: "a.xvg", size: 51 * 1024 * 1024 }, rmsd)).toMatchObject({ ok: false, error: expect.stringContaining("50 MB") });
  });
  it("supporting files cannot be analysis data", () => {
    expect(checkUpload({ name: "start.pdb", size: 10 }, null)).toMatchObject({ ok: true, kind: "pdb" });
    expect(checkUpload({ name: "rmsd.xvg", size: 10 }, null)).toMatchObject({ ok: false });
  });
});

describe("status rules", () => {
  it("matches the database", () => {
    expect(isEditable("pending")).toBe(false);
    expect(isEditable("published")).toBe(true);
    expect(isSubmittable("published")).toBe(false);
    expect(isSubmittable("changes_requested")).toBe(true);
    expect(isDeletable("draft", false)).toBe(true);
    expect(isDeletable("draft", true)).toBe(false);
    expect(isDeletable("changes_requested", false)).toBe(false);
  });
  it("validates ids", () => {
    expect(isPdbId("1AFS")).toBe(true);
    expect(isPdbId("AFS1")).toBe(false);
  });
});

describe("checklist", () => {
  const base = {
    simulationType: { name: "Protein–ligand complex", requiresStructure: true },
    pdbId: "1AFS",
    molecules: [{}],
    doi: null,
    paperUrl: null,
    title: "A record",
    files: [{ kind: "xvg", analysisSlug: "rmsd" }],
    analyses: [{ ...rmsd, citation: "optional" as const, molecules: "required" as const }],
  };
  it("is all green for a complete record", () => {
    expect(checklist(base).every((i) => i.ok)).toBe(true);
  });
  it("flags what is missing", () => {
    const bad = checklist({ ...base, pdbId: null, molecules: [], files: [{ kind: "csv", analysisSlug: "rmsd" }] });
    expect(bad.filter((i) => !i.ok).map((i) => i.label)).toEqual([
      expect.stringContaining("PDB ID"),
      "RMSD analysis: a .xvg file",
      expect.stringContaining("molecular system"),
    ]);
  });
  it("needs an analysis, and does not ask for a PDB ID when the type does not need one", () => {
    const none = checklist({ ...base, simulationType: { name: "Peptide", requiresStructure: false }, pdbId: null, files: [{ kind: "pdb", analysisSlug: null }] });
    expect(none.find((i) => i.label.startsWith("At least one analysis"))?.ok).toBe(false);
    expect(none.some((i) => i.label.startsWith("PDB ID"))).toBe(false);
  });
});

describe("citation helpers", () => {
  it("normalises DOIs", () => {
    expect(normaliseDoi("https://doi.org/10.1021/acs.jcim.1c00001")).toBe("10.1021/acs.jcim.1c00001");
    expect(normaliseDoi("doi: 10.1000/abc")).toBe("10.1000/abc");
    expect(normaliseDoi("not a doi")).toBeNull();
  });
  it("maps a Crossref work", () => {
    const c = fromCrossref({
      DOI: "10.1000/abc",
      title: ["Binding of <i>X</i> to Y"],
      author: [{ given: "Ada", family: "Lovelace" }, { name: "The Consortium" }],
      "container-title": ["J. Chem. Phys."],
      issued: { "date-parts": [[2023, 5]] },
      volume: "12",
      page: "1-9",
    });
    expect(c).toMatchObject({ title: "Binding of X to Y", authors: ["Ada Lovelace", "The Consortium"], year: 2023, journal: "J. Chem. Phys.", url: "https://doi.org/10.1000/abc" });
    expect(c.bibtex).toContain("@article{lovelace2023,");
    expect(c.bibtex).toContain("author = {Ada Lovelace and The Consortium}");
  });
  it("maps RCSB answers", () => {
    expect(fromRcsb({ struct: { title: "Crystal structure" } }, { rcsb_polymer_entity: { pdbx_description: "3-ALPHA-HYDROXYSTEROID DEHYDROGENASE" } }).proteinName).toBe("3-alpha-hydroxysteroid dehydrogenase");
    expect(fromRcsb({ struct: { title: "Only a title" } }, null).proteinName).toBe("Only a title");
  });
});

describe("plot data", () => {
  it("parses csv with a header", () => {
    const x = parseTable("time_ns,rmsd_nm,ligand\n0,0.0,0.0\n1,0.1,0.2\n2,0.2,0.3\n");
    expect(x.xLabel).toBe("time_ns");
    expect(x.series.map((s) => s.legend)).toEqual(["rmsd_nm", "ligand"]);
    expect(x.series[1].points[2]).toEqual([2, 0.3]);
  });
  it("parses whitespace data without a header", () => {
    expect(parseTable("# c\n0 1\n1 2\n").series[0].points).toEqual([[0, 1], [1, 2]]);
  });
  it("limits what is stored", () => {
    const rows = Array.from({ length: 5000 }, (_, i) => `${i} ${Math.sin(i / 50)} ${i % 7} ${i % 3} 1 2 3 4 5 6`).join("\n");
    const p = toPlotData(parseXvg(rows), 200)!;
    expect(p.series).toHaveLength(8);
    expect(p.series[0].points.length).toBeLessThanOrEqual(200);
    expect(toPlotData(parseXvg("1 2\n"))).toBeNull();
  });
  it("picks round ticks", () => {
    expect(niceTicks(0, 1)).toEqual([0, 0.5, 1]);
    expect(niceTicks(0, 100, 5)).toEqual([0, 50, 100]);
    expect(niceTicks(0.03, 0.31, 5)).toEqual([0.1, 0.2, 0.3]);
    expect(niceTicks(0, 10, 6)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(3, 3)).toEqual([3]);
  });
});
