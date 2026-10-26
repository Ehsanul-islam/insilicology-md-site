import { getSimulationTypeBySlug } from "../../../lib/data/simulation-type-store";
import { ogImage, ogSize } from "../../../lib/og";

export const alt = "Molecular dynamics simulation type";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getSimulationTypeBySlug((await params).slug);
  return ogImage({ kicker: "Simulation type", title: t?.name ?? "Simulation type", subtitle: t?.summary });
}
