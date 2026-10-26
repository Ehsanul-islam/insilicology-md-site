import Link from "next/link";
import { listPosts } from "../../lib/data/posts";
import { pageMetadata } from "../../lib/seo";
import { PageHead } from "../../components/md/pages/PageHead";

export async function generateMetadata() {
  const posts = await listPosts();
  return pageMetadata({
    title: "Molecular dynamics blog: research articles and methods",
    description:
      "Articles on molecular dynamics, simulation methods and computational drug discovery, written by researchers and reviewed by our editors before publication.",
    path: "/blog",
    // an empty blog is a thin page: keep it out of search until there are articles
    noindex: posts.length === 0,
  });
}

export const revalidate = 600;

export default async function BlogPage() {
  const posts = await listPosts();
  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }]}
        label="─◆─ Blog"
        title="Molecular dynamics blog"
        lead="Articles from researchers on simulation methods, analysis and results. Every article is reviewed by an administrator before it appears here."
      />
      <section className="md-body">
        <div className="md-wrap">
          {posts.length ? (
            <ul className="md-cards">
              {posts.map((p) => (
                <li key={p.slug}>
                  <Link className="md-card" href={`/blog/${p.slug}`}>
                    <span className="md-card__kicker">{p.category}</span>
                    <h2 className="md-card__title">{p.title}</h2>
                    <p className="md-card__text">{p.excerpt}</p>
                    <span className="md-meta-line">
                      <span>{p.author}</span>
                      <time dateTime={p.publishedAt}>{p.publishedAt.slice(0, 10)}</time>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="md-muted">No articles have been published yet. In the meantime, read our <Link href="/tutorials">tutorials</Link>.</p>
          )}
        </div>
      </section>
    </>
  );
}
