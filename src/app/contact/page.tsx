import { ContactForm } from "../../components/md/ContactForm";
import { isValidPdbId, normalisePdbId } from "../../components/md/showcase/data/api";
import { createAdminSupabase } from "../../lib/supabase/admin";
import { pageMetadata } from "../../lib/seo";
import { PageHead } from "../../components/md/pages/PageHead";

export const metadata = pageMetadata({
  title: "Contact and quote requests for MD simulations",
  description:
    "Contact Insilicology to request a molecular dynamics simulation quote, report a problem with a record, or ask for help with GROMACS analysis.",
  path: "/contact",
});

const EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ pdb?: string }> }) {
  const raw = normalisePdbId((await searchParams).pdb ?? "");
  const pdb = isValidPdbId(raw) ? raw : null;
  const subject = pdb ? `Quote request: ${pdb}` : "Inquiry";

  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }]}
        label="─◆─ Contact"
        title="Contact us"
        lead="Request a simulation quote, report a problem with a record, or ask for help with your analysis."
      />
      <section className="md-body" id="contact">
        <div className="md-wrap md-narrow">
          {pdb && (
            <p className="md-notice" role="status">
              Quote request for PDB <span className="md-mono">{pdb}</span>. Mention your ligand and the analyses you need.
            </p>
          )}
          {createAdminSupabase() ? (
            <ContactForm pdb={pdb ?? undefined} />
          ) : EMAIL ? (
            <p>
              Email us at <a href={`mailto:${EMAIL}?subject=${encodeURIComponent(subject)}`}>{EMAIL}</a>.
            </p>
          ) : (
            <p className="md-banner" role="note">
              The contact form and email address are not connected yet. They arrive with the backend.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
