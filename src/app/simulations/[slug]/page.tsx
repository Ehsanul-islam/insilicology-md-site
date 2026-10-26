import Link from "next/link";
import { notFound } from "next/navigation";
import { FIGURE_META, orderFigures } from "../../../components/md/showcase/data/figures";
import { typeForFigureKind } from "../../../lib/data/analysis-types";
import { displayResn, ligandLabelOf } from "../../../lib/data/format";
import { getRecord, isIndexable, listRecords, recordPath, recordSlug } from "../../../lib/data/records";
import { abs, pageMetadata } from "../../../lib/seo";
import { JsonLd } from "../../../components/JsonLd";
import { CitationBox } from "../../../components/md/showcase/Citation";
import { PageHead } from "../../../components/md/pages/PageHead";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await listRecords()).map((r) => ({ slug: recordSlug(r) }));
}

export async function generateMetadata({ params }: Props) {
  const run = await getRecord((await params).slug);
  if (!run) return {};
  const lig = ligandLabelOf(run);
  return pageMetadata({
    title: `${run.pdb_id} with ${lig}: molecular dynamics simulation`,
    description: `Molecular dynamics simulation of ${run.protein_name || `PDB ${run.pdb_id}`} with ${lig}: ${(run.md_figures ?? []).map((f) => FIGURE_META[f.kind].label).join(", ")}.`,
    path: recordPath(run),
    noindex: !isIndexable(run),
  });
}

const ph = (t: string) => <span className="md-placeholder">[{t}]</span>;

export default async function RecordPage({ params }: Props) {
  const run = await getRecord((await params).slug);
  if (!run) notFound();
  const lig = ligandLabelOf(run);
  const figures = orderFigures(run.md_figures);
  const path = recordPath(run);
  const length = run.length_ns == null ? null : run.replicas && run.replicas > 1 ? `${run.replicas} × ${run.length_ns} ns` : `${run.length_ns} ns`;

  return (
    <>
      <PageHead
        trail={[
          { name: "Home", path: "/" },
          { name: "Simulations", path: "/simulations" },
          { name: run.pdb_id, path: `/pdb/${run.pdb_id.toLowerCase()}` },
          { name: lig, path },
        ]}
        label="─◆─ Simulation record"
        title={`${run.pdb_id} with ${lig}`}
        lead={`Molecular dynamics of ${run.protein_name || `PDB ${run.pdb_id}`} with ${lig}.`}
      />
      <article className="md-body">
        <div className="md-wrap">
          {run.placeholder && (
            <p className="md-banner" role="note">
              Layout preview with placeholder values. This page is not indexed by search engines and will be replaced when the record is published.
            </p>
          )}
          <div>
            <h2>Details</h2>
            <dl className="md-facts">
              <dt>PDB entry</dt>
              <dd><Link href={`/pdb/${run.pdb_id.toLowerCase()}`}>{run.pdb_id}</Link></dd>
              <dt>Protein</dt>
              <dd>{run.protein_name || ph("PROTEIN")}</dd>
              <dt>Ligand</dt>
              <dd>{displayResn(run.ligand_resn || "") || lig}{run.ligand_name ? `: ${run.ligand_name}` : ""}</dd>
              <dt>Force field</dt>
              <dd>{run.force_field || ph("FORCE FIELD")}</dd>
              <dt>Length</dt>
              <dd>{length || ph("LENGTH")}</dd>
              <dt>DOI</dt>
              <dd>{run.doi || ph("DOI")}</dd>
            </dl>
          </div>
          <div>
            <h2>Analyses in this record</h2>
            <ul className="md-figlist">
              {figures.map((f) => {
                const type = typeForFigureKind(f.kind);
                return (
                  <li key={f.id} id={f.anchor} className="md-card">
                    <span className="md-card__kicker">{f.meta.group}</span>
                    <h3 className="md-card__title">{f.label}</h3>
                    <p className="md-card__text">{f.desc}</p>
                    <p className="md-card__text">{f.meta.read}</p>
                    {type && <Link className="md-card__more" href={`/analysis/${type.slug}`}>About {type.name} →</Link>}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="md-narrow">
            <CitationBox run={run} ligandLabel={lig} />
          </div>
          <div>
            <Link className="md-btn md-btn-secondary" href={`/contact?pdb=${run.pdb_id}`}>Request a simulation of {run.pdb_id}</Link>
          </div>
        </div>
      </article>
      {isIndexable(run) && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: `Molecular dynamics of ${run.pdb_id} with ${lig}`,
            description: `Molecular dynamics simulation of ${run.protein_name || run.pdb_id} with ${lig}.`,
            url: abs(path),
            identifier: run.doi || undefined,
            creator: { "@type": "Organization", name: "Insilicology" },
            license: "https://creativecommons.org/licenses/by/4.0/",
            variableMeasured: figures.map((f) => f.label),
            keywords: ["molecular dynamics", run.pdb_id, ...figures.map((f) => f.label)],
            isAccessibleForFree: true,
          }}
        />
      )}
    </>
  );
}
