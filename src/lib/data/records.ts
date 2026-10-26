import { ligandSlug } from "../../components/md/showcase/data/api";
import { SAMPLE_PUBLISHED, sampleRunsFor } from "../../components/md/showcase/data/sample";
import type { FigureKind, MdRun, PublishedPdb } from "../../components/md/showcase/data/types";
import type { PlotData } from "../../components/md/pages/XvgPlot";
import { createPublicClient } from "../supabase/public";
import { typeForFigureKind } from "./analysis-types";
import { cachedRead } from "./cache";
import { mapPublicRecord, mapPublishedPdb, type PublicRecordRow, type PublishedPdbRow } from "./map";

/**
 * Server-side reads for the public pages. With Supabase configured they come from the public_records and
 * published_pdbs views (the approved snapshot, never a working copy); without it they serve the sample runs.
 * Sample runs are flagged `placeholder` and are kept out of search engines.
 *
 * Each lookup is its own small cached query, so no cache entry grows with the size of the database.
 */

type Linkable = Pick<MdRun, "pdb_id" | "ligand_resn" | "ligand_name" | "ligand_pubchem_cid"> & { slug?: string };

/** Real records carry the slug the database generated; sample runs derive it the same way. */
export const recordSlug = (run: Linkable) => run.slug ?? `${run.pdb_id.toLowerCase()}-${ligandSlug(run)}`;
export const recordPath = (run: Linkable) => `/simulations/${recordSlug(run)}`;
export const isIndexable = (run: Pick<MdRun, "placeholder">) => !run.placeholder;

const TAGS = ["records"];
export const LIST_LIMIT = 120;

const fail = (what: string, message: string): never => {
  throw new Error(`could not load ${what}: ${message}`);
};
/**
 * While the database has no real record for the demo entry (1AFS), its built-in sample runs fill in, flagged
 * `placeholder` so they are labelled as a preview and kept out of search engines and the sitemap.
 * They disappear for good once a real 1AFS record is published.
 */
const DEMO_PDB = "1AFS";
const hasRealDemo = async () => (await dbRecords("pdb", DEMO_PDB, 1)).length > 0;
const withDemo = async (real: MdRun[], keep: (r: MdRun) => boolean = () => true): Promise<MdRun[]> =>
  (await hasRealDemo()) ? real : [...real, ...sample().filter(keep)];

const sample = () => SAMPLE_PUBLISHED.flatMap((p) => sampleRunsFor(p.pdb_id));

const dbRecords = cachedRead(
  async (kind: "recent" | "slug" | "pdb" | "type" | "simtype", value: string, limit: number): Promise<MdRun[]> => {
    const db = createPublicClient()!;
    let q = db.from("public_records").select("*");
    if (kind === "slug") q = q.eq("slug", value);
    if (kind === "pdb") q = q.eq("pdb_id", value);
    if (kind === "type") q = q.contains("analysis_slugs", [value]);
    if (kind === "simtype") q = q.eq("sim_type_slug", value);
    const { data, error } = await q.order("published_at", { ascending: false }).limit(limit);
    if (error) fail("records", error.message);
    return (data as PublicRecordRow[]).map(mapPublicRecord);
  },
  "records:query",
  TAGS,
);

/** The newest records, for list pages. */
export async function listRecords(limit = LIST_LIMIT): Promise<MdRun[]> {
  if (!createPublicClient()) return sample().slice(0, limit);
  return (await withDemo(await dbRecords("recent", "", limit))).slice(0, limit);
}

export async function getRecord(slug: string): Promise<MdRun | undefined> {
  const s = slug.toLowerCase();
  if (!createPublicClient()) return sample().find((r) => recordSlug(r) === s);
  return (await dbRecords("slug", s, 1))[0] ?? ((await hasRealDemo()) ? undefined : sample().find((r) => recordSlug(r) === s));
}

export async function getRecordsForPdb(pdbId: string): Promise<MdRun[]> {
  const id = pdbId.toUpperCase();
  if (!createPublicClient()) return sampleRunsFor(id);
  const real = await dbRecords("pdb", id, 50);
  return id === DEMO_PDB ? withDemo(real) : real;
}

export async function getRecordsForType(typeSlug: string): Promise<MdRun[]> {
  const kinds = new Set<FigureKind>();
  for (const k of ["rmsd", "rmsf", "rg", "sasa", "hbond", "contacts", "mmpbsa", "pca", "fel", "dccm", "other"] as FigureKind[]) {
    if (typeForFigureKind(k)?.slug === typeSlug) kinds.add(k);
  }
  const demo = (r: MdRun) => !!r.md_figures?.some((f) => kinds.has(f.kind));
  if (createPublicClient()) return withDemo(await dbRecords("type", typeSlug, LIST_LIMIT), demo);
  return sample().filter(demo);
}

/** Published records of one simulation type (apo protein, protein–ligand complex, umbrella sampling ...). */
export async function getRecordsForSimulationType(slug: string): Promise<MdRun[]> {
  const demo = (r: MdRun) => r.simulation_type_slug === slug;
  if (createPublicClient()) return withDemo(await dbRecords("simtype", slug, LIST_LIMIT), demo);
  return sample().filter(demo);
}

export async function searchRecords({ pdb, type }: { pdb?: string; type?: string }): Promise<MdRun[]> {
  if (pdb) return getRecordsForPdb(pdb);
  if (type) return getRecordsForType(type);
  return listRecords();
}

export type RecordSummary = { slug: string; pdb_id: string | null; published_at: string | null; updated_at: string | null; placeholder?: boolean };

const dbSummaries = cachedRead(
  async (): Promise<RecordSummary[]> => {
    const db = createPublicClient()!;
    const { data, error } = await db
      .from("public_records")
      .select("slug,pdb_id,published_at,updated_at")
      .order("published_at", { ascending: false })
      .limit(50000);
    if (error) fail("record list", error.message);
    return data as RecordSummary[];
  },
  "records:summaries",
  TAGS,
);

/** Every published record, with just enough to build the sitemap and static params. */
export async function listRecordSummaries(): Promise<RecordSummary[]> {
  if (!createPublicClient()) {
    return sample().map((r) => ({ slug: recordSlug(r), pdb_id: r.pdb_id, published_at: r.published_at, updated_at: null, placeholder: !!r.placeholder }));
  }
  const real = await dbSummaries();
  if (await hasRealDemo()) return real;
  return [...real, ...sample().map((r) => ({ slug: recordSlug(r), pdb_id: r.pdb_id, published_at: r.published_at, updated_at: null, placeholder: true }))];
}

const dbPdbs = cachedRead(
  async (): Promise<PublishedPdb[]> => {
    const db = createPublicClient()!;
    const { data, error } = await db.from("published_pdbs").select("*").order("pdb_id").limit(50000);
    if (error) fail("published PDB IDs", error.message);
    return (data as PublishedPdbRow[]).map(mapPublishedPdb);
  },
  "records:pdbs",
  TAGS,
);

export async function listPublishedPdbs(): Promise<PublishedPdb[]> {
  if (!createPublicClient()) return SAMPLE_PUBLISHED;
  const real = await dbPdbs();
  return real.some((p) => p.pdb_id === DEMO_PDB) ? real : [...real, ...SAMPLE_PUBLISHED];
}

export type FileSeries = { file_id: string; parsed: PlotData };

const dbSeries = cachedRead(
  async (recordId: string): Promise<FileSeries[]> => {
    const db = createPublicClient()!;
    const { data, error } = await db.from("public_record_series").select("file_id,parsed").eq("record_id", recordId);
    if (error) fail("plot data", error.message);
    return data as FileSeries[];
  },
  "records:series",
  TAGS,
);

/** Plot data for one published record's files. */
export async function getRecordSeries(recordId: string): Promise<FileSeries[]> {
  if (!createPublicClient()) return [];
  return dbSeries(recordId);
}
