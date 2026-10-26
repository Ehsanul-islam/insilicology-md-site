import Link from "next/link";
import { PageHead } from "../../../components/md/pages/PageHead";
import { StatusBadge } from "../../../components/md/dashboard/StatusBadge";
import { requireUser } from "../../../lib/dashboard/server";
import type { RecordStatus } from "../../../lib/dashboard/validate";
import { formatDate } from "../../../lib/data/format";

export const metadata = { title: "My simulations" };

export default async function MySimulationsPage() {
  const { supabase } = await requireUser("/dashboard/simulations");
  const { data: records } = await supabase
    .from("records")
    .select("id,slug,title,pdb_id,status,is_public,admin_feedback,updated_at, simulation_types(name)")
    .order("updated_at", { ascending: false });

  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Dashboard", path: "/dashboard" }, { name: "My simulations", path: "/dashboard/simulations" }]}
        title="My simulations"
        lead="Everything you have uploaded, and where it is in the review."
      />
      <section className="md-body">
        <div className="md-wrap">
          <p><Link href="/dashboard/simulations/new" className="md-btn md-btn-primary">New simulation</Link></p>
          {records?.length ? (
            <ul className="md-rows">
              {records.map((r) => {
                const type = (r.simulation_types as unknown as { name: string } | null)?.name;
                return (
                  <li key={r.id} className="md-row">
                    <Link className="md-row__title" href={`/dashboard/simulations/${r.id}`}>{r.title}</Link>
                    <StatusBadge status={r.status as RecordStatus} live={r.is_public} />
                    <span className="md-row__meta">
                      {[type, r.pdb_id, `updated ${formatDate(r.updated_at)}`].filter(Boolean).join(" · ")}
                      {r.is_public && <> · <Link href={`/simulations/${r.slug}`}>view public page</Link></>}
                    </span>
                    {r.admin_feedback && (r.status === "changes_requested" || r.status === "rejected" || r.status === "unpublished") && (
                      <p className="md-row__note">Reviewer: {r.admin_feedback}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="md-muted">Nothing here yet. Create your first simulation to get started.</p>
          )}
        </div>
      </section>
    </>
  );
}
