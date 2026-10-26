import Link from "next/link";
import { PageHead } from "../../components/md/pages/PageHead";
import { ProfileForm } from "../../components/md/dashboard/ProfileForm";
import { markNotificationsRead } from "./simulations/actions";
import { requireUser } from "../../lib/dashboard/server";
import { STATUS_LABEL, type RecordStatus } from "../../lib/dashboard/validate";
import { formatDate } from "../../lib/data/format";

export const metadata = { title: "Overview" };

export default async function DashboardPage() {
  const { supabase, user, profile } = await requireUser("/dashboard");
  const [{ data: records }, { data: notes }] = await Promise.all([
    supabase.from("records").select("status"),
    supabase.from("notifications").select("id,title,body,link,read_at,created_at").order("created_at", { ascending: false }).limit(8),
  ]);
  const counts = new Map<string, number>();
  for (const r of records ?? []) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  const unread = (notes ?? []).filter((n) => !n.read_at).length;

  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Dashboard", path: "/dashboard" }]}
        title={`Welcome${profile.display_name ? `, ${profile.display_name}` : ""}`}
        lead="Upload simulation results, follow their review and keep your profile up to date."
      />
      <section className="md-body">
        <div className="md-wrap">
          {profile.status === "restricted" && (
            <p className="md-banner" role="alert">This account is restricted. You can read the site but not publish. Contact us if you think this is a mistake.</p>
          )}
          <div>
            <div className="md-section-head">
              <h2>My simulations</h2>
              <Link href="/dashboard/simulations/new" className="md-btn md-btn-primary">New simulation</Link>
            </div>
            {records?.length ? (
              <ul className="md-stats">
                {(Object.keys(STATUS_LABEL) as RecordStatus[]).filter((s) => counts.get(s)).map((s) => (
                  <li key={s} className="md-stat"><strong>{counts.get(s)}</strong><span>{STATUS_LABEL[s]}</span></li>
                ))}
              </ul>
            ) : (
              <p className="md-muted">You have no simulations yet. Create one, add your analysis files and submit it for review.</p>
            )}
            <p><Link href="/dashboard/simulations">See all my simulations →</Link></p>
          </div>

          <div>
            <div className="md-section-head">
              <h2>Notifications{unread ? ` (${unread} new)` : ""}</h2>
              {unread > 0 && (
                <form action={markNotificationsRead}><button type="submit" className="md-linkbtn">Mark all as read</button></form>
              )}
            </div>
            {notes?.length ? (
              <ul className="md-rows">
                {notes.map((n) => (
                  <li key={n.id} className="md-row">
                    {n.link ? <Link className="md-row__title" href={n.link}>{n.title}</Link> : <span className="md-row__title">{n.title}</span>}
                    <span className="md-row__meta">{formatDate(n.created_at)}{n.read_at ? "" : " · new"}</span>
                    {n.body && <p className="md-row__note">{n.body}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="md-muted">Nothing yet. You will be told here when a simulation is published or needs changes.</p>
            )}
          </div>

          <div className="md-narrow">
            <h2>Profile</h2>
            <dl className="md-facts">
              <dt>Email</dt>
              <dd>{user.email}</dd>
              <dt>Role</dt>
              <dd>{profile.role}</dd>
            </dl>
            <ProfileForm profile={profile} />
            <form action="/auth/sign-out" method="post">
              <button type="submit" className="md-btn md-btn-secondary">Sign out</button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
