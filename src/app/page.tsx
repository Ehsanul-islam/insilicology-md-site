import { readFile } from "node:fs/promises";
import path from "node:path";
import { MdHero } from "../components/md/MdHero";
import { Showcase } from "../components/md/showcase/Showcase";

/** Static ASCII frame of the hero structure: server-rendered so crawlers, no-JS visitors and first paint see the art. */
async function heroFrame() {
  try {
    return await readFile(path.join(process.cwd(), "public/structures/1hvr-whole.txt"), "utf8");
  } catch {
    return undefined;
  }
}

export default async function HomePage() {
  return (
    <>
      <MdHero ssrFrame={await heroFrame()} />
      <Showcase />
      {/* Next sections: 01 Simulations, 02 Analysis, 03 Pricing, 05 Reviews, 06 Services, 07 Contact */}
    </>
  );
}
