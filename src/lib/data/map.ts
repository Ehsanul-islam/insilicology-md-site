import type { FigureKind, MdFigure, MdRecordFile, MdRun, PublishedPdb } from "../../components/md/showcase/data/types";
import { ANALYSIS_TYPES, type AnalysisType } from "./analysis-types";
import type { SimulationType } from "./simulation-types";
import type { BlogPost } from "./posts";

/** Rows as returned by the public_records / published_pdbs / public_posts views and analysis_types table. */
export type PublicRecordRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type_slug: string | null;
  type_name: string | null;
  sim_type_slug: string | null;
  sim_type_name: string | null;
  pdb_id: string | null;
  protein_name: string | null;
  molecules: { kind?: string; name?: string; resn?: string; pubchem_cid?: number }[];
  software: string | null;
  software_version: string | null;
  force_field: string | null;
  length_ns: number | string | null;
  replicas: number | null;
  methodology: string | null;
  authors: string[];
  doi: string | null;
  paper_url: string | null;
  citation_bibtex: string | null;
  license: string | null;
  tags: string[];
  files: {
    id: string;
    kind: string;
    filename: string;
    storage_path: string;
    size_bytes?: number | null;
    caption: string | null;
    figure_kind: string | null;
    analysis_slug?: string | null;
    analysis_name?: string | null;
  }[];
  analysis_slugs?: string[] | null;
  analysis_names?: string[] | null;
  contributor: string | null;
  published_at: string | null;
  updated_at: string | null;
};

export type PublishedPdbRow = { pdb_id: string; protein_name: string | null; complexes: number; ligands: string[] | null };

export type PublicPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content_md: string;
  featured_image_path: string | null;
  category_slug: string | null;
  category_name: string | null;
  tags: string[];
  refs: { text: string; url?: string }[];
  author_name: string | null;
  published_at: string;
  updated_at: string | null;
};

export type SimulationTypeRow = {
  slug: string;
  name: string;
  aliases: string[];
  summary: string;
  intro: string[];
  requires_structure: boolean;
  sort_order: number;
};

export type AnalysisTypeRow = {
  slug: string;
  name: string;
  aliases: string[];
  summary: string;
  intro: string[];
  command: string | null;
  tutorial_slug: string | null;
  requires_structure: boolean;
  sort_order: number;
};

const FIGURE_KINDS: FigureKind[] = ["rmsd", "rmsf", "rg", "sasa", "hbond", "contacts", "mmpbsa", "pca", "fel", "dccm", "other"];
const DATA_KINDS = new Set(["xvg", "csv", "dat", "txt", "xpm"]);
const IMAGE_KINDS = new Set(["png", "svg"]);

/** Stable URL the browser can use for a published file; the route checks it belongs to a published record. */
export const fileUrl = (fileId: string) => `/api/files/${fileId}`;

const isFigureKind = (k: string | null | undefined): k is FigureKind => !!k && (FIGURE_KINDS as string[]).includes(k);

/** Ligand residue names joined with "+" ("TES+NAP") and their display names, as the showcase expects. */
export function ligandsOf(molecules: PublicRecordRow["molecules"]) {
  const ligs = (molecules ?? []).filter((m) => m.kind === "ligand");
  const resn = ligs.map((m) => m.resn).filter(Boolean) as string[];
  const names = ligs.map((m) => m.name || m.resn).filter(Boolean) as string[];
  return {
    resn: resn.length ? resn.map((r) => r.toUpperCase()).join("+") : null,
    name: names.length ? names.join(" with ") : null,
    cid: ligs.find((m) => typeof m.pubchem_cid === "number")?.pubchem_cid ?? null,
  };
}

/** Group a record's files into figures: one per analysis kind, with its data file and image when present. */
/** The showcase's fixed figure kind for an analysis slug; admin-added analyses have none and fall back to "other". */
const figureKindOfAnalysis = (slug: string | null | undefined): FigureKind | undefined =>
  slug ? ANALYSIS_TYPES.find((t) => t.slug === slug)?.figureKind ?? "other" : undefined;

export function figuresFor(row: Pick<PublicRecordRow, "id" | "files" | "type_slug">): MdFigure[] {
  const typeKind = ANALYSIS_TYPES.find((t) => t.slug === row.type_slug)?.figureKind;
  const groups = new Map<FigureKind, MdFigure>();
  for (const f of row.files ?? []) {
    const isData = DATA_KINDS.has(f.kind);
    const isImage = IMAGE_KINDS.has(f.kind);
    if (!isData && !isImage) continue; // structures, trajectories and archives are downloads, not figures
    const kind = isFigureKind(f.figure_kind) ? f.figure_kind : figureKindOfAnalysis(f.analysis_slug) ?? typeKind;
    if (!kind) continue;
    const fig =
      groups.get(kind) ??
      ({ id: f.id, run_id: row.id, kind, image_path: null, xvg_path: null, caption: f.caption, image_url: null, xvg_url: null } as MdFigure);
    if (isImage && !fig.image_path) {
      fig.image_path = f.storage_path;
      fig.image_url = fileUrl(f.id);
    }
    if (isData && !fig.xvg_path) {
      fig.xvg_path = f.storage_path;
      fig.xvg_url = fileUrl(f.id);
    }
    fig.caption ||= f.caption;
    groups.set(kind, fig);
  }
  return [...groups.values()];
}

export function mapPublicRecord(row: PublicRecordRow): MdRun {
  const lig = ligandsOf(row.molecules);
  return {
    id: row.id,
    pdb_id: (row.pdb_id ?? "").toUpperCase(),
    ligand_name: lig.name,
    ligand_pubchem_cid: lig.cid,
    ligand_resn: lig.resn,
    protein_name: row.protein_name,
    force_field: row.force_field,
    length_ns: row.length_ns == null ? null : Number(row.length_ns),
    replicas: row.replicas,
    status: "published",
    doi: row.doi,
    citation_bibtex: row.citation_bibtex,
    created_at: row.published_at ?? "",
    published_at: row.published_at,
    md_figures: figuresFor(row),
    slug: row.slug,
    title: row.title,
    type_slug: row.type_slug,
    simulation_type_slug: row.sim_type_slug,
    simulation_type_name: row.sim_type_name,
    license: row.license,
    analyses: (row.analysis_slugs ?? []).map((slug, i) => ({ slug, name: row.analysis_names?.[i] ?? slug })),
    files: (row.files ?? []).map(
      (f): MdRecordFile => ({ id: f.id, kind: f.kind, filename: f.filename, size_bytes: f.size_bytes ?? null, caption: f.caption, analysis_slug: f.analysis_slug ?? null }),
    ),
    description: row.description,
    software: [row.software, row.software_version].filter(Boolean).join(" ") || null,
    methodology: row.methodology,
    authors: row.authors ?? [],
    contributor: row.contributor,
    tags: row.tags ?? [],
  };
}

export const mapPublishedPdb = (row: PublishedPdbRow): PublishedPdb => ({
  pdb_id: row.pdb_id.toUpperCase(),
  protein_name: row.protein_name,
  complexes: row.complexes,
  ligands: row.ligands ?? [],
});

export const mapPublicPost = (row: PublicPostRow): BlogPost => ({
  slug: row.slug,
  title: row.title,
  excerpt: row.excerpt,
  contentMd: row.content_md,
  featuredImage: row.featured_image_path,
  category: row.category_name ?? "Uncategorised",
  categorySlug: row.category_slug ?? "uncategorised",
  tags: row.tags ?? [],
  author: row.author_name || "Insilicology contributor",
  publishedAt: row.published_at,
  updatedAt: row.updated_at ?? row.published_at,
  references: row.refs ?? [],
});

export const mapSimulationType = (row: SimulationTypeRow): SimulationType => ({
  slug: row.slug,
  name: row.name,
  aliases: row.aliases ?? [],
  summary: row.summary,
  intro: row.intro ?? [],
  requiresStructure: row.requires_structure,
});

/** Database rows keep the code-side fields (figure kind, file rules) from the built-in list, matched by slug. */
export function mapAnalysisType(row: AnalysisTypeRow): AnalysisType {
  const builtIn = ANALYSIS_TYPES.find((t) => t.slug === row.slug);
  return {
    slug: row.slug,
    name: row.name,
    figureKind: builtIn?.figureKind ?? (isFigureKind(row.slug) ? row.slug : undefined),
    aliases: row.aliases ?? [],
    summary: row.summary,
    intro: row.intro ?? [],
    command: row.command ?? undefined,
    tutorial: row.tutorial_slug ?? undefined,
    requiresStructure: row.requires_structure,
  };
}
