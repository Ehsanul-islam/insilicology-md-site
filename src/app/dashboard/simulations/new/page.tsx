import { redirect } from "next/navigation";
import { PageHead } from "../../../../components/md/pages/PageHead";
import { NewSimulationForm } from "../../../../components/md/dashboard/NewSimulationForm";
import { loadSimulationTypes, requireUser } from "../../../../lib/dashboard/server";

export const metadata = { title: "New simulation" };

export default async function NewSimulationPage() {
  const { supabase, profile } = await requireUser("/dashboard/simulations/new");
  if (profile.status === "restricted") redirect("/dashboard/simulations");
  const types = await loadSimulationTypes(supabase);
  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Dashboard", path: "/dashboard" }, { name: "My simulations", path: "/dashboard/simulations" }, { name: "New", path: "/dashboard/simulations/new" }]}
        title="New simulation"
        lead="Start with the basics. You add the analyses, files and details on the next page, and nothing is public until an administrator approves it."
      />
      <section className="md-body">
        <div className="md-wrap">
          <NewSimulationForm types={types} />
        </div>
      </section>
    </>
  );
}
