import { ogImage, ogSize } from "../lib/og";

export const alt = "Insilicology: molecular dynamics simulation database";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ kicker: "MD simulation database", title: "Molecular Dynamics Simulation Database", subtitle: "Protein–ligand MD with GROMACS and CHARMM36" });
}
