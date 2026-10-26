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
  /** Set on records read from the database. */
  slug?: string;
  title?: string;
  type_slug?: string | null;
  /** What is simulated (apo protein, protein–ligand complex, umbrella sampling ...). */
  simulation_type_slug?: string | null;
  simulation_type_name?: string | null;
  license?: string | null;
  /** Real records only: the analyses the record contains, its files, and the contributor's description. */
  analyses?: { slug: string; name: string }[];
  files?: MdRecordFile[];
  description?: string | null;
  software?: string | null;
  methodology?: string | null;
  authors?: string[];
  contributor?: string | null;
  tags?: string[];
};

/** A file of a published record. `analysis_slug` is null for supporting files (structures, trajectories ...). */
export type MdRecordFile = {
  id: string;
  kind: string;
  filename: string;
  size_bytes: number | null;
  caption: string | null;
  analysis_slug: string | null;
};

/** One row per published PDB ID, for search suggestions. */
export type PublishedPdb = {
  pdb_id: string;
  protein_name: string | null;
  complexes: number;
  ligands: string[];
};
