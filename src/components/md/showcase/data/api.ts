import { createPublicClient } from "../../../../lib/supabase/public";
import { isSupabaseConfigured } from "../../../../lib/supabase/env";
import { mapPublicRecord, mapPublishedPdb, type PublicRecordRow, type PublishedPdbRow } from "../../../../lib/data/map";
import type { MdRun, PublishedPdb } from "./types";
import { SAMPLE_PUBLISHED, sampleRunsFor } from "./sample";

/**
 * Browser-side data access for the showcase search. With Supabase configured it reads the public views as
 * the anonymous role (so it can only see approved records); without it, it serves the sample runs.
 */

/** True while the showcase serves sample data (no backend connected). */
export const IS_PREVIEW = !isSupabaseConfigured();

/** Zipped bundles are not built yet; every published figure and data file downloads on its own. */
export const BUNDLES_ENABLED = false;

export const SITE_URL: string = process.env.NEXT_PUBLIC_SITE_URL || "https://insilicology.com";

const latency = () => new Promise((r) => window.setTimeout(r, 650));

export async function fetchPublishedRuns(pdbId: string): Promise<MdRun[]> {
  const id = pdbId.trim().toUpperCase();
  const db = createPublicClient();
  if (!db) {
    await latency();
    return sampleRunsFor(id);
  }
  const { data, error } = await db.from("public_records").select("*").eq("pdb_id", id).order("published_at", { ascending: false }).limit(50);
  if (error) throw new Error("The search is unavailable right now. Please try again in a moment.");
  const real = (data as PublicRecordRow[]).map(mapPublicRecord);
  // the demo entry shows its placeholder runs until a real record for it is published
  return real.length ? real : sampleRunsFor(id);
}

/** Published PDB IDs for search suggestions (one row per PDB). */
export async function fetchPublishedPdbs(): Promise<PublishedPdb[]> {
  const db = createPublicClient();
  if (!db) return SAMPLE_PUBLISHED;
  const { data, error } = await db.from("published_pdbs").select("*").order("pdb_id").limit(200);
  if (error) return []; // suggestions are optional
  const real = (data as PublishedPdbRow[]).map(mapPublishedPdb);
  return real.some((p) => p.pdb_id === "1AFS") ? real : [...real, ...SAMPLE_PUBLISHED];
}

/** Signed zip URL of a run's figures + .xvg + CITATION.txt; pass figure ids to bundle only those. */
export async function requestDownloadBundle(_runId: string, _figureIds?: string[]): Promise<string> {
  throw new Error("Zipped downloads are not available yet. Download each figure or data file from its card.");
}

export function ligandSlug(run: Pick<MdRun, "ligand_resn" | "ligand_name" | "ligand_pubchem_cid">) {
  return (run.ligand_resn || run.ligand_name || String(run.ligand_pubchem_cid ?? "ligand"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalisePdbId(id: string) {
  return id.trim().toUpperCase();
}

export function isValidPdbId(id: string) {
  return /^[0-9][A-Za-z0-9]{3}$/.test(id.trim());
}
