import { redirect } from "next/navigation";
import { PageHead } from "../../components/md/pages/PageHead";
import { createServerSupabase } from "../../lib/supabase/server";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (!supabase || !data.user) redirect("/auth/sign-in?next=/dashboard");
  const { data: profile } = await supabase.from("profiles").select("display_name,role,status").eq("id", data.user.id).maybeSingle();

  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Dashboard", path: "/dashboard" }]}
        title={`Welcome${profile?.display_name ? `, ${profile.display_name}` : ""}`}
        lead="Your account is ready."
      />
      <section className="md-body">
        <div className="md-wrap md-narrow">
          {profile?.status === "restricted" && (
            <p className="md-banner" role="alert">This account is restricted. You can read the site but not publish. Contact us if you think this is a mistake.</p>
          )}
          <p className="md-muted">My Simulations and My Blogs are coming next. You will be able to upload results, write articles, and track their review here.</p>
          <dl className="md-facts">
            <dt>Email</dt>
            <dd>{data.user.email}</dd>
            <dt>Role</dt>
            <dd>{profile?.role ?? "user"}</dd>
          </dl>
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="md-btn md-btn-secondary">Sign out</button>
          </form>
        </div>
      </section>
    </>
  );
}
