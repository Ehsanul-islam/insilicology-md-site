import { getAnalysisType } from "../../../lib/data/analysis-types";
import { ogImage, ogSize } from "../../../lib/og";

export const alt = "Molecular dynamics analysis type";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const t = getAnalysisType((await params).slug);
  return ogImage({ kicker: "Analysis type", title: t?.name ?? "Analysis", subtitle: t?.summary });
}
