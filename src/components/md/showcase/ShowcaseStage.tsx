"use client";

import { useState } from "react";
import { AsciiMolecule } from "../AsciiMolecule";
import { SearchLens, type LensMode } from "../ascii/SearchLens";
import { useMdThemeValue } from "../useMdTheme";
import type { MdRun } from "./data/types";
import { displayResn } from "./ResultsView";

type Props = {
  /** idle / searching / empty show the lens; a run shows its complex. */
  lens: LensMode;
  run?: MdRun | null;
  pdb?: string | null;
};

/** The ASCII figure beside the search box: magnifying glass, or the found complex with clear labels. */
export function ShowcaseStage({ lens, run, pdb }: Props) {
  const theme = useMdThemeValue();
  const [paused, setPaused] = useState(false);
  const caption = run
    ? `Drag to rotate. The ligand is drawn in ${theme === "dark" ? "blue" : "red"}.`
    : lens === "searching"
      ? "Searching…"
      : lens === "empty"
        ? `Nothing under the lens for ${pdb} yet.`
        : "Move over the protein to look through the lens.";

  return (
    <figure className="md-stage">
      <div className="md-stage__box md-glyphs" data-mode={run ? "found" : lens}>
        {run ? (
          <>
            <AsciiMolecule
              key={run.id}
              pdbId={run.pdb_id}
              ligandResn={run.ligand_resn ?? undefined}
              focus="whole"
              zoom={1.25}
              size={[120, 108]}
              cell={4}
              autoSpin={!paused}
              theme={theme}
              label={`PDB ${run.pdb_id} with ${run.ligand_name || run.ligand_resn}, drawn as ASCII`}
              className="md-stage__mol"
            />
            <div className="md-stage__tag md-stage__tag--pdb">
              <span className="md-stage__k">PDB</span>
              <span className="md-stage__pdb">{run.pdb_id}</span>
            </div>
            <div className="md-stage__tag md-stage__tag--lig">
              <span className="md-stage__k">Ligand</span>
              <span className="md-stage__lig">
                <span className="md-mono">{displayResn(run.ligand_resn || "")}</span> {run.ligand_name}
              </span>
            </div>
            <button
              type="button"
              className="md-btn md-btn--sm md-btn--quiet md-stage__pause"
              aria-pressed={paused}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? "Play rotation" : "Pause rotation"}
            </button>
          </>
        ) : (
          <SearchLens mode={lens} />
        )}
      </div>
      <figcaption className="md-mono md-small md-faint">{caption}</figcaption>
    </figure>
  );
}
