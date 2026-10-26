/** Turn Crossref and RCSB API answers into form values. Pure, so they are tested with saved responses. */

/** "https://doi.org/10.1000/x", "doi:10.1000/x" or "10.1000/x" become "10.1000/x"; anything else null. */
export function normaliseDoi(input: string): string | null {
  const s = input.trim().replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, "");
  return /^10\.\d{4,9}\/\S+$/.test(s) ? s : null;
}

export type CitationFields = { title: string; authors: string[]; year: number | null; journal: string; url: string; bibtex: string };

type CrossrefName = { given?: string; family?: string; name?: string };
type CrossrefWork = {
  DOI?: string;
  title?: string[];
  author?: CrossrefName[];
  "container-title"?: string[];
  issued?: { "date-parts"?: (number | null)[][] };
  published?: { "date-parts"?: (number | null)[][] };
  volume?: string;
  page?: string;
  URL?: string;
};

const clean = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const bib = (s: string) => s.replace(/[{}\\]/g, "");

/** The `message` of https://api.crossref.org/works/<doi>. */
export function fromCrossref(msg: CrossrefWork): CitationFields {
  const title = clean(msg.title?.[0] ?? "");
  const authors = (msg.author ?? []).map((a) => clean(a.name ?? [a.given, a.family].filter(Boolean).join(" "))).filter(Boolean);
  const year = (msg.issued ?? msg.published)?.["date-parts"]?.[0]?.[0] ?? null;
  const journal = clean(msg["container-title"]?.[0] ?? "");
  const doi = msg.DOI ?? "";
  const key = `${(msg.author?.[0]?.family ?? "paper").replace(/[^A-Za-z]/g, "").toLowerCase() || "paper"}${year ?? ""}`;
  const fields = [
    ["title", title],
    ["author", authors.join(" and ")],
    ["journal", journal],
    ["year", year ? String(year) : ""],
    ["volume", msg.volume ?? ""],
    ["pages", msg.page ?? ""],
    ["doi", doi],
  ].filter(([, v]) => v);
  const bibtex = `@article{${key},\n${fields.map(([k, v]) => `  ${k} = {${bib(v)}}`).join(",\n")}\n}`;
  return { title, authors, year, journal, url: doi ? `https://doi.org/${doi}` : msg.URL ?? "", bibtex };
}

type RcsbEntry = { struct?: { title?: string } };
type RcsbPolymerEntity = { rcsb_polymer_entity?: { pdbx_description?: string } };

/** https://data.rcsb.org/rest/v1/core/entry/<id> and .../polymer_entity/<id>/1. */
export function fromRcsb(entry: RcsbEntry | null, entity: RcsbPolymerEntity | null): { proteinName: string; title: string } {
  const title = clean(entry?.struct?.title ?? "");
  const desc = clean(entity?.rcsb_polymer_entity?.pdbx_description ?? "");
  const proteinName = desc ? desc.charAt(0).toUpperCase() + desc.slice(1).toLowerCase() : title;
  return { proteinName: proteinName.slice(0, 300), title };
}
