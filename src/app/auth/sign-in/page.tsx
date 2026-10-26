import { notFound } from "next/navigation";
import { AuthForm } from "../../../components/md/AuthForm";
import { PageHead } from "../../../components/md/pages/PageHead";
import { isSupabaseConfigured } from "../../../lib/supabase/env";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!isSupabaseConfigured()) notFound();
  const { next, error } = await searchParams;
  return (
    <>
      <PageHead trail={[{ name: "Home", path: "/" }, { name: "Sign in", path: "/auth/sign-in" }]} title="Sign in" lead="Manage your simulations and articles." />
      <section className="md-body">
        <div className="md-wrap">
          <AuthForm mode="sign-in" next={next} notice={error === "link" ? "That link has expired or was already used. Request a new one." : undefined} />
        </div>
      </section>
    </>
  );
}
