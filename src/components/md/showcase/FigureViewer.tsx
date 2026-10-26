import { useEffect, useRef } from "react";
import type { OrderedFigure } from "./data/figures";
import type { MdRun } from "./data/types";
import { CopyButton } from "./Citation";
import { FigureImage } from "./FigureImage";

type Props = {
  run: MdRun;
  figures: OrderedFigure[];
  index: number;
  ligandLabel: string;
  ligands: string[];
  linkFor: (anchor: string) => string;
  onIndex: (i: number) => void;
  onClose: () => void;
};

/** Large figure with explanation, downloads, link and a strip of this complex's other figures. */
export function FigureViewer({ run, figures, index, ligandLabel, ligands, linkFor, onIndex, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const f = figures[index];
  const n = figures.length;
  const prev = figures[(index - 1 + n) % n];
  const next = figures[(index + 1) % n];

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const onCancel = () => onClose();
    d?.addEventListener("close", onCancel);
    return () => d?.removeEventListener("close", onCancel);
  }, [onClose]);

  if (!f) return null;
  const base = `${run.pdb_id.toLowerCase()}_${(run.ligand_resn || "ligand").toLowerCase().replace(/[^a-z0-9]+/g, "-")}_${f.anchor}`;

  return (
    <dialog
      ref={ref}
      className="md-viewer"
      aria-labelledby="md-viewer-title"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onIndex((index + 1) % n);
        if (e.key === "ArrowLeft") onIndex((index - 1 + n) % n);
      }}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <div className="md-viewer__bar">
        <span className="md-mono md-small md-muted">
          {run.pdb_id} with {ligandLabel}, figure {index + 1} of {n}
        </span>
        <button type="button" className="md-icon-btn" aria-label="Close viewer" onClick={() => ref.current?.close()}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="md-viewer__body">
        <div className="md-viewer__main">
          <div className="md-paper">
            <FigureImage figure={f} run={run} ligands={ligands} large />
          </div>
          <div className="md-viewer__nav">
            <button type="button" className="md-btn" onClick={() => onIndex((index - 1 + n) % n)}>
              Previous: {prev.label}
            </button>
            <button type="button" className="md-btn" onClick={() => onIndex((index + 1) % n)}>
              Next: {next.label}
            </button>
          </div>
        </div>
        <aside className="md-viewer__side">
          <div className="md-viewer__head">
            <h2 id="md-viewer-title">{f.label}</h2>
            <p className="md-muted">{f.desc}</p>
          </div>
          <div className="md-viewer__read">
            <span className="md-mono md-small md-faint">How to read it</span>
            <p>{f.meta.read}</p>
          </div>
          <dl className="md-meta">
            {f.meta.x && (
              <>
                <dt>x axis</dt>
                <dd>{f.meta.x}</dd>
              </>
            )}
            {f.meta.y && (
              <>
                <dt>y axis</dt>
                <dd>{f.meta.y}</dd>
              </>
            )}
            <dt>Files</dt>
            <dd className="md-mono md-small">
              {base}.jpg{f.xvg_path || run.placeholder ? `, ${base}.xvg` : ""}
            </dd>
          </dl>
          <div className="md-viewer__actions">
            {f.image_url ? (
              <a className="md-btn md-btn--solid" href={f.image_url} download={`${base}.jpg`}>
                Download JPEG
              </a>
            ) : (
              <button type="button" className="md-btn md-btn--solid" disabled>
                Download JPEG
              </button>
            )}
            {f.xvg_url ? (
              <a className="md-btn" href={f.xvg_url} download={`${base}.xvg`}>
                Download .xvg data
              </a>
            ) : (
              <button type="button" className="md-btn" disabled>
                Download .xvg data
              </button>
            )}
            <CopyButton text={linkFor(f.anchor)} label="Copy link to this figure" copiedLabel="Link copied" className="md-btn md-btn--quiet" />
          </div>
          <p className="md-notice">Free to use with citation: Insilicology, DOI {run.doi || "[DOI]"}.</p>
          <div className="md-viewer__thumbs-wrap">
            <span className="md-mono md-small md-faint">All figures for this complex</span>
            <div className="md-viewer__thumbs">
              {figures.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  className="md-viewer__thumb"
                  aria-current={i === index ? "true" : undefined}
                  aria-label={`Show ${t.label}`}
                  onClick={() => onIndex(i)}
                >
                  <span className="md-paper">
                    <FigureImage figure={t} run={run} ligands={ligands} thumb />
                  </span>
                  <span className="md-viewer__thumb-label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </dialog>
  );
}
