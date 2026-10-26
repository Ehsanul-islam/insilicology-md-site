import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidPdbId } from "../../../components/md/showcase/data/api";
import { getRecordsForPdb, isIndexable, listPublishedPdbs } from "../../../lib/data/records";
import { abs, pageMetadata } from "../../../lib/seo";
import { JsonLd } from "../../../components/JsonLd";
import { PageHead } from "../../../components/md/pages/PageHead";
import { RecordCards } from "../../../components/md/pages/RecordCards";

type Props = { params: Promise<{ id: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await listPublishedPdbs()).map((p) => ({ id: p.pdb_id.toLowerCase() }));
}

export async function generateMetadata({ params }: Props) {
  const id = (await params).id.toUpperCase();
  if (!isValidPdbId(id)) return {};
  const runs = await getRecordsForPdb(id);
  const name = runs[0]?.protein_name;
  return pageMetadata({
    title: `${id}${name ? ` ${name}` : ""}: molecular dynamics simulations`,
    description: runs.length
      ? `${runs.length} molecular dynamics simulation${runs.length > 1 ? "s" : ""} of PDB ${id}${name ? ` (${name})` : ""}, with RMSD, RMSF, hydrogen-bond and other analysis figures and raw data.`
      : `No published molecular dynamics simulations of PDB ${id} yet. Request one.`,
    path: `/pdb/${id.toLowerCase()}`,
    // placeholder previews and not-yet-simulated IDs stay out of search results
    noindex: !runs.some(isIndexable),
  });
}

export default async function PdbHub({ params }: Props) {
  const id = (await params).id.toUpperCase();
  if (!isValidPdbId(id)) notFound();
  const runs = await getRecordsForPdb(id);
  const name = runs[0]?.protein_name;
  const path = `/pdb/${id.toLowerCase()}`;

  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Simulations", path: "/simulations" }, { name: id, path }]}
        label="─◆─ PDB entry"
        title={`${id}${name ? `: ${name}` : ""} molecular dynamics`}
        lead={
          runs.length
            ? `Published simulations of PDB ${id}, one per ligand set.`
            : `We have no published simulations of PDB ${id} yet.`
        }
      />
      <section className="md-body">
        <div className="md-wrap">
          {runs.length ? (
            <RecordCards runs={runs} />
          ) : (
            <div className="md-narrow">
              <p className="md-muted">
                Request {id} and we will quote a simulation with your ligand. Your PDB ID is filled in for you.
              </p>
              <Link className="md-btn md-btn-primary" href={`/contact?pdb=${id}`}>Request {id}</Link>
            </div>
          )}
          <p className="md-small md-muted">
            <a href={`https://www.rcsb.org/structure/${id}`} target="_blank" rel="noopener noreferrer">View {id} on RCSB PDB</a>
          </p>
        </div>
      </section>
      {runs.some(isIndexable) && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${id} molecular dynamics simulations`,
            url: abs(path),
            isPartOf: { "@id": abs("/#site") },
          }}
        />
      )}
    </>
  );
}
