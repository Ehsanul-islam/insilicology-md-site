import { notFound } from "next/navigation";
import { PageHead } from "../../components/md/pages/PageHead";
import { createServerSupabase } from "../../lib/supabase/server";

export const metadata = { title: "Administration" };

export default async function AdminPage() {
  const supabase = await createServerSupabase();
  if (!supabase) notFound();
  // the database decides: admin_counts() raises unless the caller is an active administrator
  const { data: counts, error } = await supabase.rpc("admin_counts");
  if (error || !counts) notFound();

  const items = [
    ["Simulations to review", counts.records],
    ["Articles to review", counts.posts],
    ["Category requests", counts.type_requests],
    ["New messages", counts.messages],
  ] as const;

  return (
    <>
      <PageHead trail={[{ name: "Home", path: "/" }, { name: "Administration", path: "/admin" }]} title="Administration" lead="Work waiting for you." />
      <section className="md-body">
        <div className="md-wrap">
          <ul className="md-cards">
            {items.map(([label, n]) => (
              <li key={label} className="md-card">
                <span className="md-card__kicker">{label}</span>
                <p className="md-card__title md-num">{n}</p>
              </li>
            ))}
          </ul>
          <p className="md-muted">The review queues arrive with the administrator dashboard.</p>
        </div>
      </section>
    </>
  );
}
