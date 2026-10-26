import Link from "next/link";
import { ANALYSIS_TYPES } from "../../lib/data/analysis-types";
import { isIndexable, listRecords } from "../../lib/data/records";
import { pageMetadata } from "../../lib/seo";
import { PageHead } from "../../components/md/pages/PageHead";
import { RecordCards } from "../../components/md/pages/RecordCards";

export async function generateMetadata() {
  const records = await listRecords();
  return pageMetadata({
    title: "Molecular dynamics simulation database",
    description:
      "Search published molecular dynamics simulations by PDB ID or analysis type, with RMSD, RMSF, radius of gyration, SASA and hydrogen-bond data you can download and cite.",
    path: "/simulations",
    noindex: !records.some(isIndexable),
  });
}

export default async function SimulationsPage() {
  const records = await listRecords();
  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Simulations", path: "/simulations" }]}
        label="─◆─ Database"
        title="Molecular dynamics simulation database"
        lead={
          <>
            Every published complex, with its analysis figures and data. Search by PDB ID on the <Link href="/#showcase">home page</Link>, or browse by analysis type below.
          </>
        }
      />
      <section className="md-body">
        <div className="md-wrap">
          <div>
            <h2>Browse by analysis type</h2>
            <ul className="md-pills">
              {ANALYSIS_TYPES.map((t) => (
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
