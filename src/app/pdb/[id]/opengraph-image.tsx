import { getRecordsForPdb } from "../../../lib/data/records";
import { ogImage, ogSize } from "../../../lib/og";

export const alt = "PDB entry molecular dynamics simulations";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id.toUpperCase();
  const runs = await getRecordsForPdb(id);
  return ogImage({ kicker: "PDB entry", title: `${id} molecular dynamics`, subtitle: runs[0]?.protein_name || undefined });
}
