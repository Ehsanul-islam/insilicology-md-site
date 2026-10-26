import Link from "next/link";
import { notFound } from "next/navigation";
import { listPosts } from "../../../../lib/data/posts";
import { pageMetadata } from "../../../../lib/seo";
import { PageHead } from "../../../../components/md/pages/PageHead";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 600;
export const generateStaticParams = async () => [...new Set((await listPosts()).map((p) => p.categorySlug))].map((slug) => ({ slug }));

async function load(slug: string) {
  const posts = (await listPosts()).filter((p) => p.categorySlug === slug);
  return { posts, name: posts[0]?.category };
}

export async function generateMetadata({ params }: Props) {
  const { name } = await load((await params).slug);
  if (!name) return {};
  return pageMetadata({
    title: `${name}: molecular dynamics articles`,
    description: `Articles in the ${name} category on molecular dynamics and simulation methods.`,
    path: `/blog/category/${(await params).slug}`,
  });
}

export default async function BlogCategory({ params }: Props) {
  const slug = (await params).slug;
  const { posts, name } = await load(slug);
  if (!name) notFound();
  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }, { name, path: `/blog/category/${slug}` }]}
        title={name}
      />
      <section className="md-body">
        <div className="md-wrap">
          <ul className="md-cards">
            {posts.map((p) => (
              <li key={p.slug}>
                <Link className="md-card" href={`/blog/${p.slug}`}>
                  <h2 className="md-card__title">{p.title}</h2>
                  <p className="md-card__text">{p.excerpt}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
