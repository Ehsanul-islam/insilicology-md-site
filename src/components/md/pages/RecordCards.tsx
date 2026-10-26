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
            <span className="md-card__kicker">
              {[r.pdb_id && `PDB ${r.pdb_id}`, r.simulation_type_name].filter(Boolean).join(" · ") || "Simulation"}
              {r.placeholder ? " · preview" : ""}
            </span>
            <h3 className="md-card__title">{r.pdb_id ? ligandLabelOf(r) : r.title}</h3>
            <p className="md-card__text">
              {r.pdb_id
                ? `${r.protein_name || "Protein"} with ${displayResn(r.ligand_resn || "ligand")}. `
                : r.protein_name
                  ? `${r.protein_name}. `
                  : ""}
              {r.analyses ? `${r.analyses.length} ${r.analyses.length === 1 ? "analysis" : "analyses"}.` : `${r.md_figures?.length ?? 0} analysis figures.`}
            </p>
            <span className="md-card__more">View simulation →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
