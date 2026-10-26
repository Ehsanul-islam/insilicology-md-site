import { notFound } from "next/navigation";
import { getPost, listPosts } from "../../../lib/data/posts";
import { abs, pageMetadata } from "../../../lib/seo";
import { JsonLd } from "../../../components/JsonLd";
import { Markdown } from "../../../components/md/pages/Markdown";
import { PageHead } from "../../../components/md/pages/PageHead";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 600;
export const generateStaticParams = async () => (await listPosts()).map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: Props) {
  const p = await getPost((await params).slug);
  if (!p) return {};
  return {
    ...pageMetadata({
      title: p.title,
      description: p.excerpt,
      path: `/blog/${p.slug}`,
      type: "article",
      publishedTime: p.publishedAt,
      modifiedTime: p.updatedAt,
    }),
    keywords: p.tags,
    ...(p.featuredImage ? { openGraph: { images: [p.featuredImage] } } : {}),
  };
}

export default async function PostPage({ params }: Props) {
  const p = await getPost((await params).slug);
  if (!p) notFound();
  const path = `/blog/${p.slug}`;
  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }, { name: p.title, path }]}
        label={`─◆─ ${p.category}`}
        title={p.title}
        lead={p.excerpt}
      />
      <article className="md-body">
        <div className="md-wrap">
          <p className="md-meta-line">
            <span>By {p.author}</span>
            <time dateTime={p.publishedAt}>{p.publishedAt.slice(0, 10)}</time>
          </p>
          <Markdown>{p.contentMd}</Markdown>
          {p.references.length > 0 && (
            <div className="md-narrow">
              <h2>References</h2>
              <ol>
                {p.references.map((r) => (
                  <li key={r.text}>
                    {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.text}</a> : r.text}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </article>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: p.title,
          description: p.excerpt,
          image: p.featuredImage || undefined,
          datePublished: p.publishedAt,
          dateModified: p.updatedAt,
          author: { "@type": "Person", name: p.author },
          publisher: { "@id": abs("/#org") },
          mainEntityOfPage: abs(path),
          keywords: p.tags.join(", "),
          inLanguage: "en",
        }}
      />
    </>
  );
}
