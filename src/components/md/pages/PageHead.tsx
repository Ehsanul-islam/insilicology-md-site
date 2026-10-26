import type { ReactNode } from "react";
import type { Crumb } from "../../../lib/seo";
import { Breadcrumbs } from "./Breadcrumbs";

/** Top of an inner page: breadcrumbs, one H1, optional lead. */
export function PageHead({ trail, label, title, lead }: { trail: Crumb[]; label?: string; title: string; lead?: ReactNode }) {
  return (
    <header className="md-page-head">
      <div className="md-wrap">
        <Breadcrumbs trail={trail} />
        {label && <p className="md-label">{label}</p>}
        <h1>{title}</h1>
        {lead && <p className="md-lead">{lead}</p>}
      </div>
    </header>
  );
}
