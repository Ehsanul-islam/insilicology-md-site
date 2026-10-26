import Link from "next/link";
import { notFound } from "next/navigation";
import { getTutorial, listTutorials } from "../../../lib/data/tutorials";
import { abs, pageMetadata } from "../../../lib/seo";
import { JsonLd } from "../../../components/JsonLd";
import { Markdown } from "../../../components/md/pages/Markdown";
import { PageHead } from "../../../components/md/pages/PageHead";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = async () => (await listTutorials()).map((t) => ({ slug: t.slug }));

export async function generateMetadata({ params }: Props) {
  const t = await getTutorial((await params).slug);
  if (!t) return {};
  return {
    ...pageMetadata({
      title: t.title,
      description: t.description,
      path: `/tutorials/${t.slug}`,
      type: "article",
      publishedTime: t.published,
      modifiedTime: t.updated,
    }),
    keywords: t.keywords,
  };
}

export default async function TutorialPage({ params }: Props) {
  const slug = (await params).slug;
  const [t, all] = await Promise.all([getTutorial(slug), listTutorials()]);
  if (!t) notFound();
  const more = all.filter((x) => x.slug !== t.slug);
  const path = `/tutorials/${t.slug}`;

  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Tutorials", path: "/tutorials" }, { name: t.title, path }]}
        label={`─◆─ Tutorial · ${t.level}`}
        title={t.title}
        lead={t.description}
      />
      <article className="md-body">
        <div className="md-wrap">
          <p className="md-meta-line">
            <span>Published <time dateTime={t.published}>{t.published}</time></span>
            {t.updated !== t.published && <span>Updated <time dateTime={t.updated}>{t.updated}</time></span>}
          </p>
          <Markdown>{t.body}</Markdown>
          <div>
            <h2>More tutorials</h2>
            <ul className="md-pills">
              {more.map((m) => (
                <li key={m.slug}><Link className="md-pill" href={`/tutorials/${m.slug}`}>{m.title}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      </article>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: t.title,
          description: t.description,
          keywords: t.keywords.join(", "),
          proficiencyLevel: t.level,
          datePublished: t.published,
          dateModified: t.updated,
          inLanguage: "en",
          mainEntityOfPage: abs(path),
          author: { "@type": "Organization", name: "Insilicology" },
          publisher: { "@id": abs("/#org") },
        }}
      />
    </>
  );
}
