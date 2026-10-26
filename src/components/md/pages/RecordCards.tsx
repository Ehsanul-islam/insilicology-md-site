import Link from "next/link";
import type { MdRun } from "../showcase/data/types";
import { displayResn, ligandLabelOf } from "../../../lib/data/format";
import { recordPath } from "../../../lib/data/records";

/** Grid of simulation records, each linking to its own page. */
export function RecordCards({ runs }: { runs: MdRun[] }) {
  return (
    <ul className="md-cards">
      {runs.map((r) => (
        <li key={r.id}>
          <Link className="md-card" href={recordPath(r)}>
            <span className="md-card__kicker">PDB {r.pdb_id}{r.placeholder ? " · preview" : ""}</span>
            <h3 className="md-card__title">{ligandLabelOf(r)}</h3>
            <p className="md-card__text">
              {r.protein_name || "Protein"} with {displayResn(r.ligand_resn || "ligand")}. {r.md_figures?.length ?? 0} analysis figures.
            </p>
            <span className="md-card__more">View simulation →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
