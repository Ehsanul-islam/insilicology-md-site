import Link from "next/link";
import { notFound } from "next/navigation";
import { FIGURE_META, orderFigures } from "../../../components/md/showcase/data/figures";
import { getAnalysisType, typeForFigureKind } from "../../../lib/data/analysis-types";
import { displayResn, ligandLabelOf } from "../../../lib/data/format";
import { getRecord, getRecordSeries, isIndexable, listRecordSummaries, recordPath } from "../../../lib/data/records";
import { abs, pageMetadata } from "../../../lib/seo";
import { JsonLd } from "../../../components/JsonLd";
import { CitationBox } from "../../../components/md/showcase/Citation";
import { PageHead } from "../../../components/md/pages/PageHead";
import { XvgPlot } from "../../../components/md/pages/XvgPlot";
import type { MdRecordFile, MdRun } from "../../../components/md/showcase/data/types";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await listRecordSummaries()).slice(0, 200).map((r) => ({ slug: r.slug }));
}

/** "1AFS with TES" when there is a structure; the author's title for records without a PDB ID. */
const headingOf = (run: MdRun) => (run.pdb_id ? `${run.pdb_id} with ${ligandLabelOf(run)}` : run.title || "Simulation record");

const analysisLabels = (run: MdRun) =>
  run.analyses ? run.analyses.map((a) => a.name) : (run.md_figures ?? []).map((f) => FIGURE_META[f.kind].label);

export async function generateMetadata({ params }: Props) {
  const run = await getRecord((await params).slug);
  if (!run) return {};
  const subject = run.protein_name || (run.pdb_id ? `PDB ${run.pdb_id}` : run.title);
  const labels = analysisLabels(run);
  return pageMetadata({
    title: `${headingOf(run)}: molecular dynamics simulation`,
    description:
      run.description?.slice(0, 160) ||
      `Molecular dynamics simulation of ${subject}${run.pdb_id ? ` with ${ligandLabelOf(run)}` : ""}${labels.length ? `: ${labels.join(", ")}` : ""}.`,
    path: recordPath(run),
    noindex: !isIndexable(run),
  });
}

const ph = (t: string) => <span className="md-placeholder">[{t}]</span>;
const kb = (n: number | null) => (n == null ? "" : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Downloads({ files }: { files: MdRecordFile[] }) {
  if (!files.length) return null;
  return (
    <ul className="md-files">
      {files.map((f) => (
        <li key={f.id}>
          <a className="md-files__name" href={`/api/files/${f.id}?download=1`} rel="nofollow">{f.filename}</a>
          <span className="md-files__state">{kb(f.size_bytes)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function RecordPage({ params }: Props) {
  const run = await getRecord((await params).slug);
  if (!run) notFound();
  const lig = ligandLabelOf(run);
  const heading = headingOf(run);
  const path = recordPath(run);
  const length = run.length_ns == null ? null : run.replicas && run.replicas > 1 ? `${run.replicas} × ${run.length_ns} ns` : `${run.length_ns} ns`;
  const real = !run.placeholder;
  const hasLigand = !!(run.ligand_name || run.ligand_resn);
  // Real records list the analyses they contain, each with a plot drawn from the uploaded data.
  const sections = run.analyses ?? null;
  const series = sections && real ? await getRecordSeries(run.id) : [];
  const plotOf = new Map(series.map((s) => [s.file_id, s.parsed]));
  const figures = sections ? [] : orderFigures(run.md_figures);
  const supporting = (run.files ?? []).filter((f) => !f.analysis_slug);
  const labels = analysisLabels(run);

  const row = (label: string, value: React.ReactNode, placeholder?: string) =>
    value ? (
      <>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </>
    ) : !real && placeholder ? (
      <>
        <dt>{label}</dt>
        <dd>{ph(placeholder)}</dd>
      </>
    ) : null;

  return (
    <>
      <PageHead
        trail={[
          { name: "Home", path: "/" },
          { name: "Simulations", path: "/simulations" },
          ...(run.pdb_id ? [{ name: run.pdb_id, path: `/pdb/${run.pdb_id.toLowerCase()}` }] : []),
          { name: run.pdb_id ? lig : heading, path },
        ]}
        label="─◆─ Simulation record"
        title={heading}
        lead={
          run.pdb_id
            ? `Molecular dynamics of ${run.protein_name || `PDB ${run.pdb_id}`} with ${lig}.`
            : run.simulation_type_name
              ? `${run.simulation_type_name}${run.protein_name ? `: ${run.protein_name}` : ""}.`
              : "Molecular dynamics simulation."
        }
      />
      <article className="md-body">
        <div className="md-wrap">
          {run.placeholder && (
            <p className="md-banner" role="note">
              Layout preview with placeholder values. This page is not indexed by search engines and will be replaced when the record is published.
            </p>
          )}
          {run.description && <p className="md-lead md-narrow">{run.description}</p>}
          <div>
            <h2>Details</h2>
            <dl className="md-facts">
              {run.simulation_type_slug && row("Simulation type", <Link href={`/simulation-types/${run.simulation_type_slug}`}>{run.simulation_type_name}</Link>)}
              {run.pdb_id && row("PDB entry", <Link href={`/pdb/${run.pdb_id.toLowerCase()}`}>{run.pdb_id}</Link>)}
              {row("Protein", run.protein_name, "PROTEIN")}
              {(hasLigand || !real) && row("Ligand", `${displayResn(run.ligand_resn || "") || lig}${run.ligand_name ? `: ${run.ligand_name}` : ""}`)}
              {row("Software", run.software)}
              {row("Force field", run.force_field, "FORCE FIELD")}
              {row("Length", length, "LENGTH")}
              {row("DOI", run.doi, "DOI")}
              {row("Contributor", run.contributor)}
              {row("Licence", run.license)}
            </dl>
          </div>
          {run.methodology && (
            <div className="md-narrow">
              <h2>Methodology</h2>
              {run.methodology.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          )}
          <div>
            <h2>Analyses in this record</h2>
            {sections ? (
              <div className="md-figlist">
                {sections.map((a) => {
                  const type = getAnalysisType(a.slug);
                  const mine = (run.files ?? []).filter((f) => f.analysis_slug === a.slug);
                  const plots = mine.flatMap((f) => {
                    const data = plotOf.get(f.id);
                    return data ? [{ f, data }] : [];
                  });
                  return (
                    <section key={a.slug} id={a.slug} className="md-card">
                      <span className="md-card__kicker">{type?.name ?? a.name}</span>
                      <h3 className="md-card__title">{a.name}</h3>
                      {type?.summary && <p className="md-card__text">{type.summary}</p>}
                      {plots.map(({ f, data }) => (
                        <XvgPlot key={f.id} data={data} caption={`${a.name}: ${f.filename}`} id={`plot-${f.id.slice(0, 8)}`} />
                      ))}
                      <Downloads files={mine} />
                      {type && <Link className="md-card__more" href={`/analysis/${type.slug}`}>About {type.name} →</Link>}
                    </section>
                  );
                })}
              </div>
            ) : (
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
            )}
          </div>
          {supporting.length > 0 && (
            <div>
              <h2>Files</h2>
              <Downloads files={supporting} />
            </div>
          )}
          <div className="md-narrow">
            <CitationBox run={run} ligandLabel={run.pdb_id ? lig : heading} />
          </div>
          <div>
            <Link className="md-btn md-btn-secondary" href={run.pdb_id ? `/contact?pdb=${run.pdb_id}` : "/contact"}>
              {run.pdb_id ? `Request a simulation of ${run.pdb_id}` : "Request a simulation"}
            </Link>
          </div>
        </div>
      </article>
      {isIndexable(run) && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: run.pdb_id ? `Molecular dynamics of ${run.pdb_id} with ${lig}` : heading,
            description: run.description || `Molecular dynamics simulation of ${run.protein_name || run.pdb_id || heading}${run.pdb_id ? ` with ${lig}` : ""}.`,
            url: abs(path),
            identifier: run.doi || undefined,
            creator: run.authors?.length
              ? run.authors.map((name) => ({ "@type": "Person", name }))
              : { "@type": "Organization", name: run.contributor || "Insilicology" },
            license: licenseUrl(run.license),
            variableMeasured: labels,
            keywords: ["molecular dynamics", ...(run.pdb_id ? [run.pdb_id] : []), ...(run.tags ?? []), ...labels],
            isAccessibleForFree: true,
          }}
        />
      )}
    </>
  );
}

function licenseUrl(license: string | null | undefined) {
  const m = license?.match(/^CC-(BY(?:-SA|-NC)?)-(\d\.\d)$/);
  if (m) return `https://creativecommons.org/licenses/${m[1].toLowerCase()}/${m[2]}/`;
  if (license === "CC0-1.0") return "https://creativecommons.org/publicdomain/zero/1.0/";
  return "https://creativecommons.org/licenses/by/4.0/";
}
