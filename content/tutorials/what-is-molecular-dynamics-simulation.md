---
title: "What is molecular dynamics simulation? A beginner's guide"
description: "Learn what a molecular dynamics (MD) simulation is, how force fields and integration work, what you can measure, and when MD is the right tool for protein and drug research."
keywords: ["molecular dynamics simulation", "what is MD simulation", "MD simulation for beginners", "force field", "protein dynamics"]
level: Beginner
published: 2026-10-26
order: 1
---

Molecular dynamics (MD) simulation is a computational method that follows how atoms and molecules move over time. Starting from a three-dimensional structure, such as a protein from the Protein Data Bank, the simulation calculates the forces on every atom and moves them forward in tiny time steps, producing a movie of the molecule called a **trajectory**.

## Why simulate molecules?

Experimental structures from X-ray crystallography or cryo-EM are snapshots. Proteins are not static: loops open and close, side chains rotate, ligands enter and leave binding pockets. MD lets you watch that motion at atomic resolution and ask questions an experiment struggles to answer directly:

- Does a drug candidate stay in the binding pocket, or does it drift away?
- Which residues stay in contact with the ligand?
- How flexible is a loop, and does a mutation change it?
- What is the estimated binding free energy of two related ligands?

## How an MD simulation works

1. **A structure.** The starting coordinates, usually a PDB file, with missing atoms and residues repaired and protonation states set.
2. **A force field.** A set of equations and parameters that give the potential energy of the system from the atom positions: bond stretching, angle bending, torsions, van der Waals and electrostatic interactions. Common biomolecular force fields are CHARMM36, AMBER (ff14SB, ff19SB) and OPLS-AA. Small-molecule ligands need their own parameters, for example from CGenFF or GAFF.
3. **An environment.** The molecule is placed in a box of water molecules, with ions added to neutralise the charge and mimic physiological salt concentration.
4. **Integration.** Newton's equations of motion are solved step by step. A typical time step is 2 femtoseconds (2 × 10⁻¹⁵ s), so a 100 ns simulation takes 50 million steps.
5. **Equilibration, then production.** The system is first relaxed (energy minimisation, then short runs that bring temperature and pressure to the target values). Only after that does the **production run** whose frames are analysed.

## What do you measure?

Raw trajectories are analysed to answer specific questions. The most common analyses are:

- [RMSD](/analysis/rmsd): has the structure settled, and does the ligand stay put?
- [RMSF](/analysis/rmsf): which residues are flexible?
- [Radius of gyration](/analysis/radius-of-gyration) and [SASA](/analysis/sasa): does the protein stay compact?
- [Hydrogen bonds](/analysis/hydrogen-bonds) and [contacts](/analysis/contact-map): which interactions hold the ligand?
- [MM-PBSA](/analysis/mm-pbsa): an estimate of binding free energy.
- [PCA](/analysis/pca) and [free-energy landscapes](/analysis/free-energy-landscape): the main motions and the states the protein visits.

## What MD can and cannot tell you

MD is a model, and its answers are only as good as its inputs and sampling. Keep in mind:

- **Time scale.** Routine simulations reach hundreds of nanoseconds to a few microseconds. Slow events, such as large conformational changes or ligand unbinding, may not occur. Running several independent replicas gives a better picture than a single long run.
- **Force-field accuracy.** Results depend on the force field and on the quality of the ligand parameters.
- **Starting structure.** A poor starting structure or docking pose carries through the whole simulation.
- **Binding free energies.** End-point methods such as MM-PBSA are useful for ranking related ligands but are not accurate predictors of absolute affinity.

Treat MD as a way to generate and test hypotheses, and support important conclusions with experiment.

## Software

GROMACS, AMBER, NAMD, OpenMM and Desmond are widely used. GROMACS is free, fast on both CPUs and GPUs, and has a large community, which is why our tutorials use it. Continue with the [GROMACS protein–ligand workflow](/tutorials/gromacs-protein-ligand-md-workflow).

## Frequently asked questions

**How long should an MD simulation be?** It depends on the question. Many protein–ligand stability studies run 100 ns per replica, with three replicas. Longer runs are needed for slower processes.

**Do I need a GPU?** It is not required, but a modern GPU makes GROMACS several times faster than a CPU alone and turns days of computing into hours.

**Can I cite MD results from this site?** Every published record lists its force field, software, length and the paper it belongs to, with a citation you can copy.
