import type { FigureKind } from "../../components/md/showcase/data/types";

/**
 * Default analysis / simulation types. Until the Supabase `analysis_types` table
 * exists (Milestone 3) this list is the source of truth; the table is seeded from it.
 * Only admins add types. Aliases make "RMSD", "RMSD analysis" and "Protein RMSD"
 * resolve to one canonical type.
 */
export type AnalysisType = {
  slug: string;
  name: string;
  /** Figure kind this type maps to in the showcase, when there is one. */
  figureKind?: FigureKind;
  aliases: string[];
  /** One-line summary for cards and meta descriptions. */
  summary: string;
  /** Hub intro, one string per paragraph. Admin-editable once the database exists. */
  intro: string[];
  /** Typical GROMACS (or other tool) command. */
  command?: string;
  /** Slug of the tutorial that covers it, if any. */
  tutorial?: string;
  requiresStructure: boolean;
};

export const ANALYSIS_TYPES: AnalysisType[] = [
  {
    slug: "rmsd",
    name: "RMSD analysis",
    figureKind: "rmsd",
    aliases: ["RMSD", "Protein RMSD", "Backbone RMSD", "Ligand RMSD", "Root mean square deviation"],
    summary: "How far the protein backbone and ligand drift from the starting structure over time.",
    intro: [
      "Root-mean-square deviation (RMSD) is the average distance between the atoms of a structure and a reference, usually the starting frame, after the two are superimposed by least-squares fitting. In an MD simulation it is the first plot most people look at, because it shows whether the system has reached a stable state.",
      "A backbone RMSD curve that rises quickly and then levels off means the protein has settled; one that keeps climbing suggests the structure is still relaxing, or unfolding. For a ligand, RMSD is calculated after fitting on the protein, so a ligand curve that jumps or drifts steadily points to the ligand moving within, or leaving, the binding pocket.",
      "RMSD says how much a structure changed, not where. Read it together with RMSF (which residues move) and the radius of gyration (whether the fold stays compact), and always report which atoms were used for the fit and for the calculation.",
    ],
    command: "gmx rms -s md.tpr -f md_fit.xtc -o rmsd.xvg",
    tutorial: "rmsd-rmsf-analysis-gromacs",
    requiresStructure: true,
  },
  {
    slug: "rmsf",
    name: "RMSF analysis",
    figureKind: "rmsf",
    aliases: ["RMSF", "Protein RMSF", "Root mean square fluctuation", "Residue fluctuation"],
    summary: "Per-residue flexibility of the protein around its average position.",
    intro: [
      "Root-mean-square fluctuation (RMSF) measures how much each residue moves around its own average position during the simulation. Where RMSD summarises the whole structure in one number per frame, RMSF gives one number per residue, so it shows which parts of the protein are rigid and which are flexible.",
      "Peaks usually correspond to loops and the chain termini, while low values mark secondary-structure elements and buried regions. Comparing RMSF between an apo protein and its ligand-bound complex is a common way to see whether binding stiffens the pocket or a nearby loop.",
      "RMSF is computed on a trajectory that has already been fitted to a reference, and the results depend on the time window used, so state the range of frames in the methods.",
    ],
    command: "gmx rmsf -s md.tpr -f md_fit.xtc -o rmsf.xvg -res",
    tutorial: "rmsd-rmsf-analysis-gromacs",
    requiresStructure: true,
  },
  {
    slug: "radius-of-gyration",
    name: "Radius of gyration (Rg)",
    figureKind: "rg",
    aliases: ["Rg", "Radius of gyration", "Protein compactness", "Compactness"],
    summary: "How compact the protein stays over the simulation.",
    intro: [
      "The radius of gyration (Rg) is the mass-weighted root-mean-square distance of a molecule's atoms from its centre of mass. It is a simple measure of compactness: a tightly folded protein has a small, steady Rg, and unfolding or opening of domains shows up as a rise.",
      "Because it is a single number per frame, Rg is easy to compare between simulations, for example a protein with and without a bound ligand. A flat line means the fold is maintained; a step change often marks a conformational transition worth a closer look at the structures.",
    ],
    command: "gmx gyrate -s md.tpr -f md_fit.xtc -o gyrate.xvg",
    tutorial: "rmsd-rmsf-analysis-gromacs",
    requiresStructure: true,
  },
  {
    slug: "sasa",
    name: "Solvent-accessible surface area (SASA)",
    figureKind: "sasa",
    aliases: ["SASA", "Solvent accessible surface area", "Surface area", "Protein SASA"],
    summary: "How much of the protein surface is exposed to solvent.",
    intro: [
      "Solvent-accessible surface area (SASA) is the area of the molecule that a probe sphere the size of a water molecule can touch. It reports how exposed the protein is to solvent and is often used alongside Rg to judge compaction and burial of hydrophobic groups.",
      "A falling SASA can mean the protein is collapsing or a pocket is closing around a ligand; a rising SASA can mean domains opening. SASA can be calculated for the whole protein, per residue, or for the binding site only.",
    ],
    command: "gmx sasa -s md.tpr -f md_fit.xtc -o sasa.xvg -or resarea.xvg",
    requiresStructure: true,
  },
  {
    slug: "hydrogen-bonds",
    name: "Hydrogen-bond analysis",
    figureKind: "hbond",
    aliases: ["H-bond", "H-bonds", "Hydrogen bonds", "Hydrogen bond analysis", "Hbond"],
    summary: "Hydrogen bonds between the protein and ligand, or within the protein, per frame.",
    intro: [
      "Hydrogen-bond analysis counts the hydrogen bonds between two groups in every frame, most often protein and ligand. Persistent bonds anchor a ligand in its pocket, while bonds that form and break repeatedly show a more dynamic interaction.",
      "A hydrogen bond is defined geometrically. GROMACS defaults to a donor–acceptor distance of at most 0.35 nm and a hydrogen–donor–acceptor angle of at most 30 degrees; report these cut-offs if you change them. Beyond the count over time, the occupancy of each individual bond (the fraction of frames it is present) identifies the residues that matter most.",
    ],
    command: "gmx hbond -s md.tpr -f md_fit.xtc -n index.ndx -num hbnum.xvg",
    requiresStructure: true,
  },
  {
    slug: "contact-map",
    name: "Protein–ligand contact analysis",
    figureKind: "contacts",
    aliases: ["Contact map", "Contacts", "Residue contacts", "Protein ligand contacts"],
    summary: "Which residues stay in contact with the ligand, and for how long.",
    intro: [
      "Contact analysis records, for every frame, which protein residues lie within a chosen distance of the ligand, commonly 0.4 nm. Plotted as residue against time, long unbroken rows are the residues that hold the ligand in place.",
      "Contacts complement hydrogen bonds because they also capture hydrophobic and van der Waals interactions, which hydrogen-bond counts miss entirely.",
    ],
    command: "gmx mindist -s md.tpr -f md_fit.xtc -n index.ndx -od mindist.xvg -on numcont.xvg -d 0.4",
    requiresStructure: true,
  },
  {
    slug: "mm-pbsa",
    name: "MM-PBSA binding free energy",
    figureKind: "mmpbsa",
    aliases: ["MMPBSA", "MM/PBSA", "MM-GBSA", "Binding free energy", "Binding energy"],
    summary: "Estimated protein–ligand binding free energy and its components.",
    intro: [
      "MM-PBSA (molecular mechanics Poisson–Boltzmann surface area) estimates the binding free energy of a ligand from snapshots of an MD trajectory. The result is split into van der Waals, electrostatic, polar solvation and non-polar solvation terms, so you can see what drives binding.",
      "More negative values indicate stronger predicted binding. The method is best used to rank related ligands rather than to predict absolute affinities, and entropy is often left out; report the frames used, the dielectric constants and whether entropy was included. Common tools are gmx_MMPBSA and g_mmpbsa.",
    ],
    command: "gmx_MMPBSA -O -i mmpbsa.in -cs md.tpr -ci index.ndx -cg 1 13 -ct md_fit.xtc",
    requiresStructure: true,
  },
  {
    slug: "pca",
    name: "Principal component analysis (PCA)",
    figureKind: "pca",
    aliases: ["PCA", "Essential dynamics", "Principal components"],
    summary: "The dominant collective motions of the protein.",
    intro: [
      "Principal component analysis diagonalises the covariance matrix of atomic positions to find the collective motions that account for most of the movement in a trajectory. The first few components usually describe large, functionally relevant motions such as domain closing.",
      "Projecting the trajectory onto the first two components (PC1 and PC2) gives a map of the conformations the protein visits; separate clusters are distinct states. The same projection is the input for the free-energy landscape.",
    ],
    command: "gmx covar -s md.tpr -f md_fit.xtc -o eigenval.xvg -v eigenvec.trr && gmx anaeig -s md.tpr -f md_fit.xtc -v eigenvec.trr -first 1 -last 2 -2d 2dproj.xvg",
    requiresStructure: true,
  },
  {
    slug: "free-energy-landscape",
    name: "Free-energy landscape (FEL)",
    figureKind: "fel",
    aliases: ["FEL", "Free energy landscape", "Gibbs free energy landscape", "Energy landscape"],
    summary: "Gibbs free energy over the main conformational coordinates.",
    intro: [
      "A free-energy landscape turns how often the simulation visits each conformation into a Gibbs free energy, using the Boltzmann relation. It is usually drawn over PC1 and PC2 from a principal component analysis.",
      "Deep basins are stable, highly populated states; the barriers between them show how easily the protein switches conformation. Landscapes are only meaningful when the simulation samples the states often enough, so report the length and the number of replicas.",
    ],
    command: "gmx sham -f 2dproj.xvg -ls gibbs.xpm",
    requiresStructure: true,
  },
  {
    slug: "dccm",
    name: "Dynamic cross-correlation (DCCM)",
    figureKind: "dccm",
    aliases: ["DCCM", "Cross correlation", "Dynamic cross correlation matrix", "Residue correlation"],
    summary: "Which residues move together and which move in opposition.",
    intro: [
      "The dynamic cross-correlation matrix (DCCM) shows, for every pair of residues, how correlated their motions are, from +1 (move together) to -1 (move in opposite directions). Blocks off the diagonal reveal regions of the protein that are coupled, even when they are far apart in sequence.",
      "It is typically calculated on C-alpha atoms with tools such as Bio3D or MD-TASK, and comparing the matrix with and without a ligand shows how binding changes the protein's internal communication.",
    ],
    requiresStructure: true,
  },
  {
    slug: "other",
    name: "Other MD analyses",
    figureKind: "other",
    aliases: ["Other", "Other analysis", "Custom analysis"],
    summary: "Other simulation types and analysis methods that don't fit the standard list.",
    intro: [
      "Molecular dynamics covers many methods beyond the standard stability analyses: membrane and lipid properties, nucleic-acid simulations, peptide folding, enhanced sampling and more. Records in this category describe the method in their methodology field and are tagged for discovery.",
      "If you think a method deserves its own category, you will be able to request it from your dashboard and the administrators will review it.",
    ],
    requiresStructure: false,
  },
];

/** Lower-case and strip everything but letters and digits, so "MM/PBSA" and "mm pbsa" compare equal. */
export function normaliseKey(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
}

export function getAnalysisType(slug: string) {
  return ANALYSIS_TYPES.find((t) => t.slug === slug);
}

/** Resolve free text (a slug, name or alias) to its canonical type. */
export function resolveAnalysisType(query: string) {
  const k = normaliseKey(query);
  if (!k) return undefined;
  return ANALYSIS_TYPES.find((t) => [t.slug, t.name, ...t.aliases].some((a) => normaliseKey(a) === k));
}

/** Types whose name, slug or any alias contains the query, for search suggestions. */
export function suggestAnalysisTypes(query: string, limit = 8) {
  const k = normaliseKey(query);
  if (!k) return ANALYSIS_TYPES.slice(0, limit);
  return ANALYSIS_TYPES.filter((t) => [t.slug, t.name, ...t.aliases].some((a) => normaliseKey(a).includes(k))).slice(0, limit);
}

export function typeForFigureKind(kind: FigureKind) {
  return ANALYSIS_TYPES.find((t) => t.figureKind === kind);
}
