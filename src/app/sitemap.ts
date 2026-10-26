import type { MetadataRoute } from "next";
import { ANALYSIS_TYPES } from "../lib/data/analysis-types";
import { isIndexable, listPublishedPdbs, listRecords, recordPath } from "../lib/data/records";
import { listPosts } from "../lib/data/posts";
import { listTutorials } from "../lib/data/tutorials";
import { abs } from "../lib/seo";

/** Only pages that are meant to rank: placeholder records and empty pages are left out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [records, pdbs, posts, tutorials] = await Promise.all([listRecords(), listPublishedPdbs(), listPosts(), listTutorials()]);
  const real = records.filter(isIndexable);
  const realPdbs = new Set(real.map((r) => r.pdb_id));

  return [
    { url: abs("/"), changeFrequency: "weekly", priority: 1 },
    { url: abs("/tutorials"), changeFrequency: "weekly", priority: 0.8 },
    { url: abs("/analysis"), changeFrequency: "monthly", priority: 0.8 },
    { url: abs("/contact"), changeFrequency: "yearly", priority: 0.4 },
    { url: abs("/about"), changeFrequency: "yearly", priority: 0.3 },
    { url: abs("/data-license"), changeFrequency: "yearly", priority: 0.2 },
    ...(posts.length ? [{ url: abs("/blog"), changeFrequency: "weekly" as const, priority: 0.7 }] : []),
    ...(real.length ? [{ url: abs("/simulations"), changeFrequency: "daily" as const, priority: 0.8 }] : []),
    ...tutorials.map((t) => ({ url: abs(`/tutorials/${t.slug}`), lastModified: t.updated, priority: 0.8 })),
    ...ANALYSIS_TYPES.map((t) => ({ url: abs(`/analysis/${t.slug}`), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...pdbs.filter((p) => realPdbs.has(p.pdb_id)).map((p) => ({ url: abs(`/pdb/${p.pdb_id.toLowerCase()}`), priority: 0.6 })),
    ...real.map((r) => ({ url: abs(recordPath(r)), lastModified: r.published_at || undefined, priority: 0.6 })),
    ...posts.map((p) => ({ url: abs(`/blog/${p.slug}`), lastModified: p.updatedAt, priority: 0.6 })),
  ];
}
