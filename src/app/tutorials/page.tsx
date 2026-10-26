import Link from "next/link";
import { listTutorials } from "../../lib/data/tutorials";
import { pageMetadata } from "../../lib/seo";
import { PageHead } from "../../components/md/pages/PageHead";

export const metadata = pageMetadata({
  title: "Molecular dynamics tutorials: GROMACS, analysis and file preparation",
  description:
    "Step-by-step molecular dynamics tutorials: what MD simulation is, a GROMACS protein–ligand workflow, RMSD and RMSF analysis, and how to read and plot XVG files.",
  path: "/tutorials",
});

export default async function TutorialsPage() {
  const tutorials = await listTutorials();
  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Tutorials", path: "/tutorials" }]}
        label="─◆─ Tutorials"
        title="Molecular dynamics tutorials"
        lead="Guides to MD simulations, GROMACS workflows, analysis methods and preparing files for this platform."
      />
      <section className="md-body">
        <div className="md-wrap">
          <ul className="md-cards">
            {tutorials.map((t) => (
              <li key={t.slug}>
                <Link className="md-card" href={`/tutorials/${t.slug}`}>
                  <span className="md-card__kicker">{t.level}</span>
                  <h2 className="md-card__title">{t.title}</h2>
                  <p className="md-card__text">{t.description}</p>
                  <span className="md-card__more">Read tutorial →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
