import Link from "next/link";
import { notFound } from "next/navigation";
import { ANALYSIS_TYPES, getAnalysisType } from "../../../lib/data/analysis-types";
import { getRecordsForType } from "../../../lib/data/records";
import { listTutorials } from "../../../lib/data/tutorials";
import { abs, clip, pageMetadata } from "../../../lib/seo";
import { JsonLd } from "../../../components/JsonLd";
import { PageHead } from "../../../components/md/pages/PageHead";
import { RecordCards } from "../../../components/md/pages/RecordCards";

type Props = { params: Promise<{ slug: string }> };

export const generateStaticParams = () => ANALYSIS_TYPES.map((t) => ({ slug: t.slug }));
export const dynamicParams = false;

export async function generateMetadata({ params }: Props) {
  const t = getAnalysisType((await params).slug);
  if (!t) return {};
  return pageMetadata({
    title: `${t.name} in molecular dynamics: what it shows and how to run it`,
    description: `${t.summary} ${t.intro[0]}`,
    path: `/analysis/${t.slug}`,
  });
}

export default async function AnalysisHub({ params }: Props) {
  const t = getAnalysisType((await params).slug);
  if (!t) notFound();
  const [records, tutorials] = await Promise.all([getRecordsForType(t.slug), listTutorials()]);
  const tutorial = tutorials.find((x) => x.slug === t.tutorial);
  const others = ANALYSIS_TYPES.filter((x) => x.slug !== t.slug);

  return (
    <>
      <PageHead
        trail={[
          { name: "Home", path: "/" },
          { name: "Analysis types", path: "/analysis" },
          { name: t.name, path: `/analysis/${t.slug}` },
        ]}
        label="─◆─ Analysis type"
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
          {t.command && (
            <div className="md-narrow">
              <h2>How to run it in GROMACS</h2>
              <pre className="md-code" tabIndex={0}>{t.command}</pre>
              {tutorial && (
                <p className="md-muted" style={{ marginTop: 16 }}>
                  Full walk-through: <Link href={`/tutorials/${tutorial.slug}`}>{tutorial.title}</Link>.
                </p>
              )}
            </div>
          )}
          <div>
            <div className="md-section-head">
              <h2>Simulations with {t.name}</h2>
            </div>
            {records.length ? (
              <RecordCards runs={records} />
            ) : (
              <p className="md-muted">No simulations are published under this type yet.</p>
            )}
          </div>
          <div>
            <h2>Other analysis types</h2>
            <ul className="md-pills">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link className="md-pill" href={`/analysis/${o.slug}`}>{o.name}</Link>
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
          name: t.name,
          description: clip(t.summary),
          url: abs(`/analysis/${t.slug}`),
          inLanguage: "en",
          isPartOf: { "@id": abs("/#site") },
        }}
      />
    </>
  );
}
