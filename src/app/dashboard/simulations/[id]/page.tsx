import { notFound } from "next/navigation";
import { PageHead } from "../../../../components/md/pages/PageHead";
import { RecordEditor, type EditorFile, type EditorRecord, type HistoryItem } from "../../../../components/md/dashboard/RecordEditor";
import type { PlotData } from "../../../../components/md/pages/XvgPlot";
import { loadAnalyses, loadSimulationTypes, requireUser } from "../../../../lib/dashboard/server";
import type { RecordStatus } from "../../../../lib/dashboard/validate";

export const metadata = { title: "Edit simulation" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function EditSimulationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, user, profile } = await requireUser(`/dashboard/simulations/${id}`);

  const { data: r } = await supabase.from("records").select("*, simulation_types(slug)").eq("id", id).maybeSingle();
  if (!r || r.owner_id !== user.id) notFound();

  const [{ data: fileRows }, { data: tagRows }, { data: events }, analyses, simulationTypes] = await Promise.all([
    supabase
      .from("record_files")
      .select("id,kind,filename,size_bytes,parsed,created_at, analysis_types(slug)")
      .eq("record_id", id)
      .order("created_at"),
    supabase.from("record_tags").select("tags(name)").eq("record_id", id),
    supabase.from("review_events").select("action,reason,created_at").eq("subject_type", "record").eq("subject_id", id).order("created_at", { ascending: false }),
    loadAnalyses(supabase),
    loadSimulationTypes(supabase),
  ]);

  const record: EditorRecord = {
    id: r.id,
    slug: r.slug,
    status: r.status as RecordStatus,
    isPublic: r.is_public,
    adminFeedback: r.admin_feedback,
    title: r.title,
    description: r.description ?? "",
    simulationType: (r.simulation_types as { slug: string } | null)?.slug ?? "",
    pdbId: r.pdb_id ?? "",
    proteinName: r.protein_name ?? "",
    molecules: ((r.molecules ?? []) as { kind?: string; name?: string; resn?: string; pubchem_cid?: number }[]).map((m) => ({
      kind: m.kind ?? "ligand",
      name: m.name ?? "",
      resn: m.resn ?? "",
      pubchemCid: m.pubchem_cid ? String(m.pubchem_cid) : "",
    })),
    software: r.software ?? "",
    softwareVersion: r.software_version ?? "",
    forceField: r.force_field ?? "",
    lengthNs: r.length_ns == null ? "" : String(r.length_ns),
    replicas: r.replicas == null ? "" : String(r.replicas),
    methodology: r.methodology ?? "",
    authors: r.authors ?? [],
    doi: r.doi ?? "",
    paperUrl: r.paper_url ?? "",
    bibtex: r.citation_bibtex ?? "",
    license: r.license,
    tags: (tagRows ?? []).map((t) => (t.tags as unknown as { name: string } | null)?.name ?? "").filter(Boolean),
  };
  const files: EditorFile[] = (fileRows ?? []).map((f) => ({
    id: f.id,
    kind: f.kind,
    filename: f.filename,
    sizeBytes: Number(f.size_bytes),
    analysisSlug: (f.analysis_types as unknown as { slug: string } | null)?.slug ?? null,
    parsed: f.parsed && typeof f.parsed === "object" && Array.isArray((f.parsed as PlotData).series) ? (f.parsed as PlotData) : null,
  }));
  const history: HistoryItem[] = (events ?? []).map((e) => ({ action: e.action, reason: e.reason, at: e.created_at }));

  return (
    <>
      <PageHead
        trail={[{ name: "Home", path: "/" }, { name: "Dashboard", path: "/dashboard" }, { name: "My simulations", path: "/dashboard/simulations" }, { name: record.title, path: `/dashboard/simulations/${id}` }]}
        title={record.title}
        lead={`Web address: /simulations/${record.slug}`}
      />
      <section className="md-body">
        <div className="md-wrap md-narrow">
          <RecordEditor record={record} files={files} analyses={analyses} simulationTypes={simulationTypes} history={history} restricted={profile.status === "restricted"} />
        </div>
      </section>
    </>
  );
}
