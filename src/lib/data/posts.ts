import { createPublicClient } from "../supabase/public";
import { cachedRead } from "./cache";
import { mapPublicPost, type PublicPostRow } from "./map";

/**
 * Public blog posts. Posts are written by registered users and published only after an administrator
 * approves them, so reads come from the public_posts view (the approved snapshot). Without Supabase
 * there are no posts and the blog pages show an empty state.
 */
export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  contentMd: string;
  featuredImage: string | null;
  category: string;
  categorySlug: string;
  tags: string[];
  author: string;
  publishedAt: string;
  updatedAt: string;
  references: { text: string; url?: string }[];
};

const dbList = cachedRead(
  async (): Promise<BlogPost[]> => {
    const db = createPublicClient()!;
    const { data, error } = await db.from("public_posts").select("*").order("published_at", { ascending: false }).limit(1000);
    if (error) throw new Error(`could not load posts: ${error.message}`);
    return (data as PublicPostRow[]).map(mapPublicPost);
  },
  "posts:list",
  ["posts"],
);

export async function listPosts(): Promise<BlogPost[]> {
  if (!createPublicClient()) return [];
  return dbList();
}

export async function getPost(slug: string): Promise<BlogPost | undefined> {
  return (await listPosts()).find((p) => p.slug === slug);
}
