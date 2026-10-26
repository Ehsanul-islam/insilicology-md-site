"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IS_PREVIEW, SITE_URL, ligandSlug, requestDownloadBundle } from "./data/api";
import { groupsFor, orderFigures, type FigureGroup } from "./data/figures";
import type { MdRun } from "./data/types";
import { AsciiMotif } from "../ascii/AsciiMotif";
import { CitationBox, CopyButton } from "./Citation";
import { FigureImage } from "./FigureImage";
import { FigureViewer } from "./FigureViewer";

export function ligandLabelOf(run: MdRun) {
  const name = run.ligand_name || run.ligand_resn || "ligand";
  return run.ligand_resn && run.ligand_name ? `${name} (${displayResn(run.ligand_resn)})` : name;
}
export function ligandsOf(run: MdRun) {
  return (run.ligand_resn || "").split(/[^A-Za-z0-9]+/).filter(Boolean).map((x) => x.toUpperCase());
}
export function displayResn(resn: string) {
  return resn.split(/[^A-Za-z0-9]+/).filter(Boolean).join(" + ").toUpperCase();
}
export function complexUrl(run: MdRun) {
  return `${SITE_URL}/md/${run.pdb_id.toLowerCase()}/${ligandSlug(run)}`;
}

function fmtLength(run: MdRun) {
  if (run.length_ns == null) return null;
  return run.replicas && run.replicas > 1 ? `${run.replicas} × ${run.length_ns} ns` : `${run.length_ns} ns`;
}
function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}
const ph = (t: string) => <span className="md-placeholder">[{t}]</span>;

type Props = {
  pdb: string;
  runs: MdRun[];
  current: number;
  onPick: (i: number) => void;
};

export function ResultsView({ pdb, runs, current, onPick }: Props) {
  const run = runs[current] ?? runs[0];
  const figures = useMemo(() => orderFigures(run?.md_figures), [run]);
  const groups = useMemo(() => groupsFor(figures), [figures]);
  const [group, setGroup] = useState<FigureGroup | "All">("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewer, setViewer] = useState<number>(-1);
  const [dl, setDl] = useState<{ busy: boolean; error?: string }>({ busy: false });

  const visible = group === "All" ? figures : figures.filter((f) => f.meta.group === group);
  const ligLabel = run ? ligandLabelOf(run) : "";
  const ligs = run ? ligandsOf(run) : [];
  const link = run ? complexUrl(run) : "";
  const linkFor = useCallback((anchor: string) => `${link}#${anchor}`, [link]);

  // reset per-complex state when the complex changes
  useEffect(() => {
    setGroup("All");
    setSelected(new Set());
    setViewer(-1);
  }, [run?.id]);

  const openViewer = (anchor: string) => setViewer(visible.findIndex((f) => f.anchor === anchor));
  const closeViewer = useCallback(() => setViewer(-1), []);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = figures.length > 0 && selected.size === figures.length;

  const download = async (ids?: string[]) => {
    if (!run) return;
    setDl({ busy: true });
    try {
      const url = await requestDownloadBundle(run.id, ids);
      window.location.assign(url);
      setDl({ busy: false });
    } catch (e) {
      setDl({ busy: false, error: (e as Error).message });
    }
  };

  if (!run) return null;

  return (
    <div className="md-results-view">
      <div className="md-results-view__head">
        <h3 className="md-results-view__title">
          Results for <span className="md-mono">{pdb}</span>
        </h3>
        <p className="md-muted">
          {runs.length === 1 ? "1 complex simulated" : `${runs.length} complexes simulated`}.{" "}
          <a href={`https://www.rcsb.org/structure/${pdb}`} target="_blank" rel="noreferrer">
            View {pdb} on RCSB
          </a>
        </p>
      </div>

      {runs.length > 1 && (
        <div className="md-complexes">
          <p className="md-small md-muted">Choose a complex. The structure, details and figures switch to it.</p>
          <div className="md-complexes__list" role="group" aria-label={`Complexes simulated for ${pdb}`}>
            {runs.map((r, i) => (
              <button key={r.id} type="button" className="md-complex" aria-pressed={i === current} onClick={() => onPick(i)}>
                <AsciiMotif kind="complex" cols={14} rows={6} className="md-complex__mark" />
                <span className="md-complex__text">
                  <span className="md-complex__resn md-mono">{displayResn(r.ligand_resn || "—")}</span>
                  <span className="md-complex__name">{r.ligand_name || r.ligand_resn}</span>
                  <span className="md-complex__count md-mono">
                    {(r.md_figures?.length ?? 0) === 1 ? "1 figure" : `${r.md_figures?.length ?? 0} figures`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="md-detail">
        <div className="md-detail__info">
          <h4 className="md-detail__title">
            {pdb} with {ligLabel}
          </h4>
          {run.placeholder && <span className="md-preview-flag">Layout preview with placeholder values</span>}
          <dl className="md-meta">
            <dt>Protein</dt>
            <dd>{run.protein_name || ph("PROTEIN")}</dd>
            <dt>Ligand</dt>
            <dd>
              {ligLabel}
              {run.ligand_pubchem_cid && (
                <>
                  {", "}
                  <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${run.ligand_pubchem_cid}`} target="_blank" rel="noreferrer">
                    PubChem CID {run.ligand_pubchem_cid}
                  </a>
                </>
              )}
            </dd>
            <dt>Force field</dt>
            <dd>{run.force_field || ph("FORCE FIELD")}</dd>
            <dt>Length</dt>
            <dd className="md-num">{fmtLength(run) || ph("LENGTH")}</dd>
            <dt>Published</dt>
            <dd>{fmtDate(run.published_at) || ph("DATE")}</dd>
            <dt>Link</dt>
            <dd className="md-detail__link">
              <span className="md-mono md-small">{link.replace(/^https?:\/\//, "")}</span>
              <CopyButton text={link} label="Copy link" copiedLabel="Link copied" />
            </dd>
          </dl>
        </div>
        <div className="md-detail__actions">
          <button
            type="button"
            className="md-btn md-btn--solid md-btn--block"
            onClick={() => download()}
            disabled={dl.busy || IS_PREVIEW || !figures.length}
          >
            {dl.busy ? "Preparing download…" : `Download all ${figures.length} figures + .xvg (zip)`}
          </button>
          {IS_PREVIEW && <p className="md-hint">Downloads are disabled in this preview.</p>}
          {dl.error && (
            <p className="md-error" role="alert">
              {dl.error}
            </p>
          )}
          <CitationBox run={run} ligandLabel={ligLabel} />
        </div>
      </div>

      {figures.length > 0 && (
        <section className="md-figs" aria-labelledby={`figs-${run.id}`}>
          <div className="md-figs__head">
            <h4 id={`figs-${run.id}`} className="md-figs__title">
              Analysis figures <span className="md-mono md-faint">{figures.length}</span>
            </h4>
            {run.placeholder && <span className="md-small md-faint">Placeholder data. Real figures arrive from the workstation upload.</span>}
          </div>
          <div className="md-figs__tools">
            {groups.length > 1 ? (
              <div className="md-chips" role="group" aria-label="Filter figures">
                <button type="button" className="md-chip" aria-pressed={group === "All"} onClick={() => setGroup("All")}>
                  All <span className="md-mono">{figures.length}</span>
                </button>
                {groups.map((g) => (
                  <button key={g.group} type="button" className="md-chip" aria-pressed={group === g.group} onClick={() => setGroup(g.group)}>
                    {g.group} <span className="md-mono">{g.count}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="md-btn md-btn--sm md-btn--quiet"
              onClick={() => setSelected(allSelected ? new Set() : new Set(figures.map((f) => f.id)))}
            >
              {allSelected ? "Clear selection" : "Select all"}
            </button>
          </div>

          {selected.size > 0 && (
            <div className="md-selbar" role="status">
              <span>
                <strong>{selected.size}</strong> of {figures.length} figures selected
              </span>
              <div className="md-selbar__actions">
                <button type="button" className="md-btn md-btn--sm md-selbar__ghost" onClick={() => setSelected(new Set())}>
                  Clear
                </button>
                <button
                  type="button"
                  className="md-btn md-btn--sm md-selbar__solid"
                  disabled={dl.busy || IS_PREVIEW}
                  onClick={() => download([...selected])}
                >
                  Download selected + .xvg (zip)
                </button>
              </div>
            </div>
          )}

          <div className="md-figgrid">
            {visible.map((f) => {
              const on = selected.has(f.id);
              return (
                <figure key={f.id} id={`fig-${f.anchor}`} className="md-fig" data-selected={on || undefined}>
                  <div className="md-fig__head">
                    <figcaption>
                      <span className="md-fig__label">{f.label}</span>
                      <span className="md-fig__desc">{f.desc}</span>
                    </figcaption>
                    <label className="md-fig__select">
                      <input type="checkbox" checked={on} onChange={() => toggle(f.id)} aria-label={`Select ${f.label} for download`} />
                      <span aria-hidden="true">Select</span>
                    </label>
                  </div>
                  <button type="button" className="md-paper md-fig__open" onClick={() => openViewer(f.anchor)} aria-label={`Open ${f.label} in the viewer`}>
                    <FigureImage figure={f} run={run} ligands={ligs} />
                  </button>
                  <div className="md-fig__actions">
                    <button type="button" className="md-btn md-btn--sm md-btn--quiet" onClick={() => openViewer(f.anchor)}>
                      View
                    </button>
                    {f.image_url ? (
                      <a className="md-btn md-btn--sm md-btn--quiet" href={f.image_url} download>
                        JPEG
                      </a>
                    ) : (
                      <button type="button" className="md-btn md-btn--sm md-btn--quiet" disabled>
                        JPEG
                      </button>
                    )}
                    {f.xvg_url ? (
                      <a className="md-btn md-btn--sm md-btn--quiet" href={f.xvg_url} download>
                        .xvg
                      </a>
                    ) : (
                      <button type="button" className="md-btn md-btn--sm md-btn--quiet" disabled>
                        .xvg
                      </button>
                    )}
                    <CopyButton text={linkFor(f.anchor)} label="Copy link" copiedLabel="Link copied" />
                  </div>
                </figure>
              );
            })}
          </div>
        </section>
      )}

      {viewer >= 0 && visible[viewer] && (
        <FigureViewer
          run={run}
          figures={visible}
          index={viewer}
          ligandLabel={ligLabel}
          ligands={ligs}
          linkFor={linkFor}
          onIndex={setViewer}
          onClose={closeViewer}
        />
      )}
    </div>
  );
}
