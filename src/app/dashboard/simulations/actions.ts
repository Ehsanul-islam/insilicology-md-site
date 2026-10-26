"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromCrossref, fromRcsb, normaliseDoi, type CitationFields } from "../../../lib/dashboard/citation";
import { friendlyError, loadAnalyses, requireUser } from "../../../lib/dashboard/server";
import { PARSE_MAX_BYTES, PLOTTABLE_KINDS, checkUpload, kindFromFilename, isEditable, isDeletable, isOrcid, isPdbId, type RecordStatus } from "../../../lib/dashboard/validate";
import { parseTable, parseXvg, toPlotData } from "../../../lib/xvg";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

const BUCKET = "record-files";
const LICENSES = ["CC-BY-4.0", "CC-BY-SA-4.0", "CC-BY-NC-4.0", "CC0-1.0"];
const MOLECULE_KINDS = ["ligand", "peptide", "nucleic_acid", "lipid", "ion", "cofactor", "other"];

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const orNull = (s: string) => (s === "" ? null : s);

// Creating -------------------------------------------------------------------------------------------

export type CreateState = { error?: string; values?: Record<string, string> };

/** The permanent web address is built from the PDB ID and ligand (or the title), so they are asked for up front. */
export async function createDraft(_prev: CreateState, form: FormData): Promise<CreateState> {
  const { supabase, user, profile } = await requireUser("/dashboard/simulations/new");
  const values = Object.fromEntries(["title", "simulationType", "pdbId", "ligand"].map((k) => [k, text(form.get(k), 200)]));
  if (profile.status === "restricted") return { error: "This account is restricted, so it cannot add records.", values };
  if (values.title.length < 3) return { error: "Give the simulation a title of at least 3 characters.", values };

  const { data: type } = await supabase.from("simulation_types").select("id,name,requires_structure").eq("slug", values.simulationType).eq("status", "active").maybeSingle();
  if (!type) return { error: "Choose a simulation type.", values };
  const pdb = values.pdbId.toUpperCase();
  if (pdb && !isPdbId(pdb)) return { error: "A PDB ID has four characters and starts with a digit, for example 1AFS.", values };
  if (type.requires_structure && !pdb) return { error: `A PDB ID is needed for ${type.name} records.`, values };
  const resn = values.ligand.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);

  const { data, error } = await supabase
    .from("records")
    .insert({
      owner_id: user.id,
      title: values.title,
      simulation_type_id: type.id,
      pdb_id: pdb || null,
      molecules: resn ? [{ kind: "ligand", name: "", resn }] : [],
    })
    .select("id")
    .single();
  if (error || !data) return { error: friendlyError(error), values };
  redirect(`/dashboard/simulations/${data.id}`);
}

// Saving ----------------------------------------------------------------------------------------------

export type RecordInput = {
  title: string;
  description: string;
  simulationType: string;
  pdbId: string;
  proteinName: string;
  molecules: { kind: string; name: string; resn: string; pubchemCid: string }[];
  software: string;
  softwareVersion: string;
  forceField: string;
  lengthNs: string;
  replicas: string;
  methodology: string;
  authors: string[];
  doi: string;
  paperUrl: string;
  bibtex: string;
  license: string;
  tags: string[];
};

export type SaveResult = { ok: true } | Fail;

export async function saveRecord(id: string, input: RecordInput): Promise<SaveResult> {
  const { supabase, profile } = await requireUser(`/dashboard/simulations/${id}`);
  if (profile.status === "restricted") return fail("This account is restricted, so it cannot change records.");

  const title = text(input.title, 200);
  if (title.length < 3) return fail("Give the simulation a title of at least 3 characters.");

  const pdb = text(input.pdbId, 4).toUpperCase();
  if (pdb && !isPdbId(pdb)) return fail("A PDB ID has four characters and starts with a digit, for example 1AFS.");

  const doiText = text(input.doi, 200);
  const doi = doiText ? normaliseDoi(doiText) : null;
  if (doiText && !doi) return fail("That does not look like a DOI. It starts with 10. and a slash, for example 10.1021/acs.jcim.1c00001.");

  const paperUrl = text(input.paperUrl, 500);
  if (paperUrl && !/^https?:\/\//i.test(paperUrl)) return fail("The paper link must start with http:// or https://.");

  const lengthNs = text(input.lengthNs, 20);
  const length = lengthNs === "" ? null : Number(lengthNs);
  if (length !== null && !(length > 0)) return fail("The simulation length must be a number above zero (in nanoseconds).");
  const replicasText = text(input.replicas, 6);
  const replicas = replicasText === "" ? null : Number(replicasText);
  if (replicas !== null && !(Number.isInteger(replicas) && replicas >= 1)) return fail("Replicas must be a whole number, 1 or more.");

  const license = LICENSES.includes(input.license) ? input.license : "CC-BY-4.0";

  const molecules = (input.molecules ?? []).slice(0, 20).flatMap((m) => {
    const name = text(m.name, 120);
    const resn = text(m.resn, 5).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const cid = Number(m.pubchemCid);
    if (!name && !resn) return [];
    return [{ kind: MOLECULE_KINDS.includes(m.kind) ? m.kind : "other", name, resn, ...(Number.isInteger(cid) && cid > 0 ? { pubchem_cid: cid } : {}) }];
  });

  let simId: string | null = null;
  if (input.simulationType) {
    const { data } = await supabase.from("simulation_types").select("id").eq("slug", input.simulationType).eq("status", "active").maybeSingle();
    if (!data) return fail("Choose a simulation type from the list.");
    simId = data.id;
  }

  const { data: rows, error } = await supabase
    .from("records")
    .update({
      title,
      description: orNull(text(input.description, 5000)),
      simulation_type_id: simId,
      pdb_id: pdb || null,
      protein_name: orNull(text(input.proteinName, 300)),
      molecules,
      software: orNull(text(input.software, 100)),
      software_version: orNull(text(input.softwareVersion, 50)),
      force_field: orNull(text(input.forceField, 100)),
      length_ns: length,
      replicas,
      methodology: orNull(text(input.methodology, 10000)),
      authors: (input.authors ?? []).map((a) => text(a, 120)).filter(Boolean).slice(0, 50),
      doi,
      paper_url: orNull(paperUrl),
      citation_bibtex: orNull(text(input.bibtex, 5000)),
      license,
    })
    .eq("id", id)
    .select("id");
  if (error) return fail(friendlyError(error));
  if (!rows?.length) return fail("This record cannot be changed right now. Records in review are locked until an administrator decides.");

  const tags = await setTags(supabase, id, input.tags);
  if (tags) return tags;

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

async function setTags(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], id: string, names: string[]): Promise<Fail | null> {
  const wanted = [...new Set((names ?? []).map((t) => text(t, 60)).filter(Boolean))].slice(0, 15);
  const { data: current } = await supabase.from("record_tags").select("tag_id, tags(slug)").eq("record_id", id);
  const have = new Map((current ?? []).map((r) => [(r.tags as unknown as { slug: string } | null)?.slug ?? "", r.tag_id as string]));

  let tagRows: { id: string; slug: string }[] = [];
  if (wanted.length) {
    const { data, error } = await supabase.rpc("ensure_tags", { names: wanted });
    if (error) return fail(friendlyError(error));
    tagRows = (data ?? []) as { id: string; slug: string }[];
  }
  const wantedSlugs = new Set(tagRows.map((t) => t.slug));
  const drop = [...have].filter(([slug]) => !wantedSlugs.has(slug)).map(([, tagId]) => tagId);
  const add = tagRows.filter((t) => !have.has(t.slug));
  // Tag changes on a live record start a revision, so only touch them when something changed.
  if (drop.length) {
    const { error } = await supabase.from("record_tags").delete().eq("record_id", id).in("tag_id", drop);
    if (error) return fail(friendlyError(error));
  }
  if (add.length) {
    const { error } = await supabase.from("record_tags").insert(add.map((t) => ({ record_id: id, tag_id: t.id })));
    if (error) return fail(friendlyError(error));
  }
  return null;
}

// Files ------------------------------------------------------------------------------------------------

export type UploadTicket = { ok: true; path: string; token: string; kind: string; name: string } | Fail;

/** Step 1: check the file against the analysis rules and hand back a one-time upload URL. */
export async function requestUpload(recordId: string, analysisSlug: string | null, file: { name: string; size: number }): Promise<UploadTicket> {
  const { supabase, user, profile } = await requireUser(`/dashboard/simulations/${recordId}`);
  if (profile.status === "restricted") return fail("This account is restricted, so it cannot upload files.");
  const { data: rec } = await supabase.from("records").select("status").eq("id", recordId).maybeSingle();
  if (!rec) return fail("We could not find that record.");
  if (!isEditable(rec.status as RecordStatus)) return fail("This record is in review and cannot be changed until an administrator decides.");

  const analysis = analysisSlug ? (await loadAnalyses(supabase)).find((a) => a.slug === analysisSlug) : null;
  if (analysisSlug && !analysis) return fail("That analysis is not available.");
  const check = checkUpload(file, analysis ?? null);
  if (!check.ok) return fail(check.error);

  const path = `${user.id}/${recordId}/${randomUUID().slice(0, 8)}-${check.name}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return fail("We could not start the upload. Please try again.");
  return { ok: true, path: data.path, token: data.token, kind: check.kind, name: check.name };
}

export type AttachResult = { ok: true } | Fail;

/** Step 2, after the browser has uploaded: read the file, hash it, draw-ready plot data, register it. */
export async function attachFile(recordId: string, path: string, analysisSlug: string | null, displayName: string, size: number): Promise<AttachResult> {
  const { supabase, user } = await requireUser(`/dashboard/simulations/${recordId}`);
  if (!path.startsWith(`${user.id}/${recordId}/`) || path.includes("..")) return fail("That file does not belong to this record.");
  const storage = supabase.storage.from(BUCKET);
  const discard = () => storage.remove([path]);

  const kind = kindFromFilename(displayName);

  let analysisId: string | null = null;
  if (analysisSlug) {
    const a = (await loadAnalyses(supabase)).find((x) => x.slug === analysisSlug);
    if (!a) {
      await discard();
      return fail("That analysis is not available.");
    }
    analysisId = a.id;
  }

  let sha256: string | null = null;
  let parsed: unknown = null;
  if (size <= PARSE_MAX_BYTES && (PLOTTABLE_KINDS as string[]).includes(kind)) {
    const { data: blob, error } = await storage.download(path);
    if (error || !blob) {
      await discard();
      return fail("The upload did not arrive. Please try again.");
    }
    const bytes = Buffer.from(await blob.arrayBuffer());
    sha256 = createHash("sha256").update(bytes).digest("hex");
    if (analysisId) {
      const src = bytes.toString("utf8");
      parsed = toPlotData(kind === "xvg" ? parseXvg(src) : parseTable(src));
    }
  }

  const { error } = await supabase.from("record_files").insert({
    record_id: recordId,
    kind,
    filename: displayName.slice(0, 255),
    storage_path: path,
    size_bytes: Math.max(size, 1),
    sha256,
    analysis_type_id: analysisId,
    parsed,
  });
  if (error) {
    await discard();
    return fail(friendlyError(error));
  }
  revalidatePath(`/dashboard/simulations/${recordId}`);
  return { ok: true };
}

export async function removeFile(fileId: string): Promise<AttachResult> {
  const { supabase } = await requireUser();
  const { data: file } = await supabase.from("record_files").select("record_id,storage_path").eq("id", fileId).maybeSingle();
  if (!file) return fail("We could not find that file.");
  const { data: rows, error } = await supabase.from("record_files").delete().eq("id", fileId).select("id");
  if (error) return fail(friendlyError(error));
  if (!rows?.length) return fail("Files cannot be removed while the record is in review.");
  await supabase.storage.from(BUCKET).remove([file.storage_path]);
  revalidatePath(`/dashboard/simulations/${file.record_id}`);
  return { ok: true };
}

// Submitting and deleting ------------------------------------------------------------------------------------

export async function submitRecord(id: string): Promise<AttachResult> {
  const { supabase } = await requireUser(`/dashboard/simulations/${id}`);
  const { error } = await supabase.rpc("submit_record", { p_id: id });
  if (error) return fail(friendlyError(error));
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function deleteRecord(id: string): Promise<AttachResult> {
  const { supabase } = await requireUser();
  const { data: rec } = await supabase.from("records").select("status,is_public").eq("id", id).maybeSingle();
  if (!rec) return fail("We could not find that record.");
  if (!isDeletable(rec.status as RecordStatus, rec.is_public)) return fail("Only drafts and records that were not approved can be deleted.");
  // Storage objects first: the storage policy needs the record to still exist.
  const { data: files } = await supabase.from("record_files").select("storage_path").eq("record_id", id);
  if (files?.length) await supabase.storage.from(BUCKET).remove(files.map((f) => f.storage_path));
  const { data: rows, error } = await supabase.from("records").delete().eq("id", id).select("id");
  if (error) return fail(friendlyError(error));
  if (!rows?.length) return fail("This record cannot be deleted right now.");
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

// Lookups ------------------------------------------------------------------------------------------------------

export type DoiResult = ({ ok: true; doi: string } & CitationFields) | Fail;

export async function lookupDoi(input: string): Promise<DoiResult> {
  await requireUser();
  const doi = normaliseDoi(input);
  if (!doi) return fail("That does not look like a DOI. It starts with 10. and a slash.");
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { "User-Agent": "Insilicology/1.0 (https://insilicology.com)" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return fail("Crossref does not know that DOI. Check it, or fill in the fields by hand.");
    if (!res.ok) return fail("Crossref did not answer. Try again in a moment.");
    const json = (await res.json()) as { message?: Parameters<typeof fromCrossref>[0] };
    if (!json.message) return fail("Crossref returned nothing for that DOI.");
    return { ok: true, doi, ...fromCrossref(json.message) };
  } catch {
    return fail("Crossref did not answer. Try again in a moment.");
  }
}

export type PdbResult = { ok: true; proteinName: string; title: string } | Fail;

export async function lookupPdb(input: string): Promise<PdbResult> {
  await requireUser();
  const id = input.trim().toUpperCase();
  if (!isPdbId(id)) return fail("A PDB ID has four characters and starts with a digit, for example 1AFS.");
  try {
    const get = async (url: string) => {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
      return r.ok ? await r.json() : null;
    };
    const [entry, entity] = await Promise.all([
      get(`https://data.rcsb.org/rest/v1/core/entry/${id}`),
      get(`https://data.rcsb.org/rest/v1/core/polymer_entity/${id}/1`),
    ]);
    if (!entry) return fail(`RCSB has no entry ${id}. Check the ID.`);
    return { ok: true, ...fromRcsb(entry, entity) };
  } catch {
    return fail("RCSB did not answer. Try again in a moment.");
  }
}

// Profile ------------------------------------------------------------------------------------------------------

export type ProfileState = { ok?: boolean; error?: string };

export async function updateProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const { supabase, user } = await requireUser();
  const name = text(form.get("display_name"), 120);
  const orcid = text(form.get("orcid"), 19);
  if (orcid && !isOrcid(orcid)) return { error: "An ORCID looks like 0000-0002-1825-0097." };
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: name, affiliation: orNull(text(form.get("affiliation"), 200)), orcid: orNull(orcid) })
    .eq("id", user.id)
    .select("id");
  if (error || !data?.length) return { error: "We could not save your profile. Please try again." };
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function markNotificationsRead(): Promise<void> {
  const { supabase } = await requireUser();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/dashboard", "layout");
}

// Category requests ----------------------------------------------------------------------------------------------

export type RequestState = { ok?: boolean; error?: string };

export async function requestType(_prev: RequestState, form: FormData): Promise<RequestState> {
  const { supabase, user, profile } = await requireUser("/dashboard/requests");
  if (profile.status === "restricted") return { error: "This account is restricted, so it cannot send requests." };
  const name = text(form.get("name"), 120);
  const kind = form.get("kind") === "analysis" ? "analysis" : "simulation";
  if (name.length < 2) return { error: "Enter the name of the category you would like." };
  const { error } = await supabase.from("type_requests").insert({ requested_by: user.id, name, kind, reason: orNull(text(form.get("reason"), 2000)) });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/dashboard/requests");
  return { ok: true };
}
