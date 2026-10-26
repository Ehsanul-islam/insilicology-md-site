import { ligandSlug } from "../../components/md/showcase/data/api";
import { SAMPLE_PUBLISHED, sampleRunsFor } from "../../components/md/showcase/data/sample";
import type { FigureKind, MdRun, PublishedPdb } from "../../components/md/showcase/data/types";
import { typeForFigureKind } from "./analysis-types";

/**
 * Server-side reads for the public pages. They serve the sample runs until the
 * Supabase backend is connected (Milestone 3); the signatures stay the same.
 * Sample runs are flagged `placeholder` and are kept out of search engines.
 */

export const recordSlug = (run: Pick<MdRun, "pdb_id" | "ligand_resn" | "ligand_name" | "ligand_pubchem_cid">) =>
  `${run.pdb_id.toLowerCase()}-${ligandSlug(run)}`;

export const recordPath = (run: Pick<MdRun, "pdb_id" | "ligand_resn" | "ligand_name" | "ligand_pubchem_cid">) =>
  `/simulations/${recordSlug(run)}`;

export const isIndexable = (run: Pick<MdRun, "placeholder">) => !run.placeholder;

export async function listRecords(): Promise<MdRun[]> {
  return SAMPLE_PUBLISHED.flatMap((p) => sampleRunsFor(p.pdb_id));
}

export async function getRecord(slug: string): Promise<MdRun | undefined> {
  return (await listRecords()).find((r) => recordSlug(r) === slug.toLowerCase());
}

export async function getRecordsForPdb(pdbId: string): Promise<MdRun[]> {
  return sampleRunsFor(pdbId.toUpperCase());
}

export async function listPublishedPdbs(): Promise<PublishedPdb[]> {
  return SAMPLE_PUBLISHED;
}

export async function getRecordsForType(typeSlug: string): Promise<MdRun[]> {
  const kinds = new Set<FigureKind>();
  for (const k of ["rmsd", "rmsf", "rg", "sasa", "hbond", "contacts", "mmpbsa", "pca", "fel", "dccm", "other"] as FigureKind[]) {
    if (typeForFigureKind(k)?.slug === typeSlug) kinds.add(k);
  }
  return (await listRecords()).filter((r) => r.md_figures?.some((f) => kinds.has(f.kind)));
}

export async function searchRecords({ pdb, type }: { pdb?: string; type?: string }): Promise<MdRun[]> {
  if (pdb) return getRecordsForPdb(pdb);
  if (type) return getRecordsForType(type);
  return listRecords();
}
