"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AsciiMotif } from "../ascii/AsciiMotif";
import { usePublishedRuns } from "./data/hooks";
import { PdbSearchBox } from "./PdbSearchBox";
import { ShowcaseStage } from "./ShowcaseStage";
import { ResultsView } from "./ResultsView";

/** Open the contact page with the PDB ID filled in. */
export function useRequestQuote() {
  const router = useRouter();
  return (pdbId: string) => router.push(`/contact?pdb=${encodeURIComponent(pdbId)}`);
}

function SearchStatus({ pdb }: { pdb: string }) {
  return (
    <div className="md-status" role="status">
      <AsciiMotif kind="wheel" cols={13} rows={7} animate />
      <span>Searching published simulations for {pdb}…</span>
    </div>
  );
}

function NotSimulated({ pdb }: { pdb: string }) {
  const requestQuoteFor = useRequestQuote();
  return (
    <div className="md-empty" role="status">
      <h3>{pdb} is not simulated yet</h3>
      <p className="md-muted">
        We have no published runs for <span className="md-mono">{pdb}</span>. Request it and we will quote a simulation with your
        ligand. Your PDB ID is filled in for you.
      </p>
      <button type="button" className="md-btn md-btn--solid" onClick={() => requestQuoteFor(pdb)}>
        Request {pdb}
      </button>
    </div>
  );
}

/** Landing-page section: search by PDB ID, then browse complexes and their figures. */
export function Showcase() {
  const [value, setValue] = useState("");
  const [pdb, setPdb] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const { data: runs, isFetching, isError, error } = usePublishedRuns(pdb);

  const found = !!pdb && !isFetching && !!runs?.length;
  const lens = !pdb ? "idle" : isFetching ? "searching" : found ? "idle" : "empty";

  return (
    <section id="showcase" className="md-section" aria-labelledby="showcase-title">
      <div className="md-wrap md-showcase">
        <div className="md-showcase__top">
          <div className="md-showcase__intro">
            <p className="md-label">─◆─ 04 · Showcase</p>
            <h2 id="showcase-title" className="md-h2">Search our simulations</h2>
            <p className="md-lead">
              Enter a PDB ID to see every complex we have simulated for it, with the analysis figures and raw data you can download and
              cite.
            </p>
            <PdbSearchBox
              value={value}
              onChange={setValue}
              onSearch={(id) => {
                setPdb(id);
                setCurrent(0);
              }}
            />
          </div>
          <ShowcaseStage lens={lens} run={found ? runs[current] : null} pdb={pdb} />
        </div>

        <div aria-live="polite">
          {pdb && isFetching && <SearchStatus pdb={pdb} />}
          {pdb && !isFetching && isError && (
            <p className="md-error" role="alert">
              {error?.message}
            </p>
          )}
          {pdb && !isFetching && !isError && runs?.length === 0 && <NotSimulated pdb={pdb} />}
        </div>

        {found && <ResultsView pdb={pdb} runs={runs} current={current} onPick={setCurrent} />}
      </div>
    </section>
  );
}
