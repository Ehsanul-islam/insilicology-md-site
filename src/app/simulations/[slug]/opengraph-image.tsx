import { ligandLabelOf } from "../../../lib/data/format";
import { getRecord } from "../../../lib/data/records";
import { ogImage, ogSize } from "../../../lib/og";

export const alt = "Molecular dynamics simulation record";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const run = await getRecord((await params).slug);
  return ogImage({
    kicker: "Simulation record",
    title: run ? `${run.pdb_id} with ${ligandLabelOf(run)}` : "Simulation record",
    subtitle: run?.protein_name || undefined,
  });
}
