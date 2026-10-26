import type { Metadata } from "next";

export const SITE_NAME = "Insilicology";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://insilicology.com").replace(/\/$/, "");

export const abs = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Keep meta descriptions inside the ~155 characters search engines show. */
export function clip(text: string, max = 155) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

type PageMeta = {
  title: string;
  description: string;
  path: string;
  /** Keep the page out of search results (placeholder data, filtered lists, drafts). */
  noindex?: boolean;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
};

/** One place that builds title, description, canonical, Open Graph and Twitter metadata. */
export function pageMetadata({ title, description, path, noindex, type = "website", publishedTime, modifiedTime }: PageMeta): Metadata {
  const desc = clip(description);
  return {
    title,
    description: desc,
    alternates: { canonical: path },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title,
      description: desc,
      url: path,
      siteName: SITE_NAME,
      type,
      ...(type === "article" ? { publishedTime, modifiedTime } : {}),
    },
    twitter: { card: "summary_large_image", title, description: desc },
  };
}

export type Crumb = { name: string; path: string };

export const breadcrumbLd = (crumbs: Crumb[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: abs(c.path) })),
});

export const organizationLd = () => ({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": abs("/#org"), name: SITE_NAME, url: abs("/") },
    {
      "@type": "WebSite",
      "@id": abs("/#site"),
      url: abs("/"),
      name: SITE_NAME,
      publisher: { "@id": abs("/#org") },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${abs("/pdb")}/{search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ],
});
