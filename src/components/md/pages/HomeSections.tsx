import Link from "next/link";
import { ANALYSIS_TYPES } from "../../../lib/data/analysis-types";
import { isIndexable, listRecords } from "../../../lib/data/records";
import { listPosts } from "../../../lib/data/posts";
import { listTutorials } from "../../../lib/data/tutorials";
import { RecordCards } from "./RecordCards";

function Head({ id, label, title, href, more }: { id: string; label: string; title: string; href: string; more: string }) {
  return (
    <>
      <p className="md-label">{label}</p>
      <div className="md-section-head">
        <h2 id={id}>{title}</h2>
        <Link href={href}>{more} →</Link>
      </div>
    </>
  );
}

/** Server-rendered sections under the showcase: categories, featured records, tutorials and posts. */
export async function HomeSections() {
  const [records, tutorials, posts] = await Promise.all([listRecords(), listTutorials(), listPosts()]);
  const featured = records.filter(isIndexable).slice(0, 3);

  return (
    <>
      <section className="md-section" aria-labelledby="home-categories">
        <div className="md-wrap">
          <Head id="home-categories" label="─◆─ Categories" title="Browse by analysis type" href="/analysis" more="All analysis types" />
          <ul className="md-cards">
            {ANALYSIS_TYPES.slice(0, 8).map((t) => (
              <li key={t.slug}>
                <Link className="md-card" href={`/analysis/${t.slug}`}>
                  <h3 className="md-card__title">{t.name}</h3>
                  <p className="md-card__text">{t.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="md-section" aria-labelledby="home-featured">
          <div className="md-wrap">
            <Head id="home-featured" label="─◆─ Featured" title="Featured simulations" href="/simulations" more="All simulations" />
            <RecordCards runs={featured} />
          </div>
        </section>
      )}

      <section className="md-section" aria-labelledby="home-tutorials">
        <div className="md-wrap">
          <Head id="home-tutorials" label="─◆─ Learn" title="Tutorials" href="/tutorials" more="All tutorials" />
          <ul className="md-cards">
            {tutorials.slice(0, 3).map((t) => (
              <li key={t.slug}>
                <Link className="md-card" href={`/tutorials/${t.slug}`}>
                  <span className="md-card__kicker">{t.level}</span>
                  <h3 className="md-card__title">{t.title}</h3>
                  <p className="md-card__text">{t.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {posts.length > 0 && (
        <section className="md-section" aria-labelledby="home-blog">
          <div className="md-wrap">
            <Head id="home-blog" label="─◆─ Blog" title="Latest articles" href="/blog" more="All articles" />
            <ul className="md-cards">
              {posts.slice(0, 3).map((p) => (
                <li key={p.slug}>
                  <Link className="md-card" href={`/blog/${p.slug}`}>
                    <span className="md-card__kicker">{p.category}</span>
                    <h3 className="md-card__title">{p.title}</h3>
                    <p className="md-card__text">{p.excerpt}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
