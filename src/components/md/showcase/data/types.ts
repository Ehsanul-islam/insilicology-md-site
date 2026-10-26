export type FigureKind = "rmsd" | "rmsf" | "rg" | "sasa" | "hbond" | "contacts" | "mmpbsa" | "pca" | "fel" | "dccm" | "other";

export type MdFigure = {
  id: string;
  run_id: string;
  kind: FigureKind;
  image_path: string | null;
  xvg_path: string | null;
  caption: string | null;
  /** Resolved public URLs (filled client-side). */
  image_url?: string | null;
  xvg_url?: string | null;
};

/** One published complex: a PDB entry with one ligand set. */
export type MdRun = {
  id: string;
  pdb_id: string;
  ligand_name: string | null;
  ligand_pubchem_cid: number | null;
  /** One residue name ("TES") or several joined with "+" ("TES+NAP"). */
  ligand_resn: string | null;
  protein_name?: string | null;
  force_field: string | null;
  length_ns: number | null;
  replicas: number | null;
  status: "running" | "done" | "published";
  doi: string | null;
  citation_bibtex: string | null;
  created_at: string;
  published_at: string | null;
  md_figures?: MdFigure[];
  /** True only for layout-preview placeholder rows; never set for real data. */
  placeholder?: boolean;
};

/** One row per published PDB ID, for search suggestions. */
export type PublishedPdb = {
  pdb_id: string;
  protein_name: string | null;
  complexes: number;
  ligands: string[];
};
