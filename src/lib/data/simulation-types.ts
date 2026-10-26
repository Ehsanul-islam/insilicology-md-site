import { resolveType, suggestTypes, type TypeLike } from "./analysis-types.ts";

/**
 * Simulation types: WHAT is simulated or which method is used. They sit next to the analysis types
 * (RMSD, RMSF ...), which say which analyses a record contains. Until the database is connected this list
 * is the source of truth; the `simulation_types` table is seeded from it (`npm run db:seed`).
 * Only admins add types. Aliases make "Apo", "Apo protein" and "Unbound protein" resolve to one type.
 */
export type SimulationType = TypeLike & {
  /** Hub page copy, one string per paragraph. Admin-editable once the database exists. */
  intro: string[];
  requiresStructure: boolean;
};

export const SIMULATION_TYPES: SimulationType[] = [
  {
    slug: "apo-protein",
    name: "Apo protein",
    aliases: ["Apo", "Apo form", "Unbound protein", "Ligand-free protein", "Free protein", "Protein only"],
    summary: "A protein simulated on its own, without a ligand or binding partner.",
    intro: [
      "An apo simulation follows a protein in water and ions with nothing bound to it. It is the reference state for most studies: it shows how flexible the protein is on its own, which loops move, and whether the binding pocket is open or closed before any ligand arrives.",
      "Apo runs are usually paired with a ligand-bound (holo) simulation of the same protein, set up and run in exactly the same way, so differences in RMSD, RMSF, hydrogen bonds or pocket volume can be attributed to binding. Start from an apo crystal structure when one exists, or remove the ligand from a holo structure and say so in the methods.",
    ],
    requiresStructure: true,
  },
  {
    slug: "protein-ligand-complex",
    name: "Protein–ligand complex",
    aliases: ["Protein ligand", "Holo", "Holo protein", "Ligand-bound", "Drug–protein complex", "Protein small molecule"],
    summary: "A protein with a bound small molecule, such as a drug candidate, substrate or cofactor.",
    intro: [
      "Protein–ligand simulations place a small molecule in a binding site and follow the complex over time. They are used to test whether a docked pose stays put, which residues and hydrogen bonds hold the ligand, and to estimate binding free energies with methods such as MM-PBSA.",
      "The ligand needs its own force-field parameters, for example from CGenFF or GAFF, and the quality of those parameters and of the starting pose largely decides how reliable the result is. Run several replicas, and compare with an apo simulation of the same protein where you can.",
    ],
    requiresStructure: true,
  },
  {
    slug: "protein-protein-complex",
    name: "Protein–protein complex",
    aliases: ["Protein protein", "PPI", "Protein–protein interaction", "Protein complex", "Antibody–antigen"],
    summary: "Two or more proteins bound to each other, such as a complex or an antibody with its antigen.",
    intro: [
      "These simulations study how proteins recognise and hold on to each other: which residues form the interface, how stable it is, and how it changes when a partner is mutated or a small molecule is added.",
      "Systems are large and therefore expensive. Contacts, hydrogen bonds, interface area and per-residue energy contributions are the usual analyses. Starting structures often come from docking, so check that the interface is stable before reading anything into it.",
    ],
    requiresStructure: true,
  },
  {
    slug: "membrane-protein",
    name: "Membrane protein",
    aliases: ["Membrane", "Transmembrane protein", "Lipid bilayer", "Protein in membrane", "GPCR", "Ion channel"],
    summary: "A protein embedded in a lipid bilayer, such as a receptor, channel or transporter.",
    intro: [
      "Membrane protein simulations place the protein in a lipid bilayer, often POPC, with water on both sides. Tools such as CHARMM-GUI Membrane Builder help with orientation and packing.",
      "The lipids must equilibrate around the protein, so these runs need a longer, gradually released restraint protocol than soluble proteins. Typical analyses add membrane thickness, area per lipid, lipid order and protein–lipid contacts to the usual RMSD and RMSF.",
    ],
    requiresStructure: true,
  },
  {
    slug: "protein-dna-rna-complex",
    name: "Protein–DNA/RNA complex",
    aliases: ["Protein DNA", "Protein RNA", "Protein–DNA", "Protein–RNA", "Nucleoprotein", "Protein nucleic acid"],
    summary: "A protein bound to DNA or RNA.",
    intro: [
      "These systems include transcription factors on DNA, polymerases, ribosomal proteins and RNA-binding proteins. The highly charged nucleic acid makes ions and water placement important, so salt concentration and ion parameters need care.",
      "Use a force field with well-tested nucleic-acid parameters, for example CHARMM36 or the AMBER OL15 (DNA) and OL3 (RNA) parameters, and watch base pairing and groove geometry along with the protein–nucleic-acid contacts.",
    ],
    requiresStructure: true,
  },
  {
    slug: "peptide",
    name: "Peptide",
    aliases: ["Peptides", "Short peptide", "Peptide folding", "Peptide–protein"],
    summary: "A short chain of amino acids, simulated alone or bound to a protein.",
    intro: [
      "Peptides are small and flexible, so they are simulated to study folding, conformational preferences and binding to a protein partner. Because they sample many shapes, convergence is the main challenge.",
      "Replica exchange or other enhanced sampling is common, and results are usually reported as ensembles or clusters of conformations rather than a single structure.",
    ],
    requiresStructure: false,
  },
  {
    slug: "nucleic-acid",
    name: "Nucleic acid",
    aliases: ["DNA", "RNA", "DNA simulation", "RNA simulation", "Oligonucleotide", "G-quadruplex"],
    summary: "DNA or RNA simulated without a protein partner.",
    intro: [
      "Nucleic acid simulations look at helix geometry, flexibility, the folding of RNA motifs and structures such as G-quadruplexes. They are sensitive to the ion environment and to the force field.",
      "Common analyses are base-pair and base-step parameters, groove widths, backbone torsions and RMSD against the experimental structure. Report the force field and ion model with the results.",
    ],
    requiresStructure: false,
  },
  {
    slug: "umbrella-sampling",
    name: "Umbrella sampling",
    aliases: ["Umbrella", "PMF", "Potential of mean force", "Umbrella sampling simulation"],
    summary: "Enhanced sampling that builds a free-energy profile along a chosen path using biased windows.",
    intro: [
      "Umbrella sampling holds the system at a series of positions along a reaction coordinate, such as the distance between a ligand and its pocket, using a harmonic bias in each window. The biased histograms are then combined, usually with WHAM, into a potential of mean force.",
      "Neighbouring windows must overlap, each window needs enough sampling to converge, and the result depends on the chosen coordinate. In GROMACS the pulling code generates the windows and gmx wham combines them. Report the force constant, window spacing and simulation time per window.",
    ],
    requiresStructure: true,
  },
  {
    slug: "metadynamics",
    name: "Metadynamics",
    aliases: ["Well-tempered metadynamics", "MetaD", "WT-MetaD", "PLUMED metadynamics"],
    summary: "Enhanced sampling that fills free-energy wells with a history-dependent bias.",
    intro: [
      "Metadynamics adds small Gaussian hills to the potential along chosen collective variables, so regions already visited become less attractive and the system is pushed to explore new ones. The accumulated bias estimates the free-energy surface.",
      "It is usually run with PLUMED, often in the well-tempered form where the hill height decreases over time. The quality depends on good collective variables: show that the free-energy estimate converges, and report the hill height, width and deposition rate.",
    ],
    requiresStructure: true,
  },
  {
    slug: "replica-exchange",
    name: "Replica exchange (REMD)",
    aliases: ["REMD", "T-REMD", "Replica exchange MD", "Parallel tempering", "Hamiltonian replica exchange", "H-REMD"],
    summary: "Several copies of the system run in parallel at different temperatures or settings and swap.",
    intro: [
      "In replica exchange, replicas run at different temperatures (T-REMD) or with modified potentials (Hamiltonian REMD) and periodically attempt to swap. High-temperature replicas cross barriers quickly and pass new conformations down to the replica of interest.",
      "Acceptance between neighbouring replicas must be reasonable, which sets the number of replicas, and the cost grows with system size. Report the replica count, the temperature or lambda ladder, the exchange interval and the acceptance ratios.",
    ],
    requiresStructure: true,
  },
  {
    slug: "steered-md",
    name: "Steered MD",
    aliases: ["SMD", "Steered molecular dynamics", "Pulling simulation", "Constant velocity pulling", "Force probe"],
    summary: "A force or moving restraint pulls part of the system, for example to unbind a ligand.",
    intro: [
      "Steered MD applies an external force or a moving restraint to drag a group of atoms along a path, such as pulling a ligand out of its pocket or unfolding a domain. It gives insight into unbinding routes and the strength of the interactions along them.",
      "Pulling is a non-equilibrium process, so single runs are noisy. Repeat them many times and, if you want free energies, combine them with the Jarzynski equality or use the snapshots to start umbrella sampling. Report the pulling rate and spring constant.",
    ],
    requiresStructure: true,
  },
  {
    slug: "free-energy-perturbation",
    name: "Free energy perturbation (FEP)",
    aliases: ["FEP", "Alchemical", "Alchemical free energy", "Relative binding free energy", "RBFE", "Absolute binding free energy", "Thermodynamic integration"],
    summary: "Alchemical calculations of binding or solvation free energies through intermediate states.",
    intro: [
      "Free energy perturbation transforms one molecule into another, or switches a ligand on and off, through a series of lambda windows. Relative calculations rank related ligands, while absolute calculations estimate the binding free energy of a single ligand.",
      "Each window is a separate simulation, and the results are combined with BAR or MBAR. Check the overlap between windows, convergence and the thermodynamic cycle, and report the soft-core settings, the lambda schedule and the estimated error.",
    ],
    requiresStructure: true,
  },
  {
    slug: "coarse-grained",
    name: "Coarse-grained",
    aliases: ["CG", "Martini", "Coarse grained simulation", "Coarse-grained MD"],
    summary: "Simulations with groups of atoms represented as single beads, for longer time and length scales.",
    intro: [
      "Coarse-grained models, such as Martini, replace several heavy atoms by one bead. Fewer particles and a smoother energy surface allow much larger systems and longer times, for example membrane remodelling or protein assembly.",
      "The price is detail: hydrogen bonds and specific interactions are not described explicitly, and secondary structure is usually imposed. Report the model and its version, and consider backmapping to all-atom for analyses that need atomic detail.",
    ],
    requiresStructure: false,
  },
  {
    slug: "other",
    name: "Other simulation types",
    aliases: ["Other", "Custom simulation", "Other method"],
    summary: "Simulation systems and methods that are not in the standard list.",
    intro: [
      "Molecular dynamics covers many systems and methods: QM/MM, constant-pH, polymers, materials, ions in solution and more. Records here describe the system and method in their methodology field and use tags for discovery.",
      "If you think a system or method deserves its own category, you will be able to request it from your dashboard and the administrators will review it.",
    ],
    requiresStructure: false,
  },
];

export const getSimulationType = (slug: string, types: SimulationType[] = SIMULATION_TYPES) => types.find((t) => t.slug === slug);

export const resolveSimulationType = (query: string, types: SimulationType[] = SIMULATION_TYPES) => resolveType(query, types);

export const suggestSimulationTypes = (query: string, limit = 8, types: SimulationType[] = SIMULATION_TYPES) =>
  suggestTypes(query, limit, types);
