---
title: "RMSD, RMSF and radius of gyration analysis in GROMACS"
description: "How to calculate and interpret RMSD, RMSF and radius of gyration from a GROMACS trajectory, with the commands, group choices and what the curves mean for protein stability."
keywords: ["RMSD analysis GROMACS", "RMSF analysis", "radius of gyration", "gmx rms", "gmx rmsf", "protein stability MD"]
level: Intermediate
published: 2026-10-26
order: 3
---

RMSD, RMSF and the radius of gyration are the standard first checks on a finished simulation. They tell you whether the system has equilibrated, which regions move, and whether the protein stays folded. This tutorial assumes you have a production run (`md.tpr`) and a trajectory that is already centred and fitted (`md_fit.xtc`), as produced in the [GROMACS protein–ligand workflow](/tutorials/gromacs-protein-ligand-md-workflow).

## RMSD: has the system settled?

The root-mean-square deviation measures how far the structure has moved from a reference, usually the first frame. See the [RMSD analysis](/analysis/rmsd) page for the definition.

```bash
gmx rms -s md.tpr -f md_fit.xtc -o rmsd_backbone.xvg -tu ns
```

When prompted you choose **two groups**: first the group used for the least-squares fit, then the group whose RMSD is calculated. For a protein, fit on the backbone and calculate the backbone.

For the ligand, fit on the protein backbone and calculate the ligand, so the value reflects how the ligand moves *relative to the protein*. Select the fit group `Backbone` and the output group `LIG` (or `Protein_LIG` pieces defined in your index file):

```bash
gmx rms -s md.tpr -f md_fit.xtc -n index.ndx -o rmsd_ligand.xvg -tu ns
```

### Reading the plot

- A curve that rises and then fluctuates around a plateau means the system has equilibrated. The plateau value for a well-behaved globular protein is often 0.1 to 0.3 nm, but there is no universal threshold.
- A curve that keeps rising throughout the run means the system is still relaxing, or the protein is unfolding.
- A ligand RMSD that jumps to a new level and stays there suggests a change of binding pose; a steadily rising curve suggests the ligand is leaving the pocket.

Use the plateau region, not the whole run, when you report average values, and state which frames you used.

## RMSF: which residues move?

The root-mean-square fluctuation gives one value per residue. See the [RMSF analysis](/analysis/rmsf) page.

```bash
gmx rmsf -s md.tpr -f md_fit.xtc -o rmsf.xvg -res
```

Select `C-alpha` to get one value per residue. Add `-oq bfac.pdb` to write the values into a PDB file you can colour by flexibility in a molecular viewer.

### Reading the plot

Peaks mark flexible loops and the chain ends; troughs mark helices, sheets and buried residues. Compare a ligand-bound simulation with an apo one: a lower RMSF around the binding site means the ligand stabilises it. Calculate RMSF over the equilibrated part of the trajectory with `-b` and `-e` (in ps) so the early relaxation does not inflate the values.

## Radius of gyration: does the protein stay compact?

The [radius of gyration](/analysis/radius-of-gyration) is the mass-weighted distance of the atoms from the centre of mass.

```bash
gmx gyrate -s md.tpr -f md_fit.xtc -o gyrate.xvg
```

The output contains the total Rg and its components along x, y and z. A flat line means the fold is maintained; a steady increase means the protein is expanding or a domain is opening.

## Reporting checklist

When you publish or upload the results, include:

1. The force field, water model and software version.
2. The length of the run and the number of replicas.
3. The groups used for fitting and for calculating each quantity.
4. The time window used for averages.
5. The raw `.xvg` files, so others can re-plot your data.

## Next steps

Continue with [SASA](/analysis/sasa), [hydrogen bonds](/analysis/hydrogen-bonds) and [binding free energy](/analysis/mm-pbsa), and learn how to [read and plot XVG files](/tutorials/read-and-plot-xvg-files).
