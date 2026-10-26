"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  attachFile,
  deleteRecord,
  lookupDoi,
  lookupPdb,
  removeFile,
  requestUpload,
  saveRecord,
  submitRecord,
  type RecordInput,
} from "../../../app/dashboard/simulations/actions";
import type { AnalysisOption, SimulationOption } from "../../../lib/dashboard/server";
import { checkUpload, checklist, isDeletable, isEditable, isSubmittable, type RecordStatus } from "../../../lib/dashboard/validate";
import { formatDate } from "../../../lib/data/format";
import { createBrowserSupabase } from "../../../lib/supabase/client";
import { Field } from "../pages/Field";
import { XvgPlot, type PlotData } from "../pages/XvgPlot";
import { StatusBadge } from "./StatusBadge";

export type EditorRecord = {
  id: string;
  slug: string;
  status: RecordStatus;
  isPublic: boolean;
  adminFeedback: string | null;
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

export type EditorFile = { id: string; kind: string; filename: string; sizeBytes: number; analysisSlug: string | null; parsed: PlotData | null };
export type HistoryItem = { action: string; reason: string | null; at: string };

const MOLECULE_KINDS: [string, string][] = [
  ["ligand", "Ligand"],
  ["peptide", "Peptide"],
  ["nucleic_acid", "Nucleic acid"],
  ["lipid", "Lipid"],
  ["ion", "Ion"],
  ["cofactor", "Cofactor"],
  ["other", "Other"],
];
const LICENSES: [string, string][] = [
  ["CC-BY-4.0", "CC BY 4.0 (share with credit)"],
  ["CC-BY-SA-4.0", "CC BY-SA 4.0 (share alike)"],
  ["CC-BY-NC-4.0", "CC BY-NC 4.0 (non-commercial)"],
  ["CC0-1.0", "CC0 (public domain)"],
];
const ACTION: Record<string, string> = {
  submitted: "Submitted for review",
  approved: "Approved",
  changes_requested: "Changes requested",
  rejected: "Not approved",
  unpublished: "Unpublished",
};

const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

type Upload = { key: string; zone: string; name: string; state: "uploading" | "processing" | "error"; error?: string };

export function RecordEditor(props: {
  record: EditorRecord;
  files: EditorFile[];
  analyses: AnalysisOption[];
  simulationTypes: SimulationOption[];
  history: HistoryItem[];
  restricted: boolean;
}) {
  const { record, files, analyses, simulationTypes, history, restricted } = props;
  const router = useRouter();
  const [f, setF] = useState(record);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "submit" | "delete">("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [opened, setOpened] = useState<string[]>(() => [...new Set(files.map((x) => x.analysisSlug).filter(Boolean) as string[])]);
  const [lookup, setLookup] = useState<{ doi?: string; pdb?: string }>({});
  const locked = restricted || !isEditable(record.status);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof EditorRecord>(k: K, v: EditorRecord[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };

  const simType = simulationTypes.find((t) => t.slug === f.simulationType) ?? null;
  const shown = [...new Set([...opened, ...files.map((x) => x.analysisSlug).filter(Boolean) as string[]])];
  const items = useMemo(
    () =>
      checklist({
        simulationType: simType ? { name: simType.name, requiresStructure: simType.requiresStructure } : null,
        pdbId: f.pdbId.trim() || null,
        molecules: f.molecules.filter((m) => m.name.trim() || m.resn.trim()),
        doi: f.doi.trim() || null,
        paperUrl: f.paperUrl.trim() || null,
        title: f.title,
        files: files.map((x) => ({ kind: x.kind, analysisSlug: x.analysisSlug })),
        analyses,
      }),
    [simType, f.pdbId, f.molecules, f.doi, f.paperUrl, f.title, files, analyses],
  );
  const ready = items.every((i) => i.ok);

  const toInput = (): RecordInput => ({
    title: f.title,
    description: f.description,
    simulationType: f.simulationType,
    pdbId: f.pdbId,
    proteinName: f.proteinName,
    molecules: f.molecules,
    software: f.software,
    softwareVersion: f.softwareVersion,
    forceField: f.forceField,
    lengthNs: f.lengthNs,
    replicas: f.replicas,
    methodology: f.methodology,
    authors: f.authors,
    doi: f.doi,
    paperUrl: f.paperUrl,
    bibtex: f.bibtex,
    license: f.license,
    tags: f.tags,
  });

  async function save(): Promise<boolean> {
    setBusy("save");
    setMessage(null);
    const r = await saveRecord(record.id, toInput());
    setBusy("");
    if (!r.ok) {
      setMessage({ ok: false, text: r.error });
      return false;
    }
    setDirty(false);
    setMessage({ ok: true, text: record.status === "published" ? "Saved. Submit it for review to publish the changes." : "Draft saved." });
    router.refresh();
    return true;
  }

  async function submit() {
    if (!(await save())) return;
    setBusy("submit");
    const r = await submitRecord(record.id);
    setBusy("");
    if (!r.ok) return setMessage({ ok: false, text: r.error });
    setMessage({ ok: true, text: "Submitted. An administrator will review it, and you will be notified." });
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Delete this draft and its uploaded files? This cannot be undone.")) return;
    setBusy("delete");
    const r = await deleteRecord(record.id);
    if (!r.ok) {
      setBusy("");
      return setMessage({ ok: false, text: r.error });
    }
    setDirty(false);
    router.push("/dashboard/simulations");
    router.refresh();
  }

  async function fillFromPdb() {
    setLookup((l) => ({ ...l, pdb: "Looking up…" }));
    const r = await lookupPdb(f.pdbId);
    if (!r.ok) return setLookup((l) => ({ ...l, pdb: r.error }));
    setF((p) => ({ ...p, proteinName: p.proteinName || r.proteinName }));
    setDirty(true);
    setLookup((l) => ({ ...l, pdb: r.title ? `Found: ${r.title}` : "Found." }));
  }

  async function fillFromDoi() {
    setLookup((l) => ({ ...l, doi: "Looking up…" }));
    const r = await lookupDoi(f.doi);
    if (!r.ok) return setLookup((l) => ({ ...l, doi: r.error }));
    setF((p) => ({
      ...p,
      doi: r.doi,
      paperUrl: p.paperUrl || r.url,
      bibtex: p.bibtex || r.bibtex,
      authors: p.authors.length ? p.authors : r.authors,
    }));
    setDirty(true);
    setLookup((l) => ({ ...l, doi: `Found: ${r.title}${r.journal ? `, ${r.journal}` : ""}${r.year ? ` (${r.year})` : ""}. Empty fields were filled in.` }));
  }

  async function upload(zone: string, picked: File[]) {
    const analysis = zone ? analyses.find((a) => a.slug === zone) ?? null : null;
    for (const file of picked) {
      const key = `${zone}:${file.name}:${Date.now()}`;
      const patch = (p: Partial<Upload>) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...p } : x)));
      setUploads((u) => [...u, { key, zone, name: file.name, state: "uploading" }]);
      const pre = checkUpload(file, analysis);
      if (!pre.ok) {
        patch({ state: "error", error: pre.error });
        continue;
      }
      const ticket = await requestUpload(record.id, zone || null, { name: file.name, size: file.size });
      if (!ticket.ok) {
        patch({ state: "error", error: ticket.error });
        continue;
      }
      const supabase = createBrowserSupabase();
      const { error } = (await supabase?.storage.from("record-files").uploadToSignedUrl(ticket.path, ticket.token, file)) ?? { error: new Error("offline") };
      if (error) {
        patch({ state: "error", error: "The upload failed. Check your connection and try again." });
        continue;
      }
      patch({ state: "processing" });
      const done = await attachFile(record.id, ticket.path, zone || null, file.name, file.size);
      if (!done.ok) {
        patch({ state: "error", error: done.error });
        continue;
      }
      setUploads((u) => u.filter((x) => x.key !== key));
      router.refresh();
    }
  }

  async function dropFile(id: string) {
    const r = await removeFile(id);
    if (!r.ok) return setMessage({ ok: false, text: r.error });
    router.refresh();
  }

  const unusedAnalyses = analyses.filter((a) => !shown.includes(a.slug));
  const canSubmit = isSubmittable(record.status) && !restricted;

  return (
    <div className="md-editor">
      {restricted && <p className="md-banner" role="alert">This account is restricted. You can read your records but not change or submit them.</p>}
      {record.status === "pending" && <p className="md-banner" role="status">This record is in review and cannot be edited until an administrator decides.</p>}
      {record.status === "published" && (
        <p className="md-banner" role="note">This record is public. Your changes go back to review, and the current public version stays online until they are approved.</p>
      )}
      {record.adminFeedback && ["changes_requested", "rejected", "unpublished"].includes(record.status) && (
        <p className="md-row__note" role="note"><strong>Reviewer:</strong> {record.adminFeedback}</p>
      )}

      <fieldset disabled={locked}>
        <section aria-labelledby="s-type">
          <h2 id="s-type">1. Simulation type</h2>
          <div className="md-field">
            <label className="md-field-label" htmlFor="f-type">What is simulated, or which method?</label>
            <select id="f-type" className="md-input" value={f.simulationType} onChange={(e) => set("simulationType", e.target.value)}>
              <option value="">Choose…</option>
              {simulationTypes.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
            </select>
            <p className="md-hint">{simType?.summary ?? "Not in the list? Request a new type from the Requests page."}</p>
          </div>
        </section>

        <section aria-labelledby="s-system">
          <h2 id="s-system">2. The system</h2>
          <div className="md-grid2">
            <div>
              <Field label={`PDB ID${simType?.requiresStructure ? "" : " (optional)"}`} value={f.pdbId} maxLength={4} onChange={(e) => set("pdbId", e.target.value.toUpperCase())} placeholder="1AFS" name="pdbId" />
              <p className="md-hint"><button type="button" className="md-linkbtn" onClick={fillFromPdb} disabled={!f.pdbId}>Fill the protein name from RCSB</button> {lookup.pdb}</p>
            </div>
            <Field label="Protein or system name" name="proteinName" value={f.proteinName} maxLength={300} onChange={(e) => set("proteinName", e.target.value)} />
          </div>
          <div>
            <h3>Molecules</h3>
            <p className="md-hint">Ligands, peptides, nucleic acids, lipids, ions or cofactors in the simulation. The residue name is the short code in your structure file.</p>
            {f.molecules.map((m, i) => {
              const edit = (patch: Partial<typeof m>) => set("molecules", f.molecules.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div className="md-mol" key={i}>
                  <div className="md-field">
                    <label className="md-field-label" htmlFor={`m-kind-${i}`}>Kind</label>
                    <select id={`m-kind-${i}`} className="md-input" value={m.kind} onChange={(e) => edit({ kind: e.target.value })}>
                      {MOLECULE_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <Field label="Name" name={`m-name-${i}`} value={m.name} maxLength={120} onChange={(e) => edit({ name: e.target.value })} />
                  <Field label="Residue" name={`m-resn-${i}`} value={m.resn} maxLength={5} onChange={(e) => edit({ resn: e.target.value.toUpperCase() })} placeholder="TES" />
                  <Field label="PubChem CID" name={`m-cid-${i}`} value={m.pubchemCid} inputMode="numeric" onChange={(e) => edit({ pubchemCid: e.target.value.replace(/\D/g, "") })} />
                  <button type="button" className="md-btn md-btn-secondary" onClick={() => set("molecules", f.molecules.filter((_, j) => j !== i))} aria-label={`Remove molecule ${i + 1}`}>Remove</button>
                </div>
              );
            })}
            {f.molecules.length < 20 && (
              <p><button type="button" className="md-btn md-btn-secondary" onClick={() => set("molecules", [...f.molecules, { kind: "ligand", name: "", resn: "", pubchemCid: "" }])}>Add a molecule</button></p>
            )}
          </div>
        </section>

        <section aria-labelledby="s-files">
          <h2 id="s-files">3. Analyses and files</h2>
          <p className="md-hint">Add one section per analysis you measured, and upload its data files (for example the .xvg from GROMACS). The site draws the plot from the data.</p>
          {shown.map((slug) => {
            const a = analyses.find((x) => x.slug === slug);
            if (!a) return null;
            const mine = files.filter((x) => x.analysisSlug === slug);
            return (
              <div className="md-analysis" key={slug}>
                <h3>{a.name}</h3>
                <p className="md-hint">
                  Accepts {a.allowed.map((k) => `.${k}`).join(", ")}, up to {a.maxMb} MB each.
                  {a.required.length ? ` Needs ${a.required.map((k) => `a .${k} file`).join(" and ")}.` : ""}
                </p>
                <FileList files={mine} onRemove={dropFile} disabled={locked} recordId={record.id} />
                <DropZone zone={slug} accept={a.allowed} disabled={locked} onFiles={upload} uploads={uploads} />
              </div>
            );
          })}
          {unusedAnalyses.length > 0 && !locked && (
            <div className="md-field">
              <label className="md-field-label" htmlFor="f-add-analysis">Add an analysis</label>
              <select id="f-add-analysis" className="md-input" value="" onChange={(e) => e.target.value && setOpened((o) => [...o, e.target.value])}>
                <option value="">Choose…</option>
                {unusedAnalyses.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div className="md-analysis">
            <h3>Supporting files (optional)</h3>
            <p className="md-hint">Starting structure, topology, trajectory, input files or a zip of everything else. Up to 500 MB each. Your host may set a lower project limit.</p>
            <FileList files={files.filter((x) => !x.analysisSlug)} onRemove={dropFile} disabled={locked} recordId={record.id} />
            <DropZone zone="" accept={["pdb", "gro", "xtc", "trr", "tpr", "mol2", "itp", "png", "svg", "pdf", "zip", "txt"]} disabled={locked} onFiles={upload} uploads={uploads} />
          </div>
        </section>

        <section aria-labelledby="s-details">
          <h2 id="s-details">4. Details</h2>
          <Field label="Title" name="title" value={f.title} maxLength={200} onChange={(e) => set("title", e.target.value)} required />
          <div className="md-field">
            <label className="md-field-label" htmlFor="f-description">Description</label>
            <textarea id="f-description" className="md-input" value={f.description} maxLength={5000} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="md-grid2">
            <Field label="Software" name="software" value={f.software} placeholder="GROMACS" onChange={(e) => set("software", e.target.value)} />
            <Field label="Version" name="softwareVersion" value={f.softwareVersion} placeholder="2024.2" onChange={(e) => set("softwareVersion", e.target.value)} />
            <Field label="Force field" name="forceField" value={f.forceField} placeholder="CHARMM36m" onChange={(e) => set("forceField", e.target.value)} />
            <Field label="Length (ns)" name="lengthNs" value={f.lengthNs} inputMode="decimal" onChange={(e) => set("lengthNs", e.target.value)} />
            <Field label="Replicas" name="replicas" value={f.replicas} inputMode="numeric" onChange={(e) => set("replicas", e.target.value.replace(/\D/g, ""))} />
            <div className="md-field">
              <label className="md-field-label" htmlFor="f-license">Licence</label>
              <select id="f-license" className="md-input" value={f.license} onChange={(e) => set("license", e.target.value)}>
                {LICENSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="md-field">
            <label className="md-field-label" htmlFor="f-method">Methodology</label>
            <textarea id="f-method" className="md-input" value={f.methodology} maxLength={10000} onChange={(e) => set("methodology", e.target.value)} />
            <p className="md-hint">System setup, equilibration, thermostat and barostat, restraints, simulation protocol.</p>
          </div>
          <div className="md-field">
            <label className="md-field-label" htmlFor="f-authors">Authors</label>
            <textarea id="f-authors" className="md-input" value={f.authors.join("\n")} onChange={(e) => set("authors", e.target.value.split("\n"))} />
            <p className="md-hint">One name per line.</p>
          </div>
          <Field label="Tags" name="tags" value={f.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(","))} hint="Separated by commas, for example: gromacs, charmm36, kinase." />
        </section>

        <section aria-labelledby="s-citation">
          <h2 id="s-citation">5. Citation</h2>
          <div>
            <Field label="DOI of the paper" name="doi" value={f.doi} onChange={(e) => set("doi", e.target.value)} placeholder="10.1021/acs.jcim.1c00001" />
            <p className="md-hint"><button type="button" className="md-linkbtn" onClick={fillFromDoi} disabled={!f.doi}>Fill from Crossref</button> {lookup.doi}</p>
          </div>
          <Field label="Link to the paper" name="paperUrl" type="url" value={f.paperUrl} onChange={(e) => set("paperUrl", e.target.value)} />
          <div className="md-field">
            <label className="md-field-label" htmlFor="f-bibtex">BibTeX (optional)</label>
            <textarea id="f-bibtex" className="md-input" value={f.bibtex} maxLength={5000} onChange={(e) => set("bibtex", e.target.value)} />
          </div>
        </section>
      </fieldset>

      <section aria-labelledby="s-review">
        <h2 id="s-review">Review</h2>
        <p><StatusBadge status={record.status} live={record.isPublic} /> {dirty && <span className="md-muted">Unsaved changes</span>}</p>
        <ul className="md-checklist">
          {items.map((i) => <li key={i.label} data-ok={i.ok}>{i.label}</li>)}
        </ul>
        {message && <p className={message.ok ? "md-ok" : "md-error"} role={message.ok ? "status" : "alert"}>{message.text}</p>}
        <div className="md-form__row">
          {!locked && <button type="button" className="md-btn md-btn-secondary" onClick={save} disabled={!!busy}>{busy === "save" ? "Saving…" : "Save draft"}</button>}
          {canSubmit && (
            <button type="button" className="md-btn md-btn-primary" onClick={submit} disabled={!!busy || !ready} title={ready ? undefined : "Complete the checklist first"}>
              {busy === "submit" ? "Submitting…" : record.status === "published" ? "Submit changes for review" : "Submit for review"}
            </button>
          )}
          {isDeletable(record.status, record.isPublic) && !restricted && (
            <button type="button" className="md-linkbtn" onClick={remove} disabled={!!busy}>Delete this record</button>
          )}
          {record.isPublic && <Link href={`/simulations/${record.slug}`}>View the public page</Link>}
        </div>
        {history.length > 0 && (
          <>
            <h3>History</h3>
            <ul className="md-rows">
              {history.map((h, i) => (
                <li key={i} className="md-row">
                  <span className="md-row__title">{ACTION[h.action] ?? h.action}</span>
                  <span className="md-row__meta">{formatDate(h.at)}</span>
                  {h.reason && <p className="md-row__note">{h.reason}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function FileList({ files, onRemove, disabled, recordId }: { files: EditorFile[]; onRemove: (id: string) => void; disabled: boolean; recordId: string }) {
  if (!files.length) return null;
  return (
    <ul className="md-files">
      {files.map((x) => (
        <li key={x.id}>
          <span className="md-files__name">{x.filename}</span>
          <span className="md-files__state">{size(x.sizeBytes)}{x.parsed ? " · plot ready" : ""}</span>
          {!disabled && <button type="button" className="md-linkbtn" onClick={() => onRemove(x.id)}>Remove</button>}
          {x.parsed && (
            <details style={{ flexBasis: "100%" }}>
              <summary>Preview the plot</summary>
              <XvgPlot data={x.parsed} caption={x.filename} id={`pv-${recordId.slice(0, 8)}-${x.id.slice(0, 8)}`} />
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

function DropZone({ zone, accept, disabled, onFiles, uploads }: { zone: string; accept: string[]; disabled: boolean; onFiles: (zone: string, files: File[]) => void; uploads: Upload[] }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const mine = uploads.filter((u) => u.zone === zone);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!disabled) onFiles(zone, [...e.dataTransfer.files]);
  };
  return (
    <>
      {!disabled && (
        <label
          className="md-drop"
          data-over={over}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
        >
          <span>Drop files here or <u>choose files</u></span>
          <input
            ref={input}
            type="file"
            multiple
            accept={accept.map((k) => `.${k}`).join(",")}
            onChange={(e) => {
              onFiles(zone, [...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {mine.length > 0 && (
        <ul className="md-files" aria-live="polite">
          {mine.map((u) => (
            <li key={u.key}>
              <span className="md-files__name">{u.name}</span>
              <span className="md-files__state">{u.state === "uploading" ? "Uploading…" : u.state === "processing" ? "Reading the data…" : u.error}</span>
              {u.state === "error" && <span className="md-badge">Not added</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
