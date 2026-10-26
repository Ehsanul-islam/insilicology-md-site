import { getTutorial } from "../../../lib/data/tutorials";
import { ogImage, ogSize } from "../../../lib/og";

export const alt = "Molecular dynamics tutorial";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTutorial((await params).slug);
  return ogImage({ kicker: "Tutorial", title: t?.title ?? "Tutorial", subtitle: t?.level });
}
