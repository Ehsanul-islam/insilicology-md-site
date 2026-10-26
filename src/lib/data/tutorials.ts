import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export type Tutorial = {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  level: "Beginner" | "Intermediate" | "Advanced";
  /** ISO dates. */
  published: string;
  updated: string;
  /** Lower numbers first. */
  order: number;
  body: string;
};

const DIR = path.join(process.cwd(), "content/tutorials");
const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

export async function listTutorials(): Promise<Tutorial[]> {
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".md"));
  const all = await Promise.all(
    files.map(async (f) => {
      const { data, content } = matter(await readFile(path.join(DIR, f), "utf8"));
      return {
        slug: f.replace(/\.md$/, ""),
        title: String(data.title),
        description: String(data.description),
        keywords: (data.keywords as string[]) ?? [],
        level: (data.level as Tutorial["level"]) ?? "Beginner",
        published: iso(data.published),
        updated: iso(data.updated ?? data.published),
        order: Number(data.order ?? 99),
        body: content,
      } satisfies Tutorial;
    }),
  );
  return all.sort((a, b) => a.order - b.order);
}

export async function getTutorial(slug: string) {
  return (await listTutorials()).find((t) => t.slug === slug);
}
