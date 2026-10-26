import { ogImage, ogSize } from "../lib/og";

export const alt = "Insilicology: molecular dynamics simulation service";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ kicker: "MD simulation service", title: "Molecular Dynamics Simulation Service", subtitle: "Protein–ligand MD with GROMACS and CHARMM36" });
}
