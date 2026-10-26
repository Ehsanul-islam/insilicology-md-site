/**
 * Public blog posts. Posts are written by registered users and published only after
 * an administrator approves them (Milestones 3 and 5), so until the backend exists
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

export async function listPosts(): Promise<BlogPost[]> {
  return [];
}

export async function getPost(slug: string): Promise<BlogPost | undefined> {
  return (await listPosts()).find((p) => p.slug === slug);
}
