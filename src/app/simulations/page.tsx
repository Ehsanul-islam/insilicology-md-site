import Link from "next/link";
import { listAnalysisTypes } from "../../lib/data/analysis-type-store";
import { listSimulationTypes } from "../../lib/data/simulation-type-store";
import { isIndexable, listRecords } from "../../lib/data/records";
import { pageMetadata } from "../../lib/seo";
import { PageHead } from "../../components/md/pages/PageHead";
import { RecordCards } from "../../components/md/pages/RecordCards";

export async function generateMetadata() {
  const records = await listRecords();
  return pageMetadata({
    title: "Molecular dynamics simulation database",
    description:
      "Search published molecular dynamics simulations by PDB ID or simulation type, with RMSD, RMSF, radius of gyration, SASA and hydrogen-bond data you can download and cite.",
    path: "/simulations",
    noindex: !records.some(isIndexable),
  });
}

export const revalidate = 3600;

export default async function SimulationsPage() {
  const [records, simulationTypes, analysisTypes] = await Promise.all([listRecords(), listSimulationTypes(), listAnalysisTypes()]);
  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Simulations", path: "/simulations" }]}
        label="─◆─ Database"
        title="Molecular dynamics simulation database"
        lead={
          <>
            Every published complex, with its analysis figures and data. Search by PDB ID on the <Link href="/#showcase">home page</Link>, or browse by simulation type or analysis below.
          </>
        }
      />
      <section className="md-body">
        <div className="md-wrap">
          <div>
            <h2>Browse by simulation type</h2>
            <ul className="md-pills">
              {simulationTypes.map((t) => (
                <li key={t.slug}>
                  <Link className="md-pill" href={`/simulation-types/${t.slug}`}>{t.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Browse by analysis</h2>
            <ul className="md-pills">
              {analysisTypes.map((t) => (
                <li key={t.slug}>
                  <Link className="md-pill" href={`/analysis/${t.slug}`}>{t.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>All simulations</h2>
            {records.length ? <RecordCards runs={records} /> : <p className="md-muted">No simulations are published yet.</p>}
          </div>
        </div>
      </section>
    </>
  );
}
