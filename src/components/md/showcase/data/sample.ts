import type { FigureKind, MdRun, PublishedPdb } from "./types";

/**
 * Sample published runs until the backend is connected. Values are bracketed
 * placeholders and figures have no image, so the page draws watermarked
 * placeholder plots in their place and labels the run as a layout preview.
 */

const PROTEIN = "3α-hydroxysteroid dehydrogenase";

function run(id: string, resn: string, name: string, kinds: FigureKind[]): MdRun {
  return {
    id: `preview-${id}`,
    pdb_id: "1AFS",
    ligand_name: name,
    ligand_pubchem_cid: null,
    ligand_resn: resn,
    protein_name: PROTEIN,
    force_field: null,
    length_ns: null,
    replicas: null,
    status: "published",
    doi: "[DOI]",
    citation_bibtex: `@dataset{insilicology_1afs_${id.replace(/-/g, "_")},
  author    = {[AUTHOR]},
  title     = {Molecular dynamics of 1AFS with ${name} (${resn})},
  publisher = {Insilicology},
  year      = {[YEAR]},
  doi       = {[DOI]}
}`,
    created_at: "",
    published_at: null,
    placeholder: true,
    simulation_type_slug: "protein-ligand-complex",
    simulation_type_name: "Protein–ligand complex",
    md_figures: kinds.map((k) => ({
      id: `preview-${id}-${k}`,
      run_id: `preview-${id}`,
      kind: k,
      image_path: null,
      xvg_path: null,
      caption: null,
      image_url: null,
    })),
  };
}

const RUNS: MdRun[] = [
  run("tes", "TES", "Testosterone", ["rmsd", "rmsf", "rg", "sasa", "hbond", "mmpbsa"]),
  run("nap", "NAP", "NADP⁺", ["rmsd", "rmsf", "rg", "sasa", "hbond"]),
  run("tes-nap", "TES+NAP", "Testosterone with NADP⁺", ["rmsd", "rmsf", "rg", "sasa", "hbond", "contacts", "mmpbsa", "pca", "fel", "dccm"]),
];

export function sampleRunsFor(pdbId: string): MdRun[] {
  return pdbId === "1AFS" ? RUNS : [];
}

export const SAMPLE_PUBLISHED: PublishedPdb[] = [
  { pdb_id: "1AFS", protein_name: PROTEIN, complexes: 3, ligands: ["TES", "NAP", "TES+NAP"] },
];
