---
title: "How to read and plot GROMACS XVG files"
description: "What is inside a GROMACS .xvg file, how to read the header, and how to plot it with Python, Grace or gnuplot, so you can prepare analysis data for upload and publication figures."
keywords: ["XVG file", "plot XVG file", "GROMACS xvg Python", "xmgrace", "GROMACS analysis output"]
level: Beginner
published: 2026-10-26
order: 4
---

Almost every GROMACS analysis tool writes its results to an `.xvg` file. It is a plain-text table with a small header, meant for the Grace plotting program (`xmgrace`) but easy to read with any tool. This page explains the format and shows how to plot it.

## What an XVG file looks like

```text
# This file was created by gmx rms
@    title "RMSD"
@    xaxis  label "Time (ns)"
@    yaxis  label "RMSD (nm)"
@TYPE xy
@ s0 legend "Backbone"
    0.0000000    0.0000000
    0.0100000    0.0642110
    0.0200000    0.0871553
```

- Lines starting with `#` are comments written by GROMACS, including the command that created the file.
- Lines starting with `@` are plot settings: the title, axis labels and the legend of each data series (`s0`, `s1`, ...).
- Every other line is data. The first column is the x value, and each further column is one series.
- Some files separate blocks with `&`, for example when you request several groups.

Because the header carries the axis labels and units, keep the original `.xvg` rather than only a screenshot of the plot: it is the raw data that others can re-plot and check.

## Plot it with Python

```python
import numpy as np
import matplotlib.pyplot as plt

def read_xvg(path):
    x_label = y_label = ""
    rows = []
    for line in open(path):
        if line.startswith("#"):
            continue
        if line.startswith("@"):
            if "xaxis" in line and "label" in line:
                x_label = line.split('"')[1]
            elif "yaxis" in line and "label" in line:
                y_label = line.split('"')[1]
            continue
        rows.append([float(v) for v in line.split()])
    return np.array(rows), x_label, y_label

data, xl, yl = read_xvg("rmsd_backbone.xvg")
plt.plot(data[:, 0], data[:, 1])
plt.xlabel(xl)
plt.ylabel(yl)
plt.savefig("rmsd.png", dpi=300, bbox_inches="tight")
```

For a quick load without the labels, `np.loadtxt("file.xvg", comments=("#", "@"))` also works.

## Plot it with Grace or gnuplot

```bash
xmgrace rmsd_backbone.xvg          # interactive
gnuplot -e "set terminal pngcairo; set output 'rmsd.png'; plot 'rmsd_backbone.xvg' using 1:2 with lines"
```

Grace honours the header, so titles, labels and legends appear automatically.

## Tips for publication figures

- **Check the units.** GROMACS writes time in ps by default; pass `-tu ns` to analysis tools to write nanoseconds directly. Lengths are in nm.
- **Use the same axis range** when comparing several simulations, so the curves are visually comparable.
- **Show variability.** If you have replicas, plot all of them or the mean with a shaded spread, not a single run.
- **Smooth honestly.** If you apply a running average, say so in the caption and keep the raw data available.

## Uploading to a database record

When you add results to a record, upload the `.xvg` files together with the analysis type they belong to. The file requirements depend on the analysis, and some, such as contact maps or free-energy landscapes, may also need CSV or structure files. Browse the [analysis types](/analysis) to see what each one means, or return to the [RMSD, RMSF and Rg tutorial](/tutorials/rmsd-rmsf-analysis-gromacs).
