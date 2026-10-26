import { PageHead } from "../../../components/md/pages/PageHead";
import { RequestForm } from "../../../components/md/dashboard/RequestForm";
import { requireUser } from "../../../lib/dashboard/server";
import { formatDate } from "../../../lib/data/format";

export const metadata = { title: "Requests" };

const LABEL: Record<string, string> = { open: "Open", approved: "Accepted", merged: "Merged into an existing type", rejected: "Declined" };

export default async function RequestsPage() {
  const { supabase } = await requireUser("/dashboard/requests");
  const { data: requests } = await supabase
    .from("type_requests")
    .select("id,name,kind,status,admin_note,created_at")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Dashboard", path: "/dashboard" }, { name: "Requests", path: "/dashboard/requests" }]}
        title="Request a category"
        lead="Only administrators add simulation types and analyses, so that similar names do not end up as duplicates. If yours is missing, ask here."
      />
      <section className="md-body">
        <div className="md-wrap">
          <RequestForm />
          <div>
            <h2>Your requests</h2>
            {requests?.length ? (
              <ul className="md-rows">
                {requests.map((r) => (
                  <li key={r.id} className="md-row">
                    <span className="md-row__title">{r.name}</span>
                    <span className="md-badge">{LABEL[r.status] ?? r.status}</span>
                    <span className="md-row__meta">{r.kind === "analysis" ? "Analysis" : "Simulation type"} · {formatDate(r.created_at)}</span>
                    {r.admin_note && <p className="md-row__note">{r.admin_note}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="md-muted">You have not made any requests.</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
