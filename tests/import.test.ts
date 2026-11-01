import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analysisOf, classifyFile, cleanName, ligandOf, parseCsv, pdbIdOf, recordFromRow, simulationTypeOf, type IndexRow } from "../src/lib/import/classify";

const rows = parseCsv(readFileSync("MD_Simulation_Database/Simulation_Index.csv", "utf8")) as unknown as IndexRow[];
const by = (name: string) => rows.find((r) => r.simulation === name)!;

describe("Simulation_Index.csv", () => {
  it("parses every row, including quoted fields", () => {
    expect(rows.length).toBeGreaterThan(120);
    expect(by("1H2K-3LN1_1H2K").time_ns).toBe("100.0");
    expect(rows.every((r) => r.simulation && r.database_path && r.engine)).toBe(true);
  });
  it("gives every row a unique slug", () => {
    const slugs = rows.map((r) => recordFromRow(r).slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))).toBe(true);
  });
  it("builds a valid record from every row", () => {
    for (const r of rows) {
      const d = recordFromRow(r);
      expect(d.title.length).toBeGreaterThanOrEqual(3);
      expect(d.pdbId === null || /^[0-9][A-Za-z0-9]{3}$/.test(d.pdbId)).toBe(true);
      expect(d.authors).toEqual(["Ehsanul Islam", "Tawsif Al Arian"]);
      expect(d.tags.every((t) => t.length >= 1 && t.length <= 60)).toBe(true);
    }
  });
});

describe("names", () => {
  it("finds PDB codes in folder names or targets", () => {
    expect(pdbIdOf("2HBS-Quercetin", "Sickle haemoglobin (2HBS)")).toBe("2HBS");
    expect(pdbIdOf("Himel_1M17-Apigetrin", "")).toBe("1M17");
    expect(pdbIdOf("6m71-107905_1", "SARS-CoV-2 RdRp (6M71)")).toBe("6M71");
    expect(pdbIdOf("Tarik_Aaniz_desmond-LSRB-Rhamnetin", "LsrB / RbsB / RpfC")).toBeNull();
    expect(pdbIdOf("HPV-E6_5280445_C", "HPV E6 oncoprotein")).toBeNull();
    expect(pdbIdOf("anamul", "")).toBeNull();
  });
  it("strips contributor prefixes", () => {
    expect(cleanName("Tarik_Aaniz_P1-ltxa-EGCG")).toBe("P1-ltxa-EGCG");
    expect(cleanName("paralog_dock_5V5Z_H8-H2a")).toBe("5V5Z H8-H2a");
  });
  it("reads ligand names", () => {
    expect(ligandOf("2HBS-Quercetin", "2HBS")?.name).toBe("Quercetin");
    expect(ligandOf("Himel_1M17-Chlorogenic-acid", "1M17")?.name).toBe("Chlorogenic acid");
    expect(ligandOf("Malaysia_1S1P+46779915_1", "1S1P")?.pubchemCid).toBe(46779915);
    expect(ligandOf("CTG_aptamer1", null)).toBeNull();
    expect(ligandOf("Himel_1M17_analysis_COMBINED-comparison", "1M17")).toBeNull();
  });
  it("picks a simulation type from the topic", () => {
    expect(simulationTypeOf("Vaccine-Immunoinformatics_TLR-complexes")).toBe("protein-protein-complex");
    expect(simulationTypeOf("Nucleic-Acid_Aptamers")).toBe("nucleic-acid");
    expect(simulationTypeOf("GPCR_Membrane-Receptors")).toBe("membrane-protein");
    expect(simulationTypeOf("Protein-Folding_PDI")).toBe("apo-protein");
    expect(simulationTypeOf("Uncategorized_Protein-Ligand")).toBe("other");
    expect(simulationTypeOf("Oncology_Kinases")).toBe("protein-ligand-complex");
  });
});

describe("files", () => {
  it("maps names to analyses", () => {
    const cases: [string, string][] = [
      ["xvg__gyrate.xvg", "radius-of-gyration"], ["plot_xvg__rmsd_lig_fitprot.jpg", "rmsd"], ["data1__images__PL-RMSD.jpg", "rmsd"],
      ["data1__images__L-RMSF.jpg", "rmsf"], ["xvg__sasa_protein.xvg", "sasa"], ["xvg__hbnum.xvg", "hydrogen-bonds"],
      ["images__MMGBSA_histogram.jpg", "mm-pbsa"], ["System-1_Normal_GB_Delta.csv", "mm-pbsa"], ["xvg__eigenval.xvg", "pca"],
      ["xvg__com_dist.xvg", "contact-map"], ["data1__images__PL-Contacts_Histogram.jpg", "contact-map"], ["data1__images__L-Torsions.jpg", "other"],
      ["FEL.jpg", "free-energy-landscape"],
    ];
    for (const [f, a] of cases) expect([f, analysisOf(f)]).toEqual([f, a]);
  });
  it("keeps data and figures, skips TIFF and markers", () => {
    expect(classifyFile("x/images_JPG/FEL.jpg", 10)).toMatchObject({ kind: "png", analysis: "free-energy-landscape" });
    expect(classifyFile("x/xvg/xvg__rmsf_lig.xvg", 10)).toMatchObject({ kind: "xvg", analysis: "rmsf", caption: "rmsf lig" });
    expect(classifyFile("x/images_TIFF/FEL.tif", 10)).toBeNull();
    expect(classifyFile("x/.done", 1)).toBeNull();
  });
});

describe("recordFromRow", () => {
  it("describes a protein–ligand run", () => {
    const d = recordFromRow(by("2HBS-Quercetin"));
    expect(d).toMatchObject({ slug: "2hbs-quercetin", pdbId: "2HBS", software: "GROMACS", lengthNs: 100, simulationType: "protein-ligand-complex" });
    expect(d.molecules[0].name).toBe("Quercetin");
    expect(d.title).toBe("Sickle haemoglobin (2HBS) with Quercetin, 100 ns GROMACS simulation");
    expect(d.tags).toEqual(expect.arrayContaining(["Hematology", "Sickle Cell", "HbS", "GROMACS", "100 ns"]));
  });
  it("handles runs with no PDB code, unknown length and combined comparisons", () => {
    expect(recordFromRow(by("GPCR5B_GPCR")).lengthNs).toBeNull();
    expect(recordFromRow(by("Himel_1M17_analysis_COMBINED-comparison")).tags).toContain("comparison");
    expect(recordFromRow(by("Tarik_Aaniz_desmond-LSRB-Rhamnetin")).pdbId).toBeNull();
  });
});
