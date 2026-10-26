import Link from "next/link";
import { listSimulationTypes } from "../../lib/data/simulation-type-store";
import { pageMetadata } from "../../lib/seo";
import { PageHead } from "../../components/md/pages/PageHead";

export const metadata = pageMetadata({
  title: "Molecular dynamics simulation types: apo, protein–ligand, membrane, umbrella sampling and more",
  description:
    "Browse molecular dynamics simulations by type: apo protein, protein–ligand and protein–protein complexes, membrane proteins, nucleic acids, umbrella sampling, metadynamics, replica exchange and free energy perturbation.",
  path: "/simulation-types",
});

export const revalidate = 3600;

export default async function SimulationTypesIndex() {
  const types = await listSimulationTypes();
  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Simulation types", path: "/simulation-types" }]}
        label="─◆─ Simulation types"
        title="Molecular dynamics simulation types"
        lead="Every record is filed under the kind of system or method it simulates. Pick a type to learn what it involves and to see the simulations of that kind."
      />
      <section className="md-body">
        <div className="md-wrap">
          <ul className="md-cards">
            {types.map((t) => (
              <li key={t.slug}>
                <Link className="md-card" href={`/simulation-types/${t.slug}`}>
                  <h2 className="md-card__title">{t.name}</h2>
                  <p className="md-card__text">{t.summary}</p>
                  <span className="md-card__more">Learn more →</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="md-muted">
            Looking for RMSD, RMSF or hydrogen-bond results? Browse the <Link href="/analysis">analysis types</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
