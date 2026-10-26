import { readFile } from "node:fs/promises";
import path from "node:path";
import { MdHero } from "../components/md/MdHero";
import { Showcase } from "../components/md/showcase/Showcase";
import { listSimulationTypes } from "../lib/data/simulation-type-store";
import { pageMetadata } from "../lib/seo";
import { HomeSections } from "../components/md/pages/HomeSections";

export const metadata = pageMetadata({
  title: "Molecular Dynamics Simulation Service | Insilicology",
  description:
    "Protein–ligand, apo/mutant, protein–protein and membrane MD simulations with GROMACS and CHARMM36, plus a searchable database of simulation results by PDB ID and simulation type.",
  path: "/",
});

/** Static ASCII frame of the hero structure: server-rendered so crawlers, no-JS visitors and first paint see the art. */
async function heroFrame() {
  try {
    return await readFile(path.join(process.cwd(), "public/structures/1hvr-whole.txt"), "utf8");
  } catch {
    return undefined;
  }
}

export default async function HomePage() {
  const types = await listSimulationTypes();
  return (
    <>
      <MdHero ssrFrame={await heroFrame()} />
      <Showcase types={types} />
      <HomeSections />
      {/* Still to build: pricing, reviews and services sections */}
    </>
  );
}
