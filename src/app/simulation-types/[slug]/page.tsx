import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecordsForSimulationType } from "../../../lib/data/records";
import { getSimulationTypeBySlug, listSimulationTypes } from "../../../lib/data/simulation-type-store";
import { listAnalysisTypes } from "../../../lib/data/analysis-type-store";
import { abs, clip, pageMetadata } from "../../../lib/seo";
import { JsonLd } from "../../../components/JsonLd";
import { PageHead } from "../../../components/md/pages/PageHead";
import { RecordCards } from "../../../components/md/pages/RecordCards";

type Props = { params: Promise<{ slug: string }> };

export const generateStaticParams = async () => (await listSimulationTypes()).map((t) => ({ slug: t.slug }));
export const revalidate = 3600;

export async function generateMetadata({ params }: Props) {
  const t = await getSimulationTypeBySlug((await params).slug);
  if (!t) return {};
  return pageMetadata({
    title: `${t.name} molecular dynamics simulations: what they are and how to run them`,
    description: `${t.summary} ${t.intro[0] ?? ""}`,
    path: `/simulation-types/${t.slug}`,
  });
}

export default async function SimulationTypeHub({ params }: Props) {
  const t = await getSimulationTypeBySlug((await params).slug);
  if (!t) notFound();
  const [records, all, analyses] = await Promise.all([getRecordsForSimulationType(t.slug), listSimulationTypes(), listAnalysisTypes()]);
  const others = all.filter((x) => x.slug !== t.slug);
  const path = `/simulation-types/${t.slug}`;

  return (
    <>
      <PageHead
        trail={[
          { name: "Home", path: "/" },
          { name: "Simulation types", path: "/simulation-types" },
          { name: t.name, path },
        ]}
        label="─◆─ Simulation type"
        title={t.name}
        lead={t.summary}
      />
      <article className="md-body">
        <div className="md-wrap">
          <div className="md-narrow">
            <h2>What it is</h2>
            {t.intro.map((p) => (
              <p key={p.slice(0, 40)}>{p}</p>
            ))}
          </div>
          <div>
            <div className="md-section-head">
              <h2>{t.name} simulations</h2>
            </div>
            {records.length ? (
              <RecordCards runs={records} />
            ) : (
              <p className="md-muted">No simulations of this type are published yet.</p>
            )}
          </div>
          <div>
            <h2>Typical analyses</h2>
            <p className="md-muted">Each simulation comes with its own analyses. These are the most common:</p>
            <ul className="md-pills">
              {analyses.slice(0, 6).map((a) => (
                <li key={a.slug}>
                  <Link className="md-pill" href={`/analysis/${a.slug}`}>{a.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Other simulation types</h2>
            <ul className="md-pills">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link className="md-pill" href={`/simulation-types/${o.slug}`}>{o.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </article>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${t.name} molecular dynamics simulations`,
          description: clip(t.summary),
          url: abs(path),
          inLanguage: "en",
          isPartOf: { "@id": abs("/#site") },
        }}
      />
    </>
  );
}
