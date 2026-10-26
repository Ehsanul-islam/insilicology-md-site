import Link from "next/link";
import { JsonLd } from "../../JsonLd";
import { breadcrumbLd, type Crumb } from "../../../lib/seo";

/** Visible trail plus BreadcrumbList JSON-LD. The last crumb is the current page. */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <>
      <nav className="md-crumbs" aria-label="Breadcrumb">
        <ol>
          {trail.map((c, i) => (
            <li key={c.path}>
              {i === trail.length - 1 ? <span aria-current="page">{c.name}</span> : <Link href={c.path}>{c.name}</Link>}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={breadcrumbLd(trail)} />
    </>
  );
}
