import type { MdRun, PublishedPdb } from "./types";
import { SAMPLE_PUBLISHED, sampleRunsFor } from "./sample";

/**
 * Data access for the showcase. No backend is connected yet, so every read
 * serves the sample runs and downloads are disabled. To go live, replace the
 * bodies below with the Supabase reads described in the backend contract:
 * md_runs (+ md_figures) filtered to status = "published", the
 * md_published_pdbs view for suggestions, and the download-bundle function.
 */

/** True while the showcase serves sample data (no backend connected). */
export const IS_PREVIEW = true;

export const SITE_URL: string = process.env.NEXT_PUBLIC_SITE_URL || "https://insilicology.com";

const latency = () => new Promise((r) => window.setTimeout(r, 650));

export async function fetchPublishedRuns(pdbId: string): Promise<MdRun[]> {
  await latency();
  return sampleRunsFor(pdbId.trim().toUpperCase());
}

/** Published PDB IDs for search suggestions (one row per PDB). */
export async function fetchPublishedPdbs(): Promise<PublishedPdb[]> {
  return SAMPLE_PUBLISHED;
}

/** Signed zip URL of a run's figures + .xvg + CITATION.txt; pass figure ids to bundle only those. */
export async function requestDownloadBundle(_runId: string, _figureIds?: string[]): Promise<string> {
  throw new Error("Downloads are disabled in this preview.");
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
