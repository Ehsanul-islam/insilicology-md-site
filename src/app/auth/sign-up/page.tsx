import { notFound } from "next/navigation";
import { AuthForm } from "../../../components/md/AuthForm";
import { PageHead } from "../../../components/md/pages/PageHead";
import { isSupabaseConfigured } from "../../../lib/supabase/env";

export const metadata = { title: "Create an account" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!isSupabaseConfigured()) notFound();
  const { next } = await searchParams;
  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Create an account", path: "/auth/sign-up" }]}
        title="Create an account"
        lead="Publish simulation results and write articles. Everything is reviewed by an administrator before it goes public."
      />
      <section className="md-body">
        <div className="md-wrap">
          <AuthForm mode="sign-up" next={next} />
        </div>
      </section>
    </>
  );
}
