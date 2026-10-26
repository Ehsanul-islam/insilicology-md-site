"use client";

import { useState } from "react";
import type { MdRun } from "./data/types";

/** Copy text; falls back to selecting `fallbackEl` when the clipboard is refused. */
async function copyText(text: string, fallbackEl?: HTMLElement | null) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (fallbackEl) {
      const range = document.createRange();
      range.selectNodeContents(fallbackEl);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    return false;
  }
}

type CopyProps = {
  text: string;
  label: string;
  copiedLabel?: string;
  className?: string;
  target?: () => HTMLElement | null;
};

export function CopyButton({ text, label, copiedLabel = "Copied", className = "md-btn md-btn--sm md-btn--quiet", target }: CopyProps) {
  const [state, setState] = useState<"idle" | "copied" | "selected">("idle");
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const ok = await copyText(text, target?.());
        setState(ok ? "copied" : "selected");
        window.setTimeout(() => setState("idle"), 2000);
      }}
    >
      {state === "copied" ? copiedLabel : state === "selected" ? "Selected, press Ctrl+C" : label}
      <span className="md-sr" aria-live="polite">
        {state === "copied" ? `${copiedLabel}.` : ""}
      </span>
    </button>
  );
}

/** Short human citation plus BibTeX and DOI. */
/** `ligandLabel` is the ligand for records with a structure, or the whole subject (the title) without one. */
export function CitationBox({ run, ligandLabel }: { run: MdRun; ligandLabel: string }) {
  const preId = `bib-${run.id}`;
  const doi = run.doi && !run.doi.startsWith("[") ? run.doi.replace(/^https?:\/\/doi\.org\//, "") : null;
  const year = run.published_at ? new Date(run.published_at).getFullYear() : "[YEAR]";
  const subject = run.pdb_id ? `${run.pdb_id} with ${ligandLabel}` : ligandLabel;
  const doiText = doi ?? run.doi ?? (run.placeholder ? "[DOI]" : null);
  const short = `Insilicology (${year}). Molecular dynamics of ${subject}.${doiText ? ` DOI ${doiText}` : ` ${run.slug ? `https://insilicology.com/simulations/${run.slug}` : ""}`}`.trim();
  const bib = run.citation_bibtex || (run.placeholder ? "[CITATION BIBTEX]" : "");
  return (
    <div className="md-cite">
      <div className="md-cite__head">
        <span className="md-mono md-small md-faint">Cite this dataset</span>
      </div>
      <p className="md-cite__short">
        {short}
        {doi && (
          <>
            {" "}
            <a href={`https://doi.org/${doi}`} target="_blank" rel="noreferrer">
              Open DOI
            </a>
          </>
        )}
      </p>
      {bib && (
        <details className="md-cite__bib">
          <summary>BibTeX</summary>
          <pre id={preId} tabIndex={0} aria-label="BibTeX citation">
            {bib}
          </pre>
        </details>
      )}
      <div className="md-cite__actions">
        <CopyButton text={short} label="Copy citation" />
        {bib && <CopyButton text={bib} label="Copy BibTeX" target={() => document.getElementById(preId)} />}
      </div>
    </div>
  );
}
