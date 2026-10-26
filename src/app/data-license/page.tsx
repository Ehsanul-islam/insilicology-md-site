import { pageMetadata } from "../../lib/seo";
import { PageHead } from "../../components/md/pages/PageHead";

export const metadata = pageMetadata({
  title: "Data license for simulation records",
  description:
    "How simulation data published on Insilicology is licensed (CC BY 4.0 by default), what each record declares, and how to cite the dataset and its paper.",
  path: "/data-license",
});

export default function DataLicensePage() {
  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Data license", path: "/data-license" }]}
        label="─◆─ Legal"
        title="Data license"
      />
      <section className="md-body">
        <div className="md-wrap md-narrow">
          <p>
            Simulation records on this site declare a license chosen by the contributor. The default is{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">Creative Commons Attribution 4.0 (CC BY 4.0)</a>, which allows reuse with credit.
          </p>
          <p>Every record shows its license, the force field and software used, and a citation you can copy. If a record is linked to a paper, cite the paper as well as the dataset.</p>
          <p className="md-banner" role="note">Draft wording. It will be reviewed before launch.</p>
        </div>
      </section>
    </>
  );
}
