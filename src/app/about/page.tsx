import Link from "next/link";
import { pageMetadata } from "../../lib/seo";
import { PageHead } from "../../components/md/pages/PageHead";

export const metadata = pageMetadata({
  title: "About Insilicology",
  description:
    "Insilicology runs molecular dynamics simulations for protein–ligand research and maintains an open, searchable database of simulation results and a scientific blog.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "About", path: "/about" }]}
        label="─◆─ About"
        title="About Insilicology"
      />
      <section className="md-body">
        <div className="md-wrap md-narrow">
          <p>
            Insilicology provides molecular dynamics simulation as a service: setting up, running and analysing protein–ligand systems with GROMACS and CHARMM36, delivered as trajectories, publication figures and a methods section you can cite.
          </p>
          <p>
            We also run an open database where researchers publish simulation analyses with their raw data and the paper to cite, and a blog where articles are reviewed by an editor before they are published.
          </p>
          <p>
            New to MD? Start with <Link href="/tutorials/what-is-molecular-dynamics-simulation">what molecular dynamics simulation is</Link>, or <Link href="/contact">get in touch</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
