import type { FigureKind, MdFigure } from "./types";

/**
 * Display metadata for every analysis figure type. The page shows only the
 * figures a run actually has, in this order, grouped as below.
 */
export type FigureGroup = "Stability" | "Interactions" | "Energetics" | "Dynamics" | "Other";

export type FigureMeta = {
  label: string;
  desc: string;
  group: FigureGroup;
  x: string;
  y: string;
  read: string;
};

export const FIGURE_META: Record<FigureKind, FigureMeta> = {
  rmsd: {
    label: "RMSD", group: "Stability", x: "Time (ns)", y: "RMSD (nm)",
    desc: "Backbone and ligand deviation from the starting structure",
    read: "A curve that rises, then levels off, means the system has settled. A ligand curve that keeps climbing suggests it is leaving the pocket.",
  },
  rmsf: {
    label: "RMSF", group: "Stability", x: "Residue number", y: "RMSF (nm)",
    desc: "Per-residue flexibility of the protein",
    read: "Peaks are flexible loops and termini. Low values around the binding site mean the pocket stays rigid with the ligand bound.",
  },
  rg: {
    label: "Radius of gyration", group: "Stability", x: "Time (ns)", y: "Rg (nm)",
    desc: "Compactness of the protein over time",
    read: "A flat line means the protein keeps its fold. A steady rise indicates unfolding or opening.",
  },
  sasa: {
    label: "SASA", group: "Stability", x: "Time (ns)", y: "SASA (nm²)",
    desc: "Solvent-accessible surface area of the protein",
    read: "Stable values mean the exposed surface does not change. A drop can mean the pocket closes around the ligand.",
  },
  hbond: {
    label: "Hydrogen bonds", group: "Interactions", x: "Time (ns)", y: "Number of H-bonds",
    desc: "Protein–ligand hydrogen bonds per frame",
    read: "Bars are the count in each frame; the line is the running average. Persistent bonds anchor the ligand.",
  },
  contacts: {
    label: "Contact map", group: "Interactions", x: "Time (ns)", y: "Residue",
    desc: "Which residues touch the ligand over time",
    read: "A filled cell means the residue is within 4 Å of the ligand in that frame. Long unbroken rows are the key binding residues.",
  },
  mmpbsa: {
    label: "MM-PBSA", group: "Energetics", x: "Energy term", y: "Energy (kJ/mol)",
    desc: "Binding free energy split into its components",
    read: "A more negative ΔG bind means stronger binding. The other bars show whether van der Waals or electrostatics drive it.",
  },
  pca: {
    label: "PCA", group: "Dynamics", x: "PC1 (nm)", y: "PC2 (nm)",
    desc: "Motion projected on the first two principal components",
    read: "Each dot is a frame, shaded by time. Separate clusters are distinct conformations the protein visits.",
  },
  fel: {
    label: "Free-energy landscape", group: "Dynamics", x: "PC1 (nm)", y: "PC2 (nm)",
    desc: "Gibbs free energy over PC1 and PC2",
    read: "Dark basins are the most stable, most populated states. Several basins mean the protein switches between conformations.",
  },
  dccm: {
    label: "DCCM", group: "Dynamics", x: "Residue number", y: "Residue number",
    desc: "Correlated motion between residue pairs",
    read: "Red pairs move together, blue pairs move in opposite directions. Blocks off the diagonal link distant regions.",
  },
  other: {
    label: "Other analysis", group: "Other", x: "", y: "",
    desc: "Additional analysis for this complex",
    read: "See the caption and the methods write-up for details.",
  },
};

export const FIGURE_ORDER: FigureKind[] = ["rmsd", "rmsf", "rg", "sasa", "hbond", "contacts", "mmpbsa", "pca", "fel", "dccm", "other"];
export const GROUP_ORDER: FigureGroup[] = ["Stability", "Interactions", "Energetics", "Dynamics", "Other"];

/** Stable, URL-safe id for a figure: its kind, or kind-n when a run has several of one kind. */
export function figureAnchor(f: MdFigure, all: MdFigure[]) {
  const same = all.filter((x) => x.kind === f.kind);
  if (same.length < 2) return f.kind;
  return `${f.kind}-${same.indexOf(f) + 1}`;
}

/** Figures in display order with their resolved label and anchor. */
export function orderFigures(figs: MdFigure[] = []) {
  return [...figs]
    .sort((a, b) => FIGURE_ORDER.indexOf(a.kind) - FIGURE_ORDER.indexOf(b.kind))
    .map((f, _i, all) => ({
      ...f,
      meta: FIGURE_META[f.kind] ?? FIGURE_META.other,
      label: (FIGURE_META[f.kind] ?? FIGURE_META.other).label,
      desc: f.caption?.trim() || (FIGURE_META[f.kind] ?? FIGURE_META.other).desc,
      anchor: figureAnchor(f, all),
    }));
}

export type OrderedFigure = ReturnType<typeof orderFigures>[number];

/** Filter chips: only groups that have at least one figure. */
export function groupsFor(figs: OrderedFigure[]) {
  const counts = new Map<FigureGroup, number>();
  for (const f of figs) counts.set(f.meta.group, (counts.get(f.meta.group) ?? 0) + 1);
  return GROUP_ORDER.filter((g) => counts.get(g)).map((g) => ({ group: g, count: counts.get(g) as number }));
}
