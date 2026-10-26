import Link from "next/link";
import { listAnalysisTypes } from "../../lib/data/analysis-type-store";
import { pageMetadata } from "../../lib/seo";
import { PageHead } from "../../components/md/pages/PageHead";

export const metadata = pageMetadata({
  title: "Molecular dynamics analysis types: RMSD, RMSF, Rg, SASA and more",
  description:
    "Browse molecular dynamics analyses: RMSD, RMSF, radius of gyration, SASA, hydrogen bonds, MM-PBSA, PCA and free-energy landscapes, with what each one shows and how to run it in GROMACS.",
  path: "/analysis",
});

export const revalidate = 3600;

export default async function AnalysisIndex() {
  const types = await listAnalysisTypes();
  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Analysis types", path: "/analysis" }]}
        label="─◆─ Analysis types"
        title="Molecular dynamics analysis types"
        lead="Every simulation record is filed under the analyses it contains. Pick a type to learn what it measures, how to read it and to see the simulations that include it."
      />
      <section className="md-body">
        <div className="md-wrap">
          <ul className="md-cards">
            {types.map((t) => (
              <li key={t.slug}>
                <Link className="md-card" href={`/analysis/${t.slug}`}>
                  <h2 className="md-card__title">{t.name}</h2>
                  <p className="md-card__text">{t.summary}</p>
                  <span className="md-card__more">Learn more →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
