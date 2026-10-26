import { describe, expect, it } from "vitest";
import record from "./fixtures/public_record.json";
import pdb from "./fixtures/published_pdb.json";
import post from "./fixtures/public_post.json";
import { figuresFor, fileUrl, ligandsOf, mapAnalysisType, mapPublicPost, mapPublicRecord, mapPublishedPdb, mapSimulationType, type PublicPostRow, type PublicRecordRow } from "../src/lib/data/map";

// The fixtures are the real output of the public views (npm run db:fixtures).
const row = record as unknown as PublicRecordRow;

describe("mapPublicRecord", () => {
  const run = mapPublicRecord(row);

  it("maps identity, citation and run details", () => {
    expect(run.id).toBe(row.id);
    expect(run.slug).toBe("1afs-tes");
    expect(run.pdb_id).toBe("1AFS");
    expect(run.protein_name).toBe("3-alpha-hydroxysteroid dehydrogenase");
    expect(run.force_field).toBe("CHARMM36");
    expect(run.length_ns).toBe(100);
    expect(run.replicas).toBe(3);
    expect(run.doi).toBe("10.1000/example.1");
    expect(run.status).toBe("published");
    expect(run.placeholder).toBeUndefined();
  });

  it("maps the simulation type", () => {
    expect(run.simulation_type_slug).toBe("protein-ligand-complex");
    expect(run.simulation_type_name).toBe("Protein–ligand complex");
    const none = mapPublicRecord({ ...row, sim_type_slug: null, sim_type_name: null } as PublicRecordRow);
    expect(none.simulation_type_slug).toBeNull();
  });

  it("joins ligands in the declared order", () => {
    expect(run.ligand_resn).toBe("TES+NAP");
    expect(run.ligand_name).toBe("Testosterone with NADP+");
    expect(run.ligand_pubchem_cid).toBe(6013);
  });

  it("builds figures from data and image files, ignoring structures and trajectories", () => {
    const kinds = (run.md_figures ?? []).map((f) => f.kind).sort();
    expect(kinds).toEqual(["rg", "rmsd", "rmsf"]);
    const rmsd = run.md_figures!.find((f) => f.kind === "rmsd")!;
    expect(rmsd.xvg_url).toMatch(/^\/api\/files\/[0-9a-f-]{36}$/);
    expect(rmsd.image_url).toMatch(/^\/api\/files\/[0-9a-f-]{36}$/);
    expect(rmsd.caption).toBe("Backbone RMSD");
  });

  it("lists the analyses and files of the record", () => {
    expect(run.analyses?.map((a) => a.slug).sort()).toEqual(["radius-of-gyration", "rmsd", "rmsf"]);
    expect(run.analyses?.every((a) => a.name)).toBe(true);
    expect(run.files?.filter((f) => f.analysis_slug === null).map((f) => f.kind).sort()).toEqual(["pdb", "xtc"]);
    expect(run.files?.find((f) => f.filename === "rmsf.xvg")?.analysis_slug).toBe("rmsf");
  });

  it("gives an admin-added analysis the generic figure kind instead of dropping it", () => {
    const figs = figuresFor({ ...row, files: [{ ...row.files[0], figure_kind: null, analysis_slug: "lipid-order", analysis_name: "Lipid order", kind: "xvg" }] });
    expect(figs.map((f) => f.kind)).toEqual(["other"]);
  });

  it("falls back to the type's figure kind for untagged data files", () => {
    // the untagged .xvg belongs to an RMSD record, so it joins the rmsd figure instead of becoming its own
    const figs = figuresFor(row);
    expect(figs.filter((f) => f.kind === "rmsd")).toHaveLength(1);
  });

  it("never exposes storage paths as URLs", () => {
    for (const f of run.md_figures ?? []) {
      expect(f.image_url ?? "").not.toContain("OWNER");
      expect(f.xvg_url ?? "").not.toContain("OWNER");
    }
    expect(fileUrl("abc")).toBe("/api/files/abc");
  });

  it("copes with missing optional fields", () => {
    const bare = mapPublicRecord({ ...row, molecules: [], files: [], length_ns: null, pdb_id: null, doi: null } as PublicRecordRow);
    expect(bare.ligand_resn).toBeNull();
    expect(bare.md_figures).toEqual([]);
    expect(bare.length_ns).toBeNull();
    expect(bare.pdb_id).toBe("");
  });

  it("reads numeric strings from Postgres numeric columns", () => {
    expect(mapPublicRecord({ ...row, length_ns: "250.5" } as unknown as PublicRecordRow).length_ns).toBe(250.5);
  });
});

describe("ligandsOf", () => {
  it("ignores non-ligand molecules and blank residue names", () => {
    const l = ligandsOf([{ kind: "protein", name: "P" }, { kind: "ligand", name: "X", resn: "" }, { kind: "ligand", name: "Y", resn: "yy" }]);
    expect(l.resn).toBe("YY");
    expect(l.name).toBe("X with Y");
  });
});

describe("other mappers", () => {
  it("maps published PDB rows", () => {
    expect(mapPublishedPdb(pdb as never)).toEqual({ pdb_id: "1AFS", protein_name: "3-alpha-hydroxysteroid dehydrogenase", complexes: 1, ligands: ["TES+NAP"] });
    expect(mapPublishedPdb({ pdb_id: "1abc", protein_name: null, complexes: 2, ligands: null }).ligands).toEqual([]);
  });

  it("maps public posts", () => {
    const p = mapPublicPost(post as unknown as PublicPostRow);
    expect(p.slug).toBe("setting-up-charmm36-in-gromacs");
    expect(p.author).toBe("Dr Fixture");
    expect(p.category).toBe("Methods");
    expect(p.categorySlug).toBe("methods");
    expect(p.references[0].url).toContain("doi.org");
    expect(mapPublicPost({ ...(post as unknown as PublicPostRow), author_name: null, category_name: null, category_slug: null }).author).toBe("Insilicology contributor");
  });

  it("maps simulation type rows", () => {
    const t = mapSimulationType({ slug: "apo-protein", name: "Apo protein", aliases: ["Apo"], summary: "s", intro: ["a", "b"], requires_structure: true, sort_order: 10 });
    expect(t).toEqual({ slug: "apo-protein", name: "Apo protein", aliases: ["Apo"], summary: "s", intro: ["a", "b"], requiresStructure: true });
    expect(mapSimulationType({ slug: "x", name: "X", aliases: null as never, summary: "", intro: null as never, requires_structure: false, sort_order: 1 }).aliases).toEqual([]);
  });

  it("keeps code-side figure kinds for built-in types", () => {
    const t = mapAnalysisType({ slug: "radius-of-gyration", name: "Rg", aliases: [], summary: "s", intro: ["a"], command: null, tutorial_slug: null, requires_structure: true, sort_order: 1 });
    expect(t.figureKind).toBe("rg");
    expect(mapAnalysisType({ slug: "brand-new", name: "New", aliases: [], summary: "", intro: [], command: null, tutorial_slug: null, requires_structure: false, sort_order: 1 }).figureKind).toBeUndefined();
  });
});
