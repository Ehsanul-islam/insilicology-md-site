import Link from "next/link";
import { ANALYSIS_TYPES } from "../lib/data/analysis-types";

export const metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <section className="md-body">
      <div className="md-wrap md-narrow">
        <p className="md-label">─◆─ 404</p>
        <h1 className="md-h2">Page not found</h1>
        <p className="md-muted">That page does not exist. Search for a PDB ID on the <Link href="/#showcase">home page</Link> or browse an analysis type:</p>
        <ul className="md-pills">
          {ANALYSIS_TYPES.slice(0, 6).map((t) => (
            <li key={t.slug}><Link className="md-pill" href={`/analysis/${t.slug}`}>{t.name}</Link></li>
          ))}
        </ul>
      </div>
    </section>
  );
}
