/**
 * Rules the dashboard checks before the database does, so users get clear messages early. The database
 * (record_files_rules, submit_record) stays the authority: keep these in step with
 * supabase/migrations/*_record_analyses.sql.
 */

/** File kinds the database accepts (the check constraint on record_files.kind). */
export const FILE_KINDS = ["xvg", "csv", "txt", "dat", "xpm", "pdb", "gro", "xtc", "trr", "tpr", "mol2", "itp", "png", "svg", "pdf", "zip", "other"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

/** Files that do not belong to one analysis: structures, trajectories, topologies, documents, archives. */
export const SUPPORTING_KINDS: FileKind[] = ["pdb", "gro", "xtc", "trr", "tpr", "mol2", "itp", "png", "svg", "pdf", "zip", "txt", "other"];
export const SUPPORTING_MAX_MB = 500;

/** Kinds the server reads to draw plots. */
export const PLOTTABLE_KINDS: FileKind[] = ["xvg", "csv", "dat", "txt"];
export const PARSE_MAX_BYTES = 50 * 1024 * 1024;

const EXT_KIND: Record<string, FileKind> = { tsv: "csv", top: "itp", cpt: "other", ndx: "other", mdp: "txt", log: "txt", edr: "other", jpg: "png", jpeg: "png" };

/** The file kind for a file name, from its extension. */
export function kindFromFilename(name: string): FileKind {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if ((FILE_KINDS as readonly string[]).includes(ext)) return ext as FileKind;
  return EXT_KIND[ext] ?? "other";
}

/** A file name safe to use in a Storage path: no folders, only letters, digits, dot, dash and underscore. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const m = base.match(/^(.*?)(\.[A-Za-z0-9]{1,8})?$/);
  const stem = (m?.[1] ?? base).normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[.-]+|-+$/g, "").slice(0, 100);
  return `${stem || "file"}${(m?.[2] ?? "").toLowerCase()}`;
}

export type AnalysisRules = { slug: string; name: string; allowed: string[]; required: string[]; maxMb: number };

export type UploadCheck = { ok: true; kind: FileKind; name: string } | { ok: false; error: string };

/** May this file be added to this analysis (or as a supporting file when `analysis` is null)? */
export function checkUpload(file: { name: string; size: number }, analysis: AnalysisRules | null): UploadCheck {
  const kind = kindFromFilename(file.name);
  const name = safeFileName(file.name);
  if (!(file.size > 0)) return { ok: false, error: "This file is empty." };
  if (analysis) {
    if (!analysis.allowed.includes(kind)) {
      return { ok: false, error: `${analysis.name} accepts ${analysis.allowed.map((k) => `.${k}`).join(", ")} files, not .${kind}.` };
    }
    if (file.size > analysis.maxMb * 1024 * 1024) return { ok: false, error: `${analysis.name} files can be at most ${analysis.maxMb} MB.` };
  } else {
    if (!SUPPORTING_KINDS.includes(kind)) return { ok: false, error: `.${kind} files are analysis data. Add them under the analysis they belong to.` };
    if (file.size > SUPPORTING_MAX_MB * 1024 * 1024) return { ok: false, error: `Supporting files can be at most ${SUPPORTING_MAX_MB} MB.` };
  }
  return { ok: true, kind, name };
}

export type RecordStatus = "draft" | "pending" | "changes_requested" | "published" | "rejected" | "unpublished";

export const STATUS_LABEL: Record<RecordStatus, string> = {
  draft: "Draft",
  pending: "In review",
  changes_requested: "Changes requested",
  published: "Published",
  rejected: "Not approved",
  unpublished: "Unpublished",
};

/** Can the owner edit the working copy in this status? (Matches can_edit_record.) */
export const isEditable = (s: RecordStatus) => s !== "pending";
/** Can the owner submit in this status? (Matches submit_record.) */
export const isSubmittable = (s: RecordStatus) => ["draft", "changes_requested", "rejected", "unpublished"].includes(s);
/** Can the owner delete the record? (Matches the records delete policy.) */
export const isDeletable = (s: RecordStatus, isPublic: boolean) => !isPublic && (s === "draft" || s === "rejected");

export type ChecklistInput = {
  simulationType: { name: string; requiresStructure: boolean } | null;
  pdbId: string | null;
  molecules: unknown[];
  doi: string | null;
  paperUrl: string | null;
  title: string;
  files: { kind: string; analysisSlug: string | null }[];
  analyses: (AnalysisRules & { citation: "required" | "optional"; molecules: "required" | "optional" })[];
};

export type ChecklistItem = { label: string; ok: boolean };

/** What still stops this record from being submitted, mirroring submit_record. */
export function checklist(r: ChecklistInput): ChecklistItem[] {
  const used = r.analyses.filter((a) => r.files.some((f) => f.analysisSlug === a.slug));
  const items: ChecklistItem[] = [
    { label: "Title (at least 3 characters)", ok: r.title.trim().length >= 3 },
    { label: "Simulation type", ok: !!r.simulationType },
  ];
  if (r.simulationType?.requiresStructure) items.push({ label: `PDB ID (required for ${r.simulationType.name})`, ok: !!r.pdbId });
  items.push({ label: "At least one analysis with its data files", ok: used.length > 0 });
  for (const a of used) {
    for (const need of a.required) {
      items.push({ label: `${a.name}: a .${need} file`, ok: r.files.some((f) => f.analysisSlug === a.slug && f.kind === need) });
    }
  }
  if (used.some((a) => a.molecules === "required")) items.push({ label: "The molecular system (at least one molecule)", ok: r.molecules.length > 0 });
  if (used.some((a) => a.citation === "required")) items.push({ label: "The paper's DOI or link", ok: !!(r.doi || r.paperUrl) });
  return items;
}

/** PDB IDs are four characters, the first a digit. */
export const isPdbId = (s: string) => /^[0-9][A-Za-z0-9]{3}$/.test(s.trim());
export const isOrcid = (s: string) => /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(s.trim());
