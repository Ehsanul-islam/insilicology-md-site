import { pageMetadata } from "../../lib/seo";
import { PageHead } from "../../components/md/pages/PageHead";

export const metadata = pageMetadata({
  title: "Terms of use",
  description: "Terms of use for the Insilicology molecular dynamics simulation service and database. Placeholder until the full text is reviewed.",
  path: "/terms",
  noindex: true,
});

export default function Page() {
  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Terms of use", path: "/terms" }]}
        label="─◆─ Legal"
        title="Terms of use"
      />
      <section className="md-body">
        <div className="md-wrap md-narrow">
          <p className="md-banner" role="note">
            This page is a placeholder. The full text must be written and reviewed before launch.
          </p>
        </div>
      </section>
    </>
  );
}
