import type { OrderedFigure } from "./data/figures";
import type { MdRun } from "./data/types";
import { PlaceholderPlot } from "./PlaceholderPlot";

type Props = { figure: OrderedFigure; run: MdRun; ligands: string[]; large?: boolean; thumb?: boolean };

/** The uploaded figure image; for sample runs, a watermarked placeholder plot. */
export function FigureImage({ figure, run, ligands, large, thumb }: Props) {
  if (figure.image_url) {
    return (
      <img
        src={figure.image_url}
        alt={thumb ? "" : `${figure.label} for ${run.pdb_id} with ${run.ligand_name || run.ligand_resn}: ${figure.desc}`}
        loading={large ? "eager" : "lazy"}
        decoding="async"
        width={1200}
        height={864}
      />
    );
  }
  if (run.placeholder) {
    return <PlaceholderPlot kind={figure.kind} ligands={ligands} seedKey={run.id} label={figure.label} />;
  }
  return (
    <span className="md-figure-ph" role="img" aria-label={`${figure.label} figure is not available`}>
      Figure not available
    </span>
  );
}
