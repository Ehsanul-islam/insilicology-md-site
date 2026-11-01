// Temporary one-off import of MD_Simulation_Database into the database. Deployed with ./classify.ts and
// ./xvg.ts (copies of src/lib/import/classify.ts and src/lib/xvg.ts). Reads the repository through the CDN,
// writes with the project's own service key, and is stubbed out once the import has run.
//   GET ?ref=<commit sha>&i=<manifest row>   imports one record   (i=-1 returns the row count)
// Requires the one-time x-import-token header.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { recordFromRow, slugify, type IndexRow } from "./classify.ts";
import { parseTable, parseXvg, toPlotData } from "./xvg.ts";

type ManifestFile = { path: string; kind: string; analysis: string; size: number; caption: string };
type Manifest = { rows: { row: IndexRow; files: ManifestFile[] }[] };

const OWNER_EMAIL = "import@insilicology.invalid";
const REPO = "Ehsanul-islam/insilicology-md-site";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
let manifest: Manifest | null = null;

async function parsedFor(url: string, kind: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    return toPlotData(kind === "xvg" ? parseXvg(text) : parseTable(text));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  // only the holder of the one-time token (its SHA-256 is embedded here) may run the import
  const sent = new TextEncoder().encode(req.headers.get("x-import-token") ?? "");
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", sent))].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hash !== "709c9d7fcaf29077948f99bf5f505e0e198ecafa7305f4ce17f0ad2a118c3183") return json({ error: "forbidden" }, 403);
  const q = new URL(req.url).searchParams;
  const ref = q.get("ref") ?? "";
  const i = Number(q.get("i"));
  if (!/^[0-9a-f]{40}$/.test(ref)) return json({ error: "ref must be a commit sha" }, 400);
  const base = `https://cdn.jsdelivr.net/gh/${REPO}@${ref}/MD_Simulation_Database/`;

  manifest ??= (await (await fetch(`${base}_manifest.json`)).json()) as Manifest;
  if (i === -1) return json({ rows: manifest.rows.length });
  const entry = manifest.rows[i];
  if (!entry) return json({ error: "no such row" }, 404);

  const draft = recordFromRow(entry.row);
  if (!entry.files.length) return json({ slug: draft.slug, skipped: "no files" });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: exists } = await db.from("records").select("id").eq("slug", draft.slug).maybeSingle();
  if (exists) return json({ slug: draft.slug, skipped: "exists" });

  // the account that owns imported records (nobody can sign in to it)
  let owner = (await db.from("profiles").select("id").eq("display_name", "Insilicology").limit(1).maybeSingle()).data?.id as string | undefined;
  if (!owner) {
    const created = await db.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
      email_confirm: true,
      user_metadata: { display_name: "Insilicology" },
    });
    if (created.error || !created.data.user) return json({ error: `owner: ${created.error?.message}` }, 500);
    owner = created.data.user.id;
    await db.from("profiles").update({ display_name: "Insilicology" }).eq("id", owner);
  }

  const { data: sim } = await db.from("simulation_types").select("id").eq("slug", draft.simulationType).single();
  const { data: analyses } = await db.from("analysis_types").select("id,slug");
  const analysisId = new Map((analyses ?? []).map((a) => [a.slug, a.id as string]));

  const { data: rec, error: recErr } = await db
    .from("records")
    .insert({
      owner_id: owner,
      title: draft.title,
      description: draft.description,
      simulation_type_id: sim?.id,
      pdb_id: draft.pdbId,
      protein_name: draft.proteinName,
      molecules: draft.molecules,
      software: draft.software,
      length_ns: draft.lengthNs,
      authors: draft.authors,
      license: "CC-BY-4.0",
    })
    .select("id")
    .single();
  if (recErr || !rec) return json({ error: `record: ${recErr?.message}` }, 500);
  const rid = rec.id as string;
  const undo = async (error: string) => {
    await db.from("records").delete().eq("id", rid);
    return json({ slug: draft.slug, error }, 500);
  };

  await db.from("records").update({ slug: draft.slug }).eq("id", rid);

  const urlOf = (path: string) => base + `${entry.row.database_path}/${path}`.split("/").map(encodeURIComponent).join("/");
  const rows: Record<string, unknown>[] = [];
  let plots = 0;
  for (let k = 0; k < entry.files.length; k += 6) {
    const batch = entry.files.slice(k, k + 6);
    const parsed = await Promise.all(batch.map((f) => (f.kind !== "png" && f.analysis && f.size <= 5_000_000 ? parsedFor(urlOf(f.path), f.kind) : null)));
    batch.forEach((f, n) => {
      if (parsed[n]) plots++;
      rows.push({
        record_id: rid,
        kind: f.kind,
        filename: f.path.split("/").pop(),
        storage_path: `${owner}/${rid}/${f.path}`,
        size_bytes: f.size,
        caption: f.caption || null,
        analysis_type_id: analysisId.get(f.analysis) ?? analysisId.get("other"),
        external_url: urlOf(f.path),
        parsed: parsed[n],
      });
    });
  }
  for (let k = 0; k < rows.length; k += 10) {
    const chunk = rows.slice(k, k + 10);
    const { error } = await db.from("record_files").insert(chunk);
    if (!error) continue;
    for (const r of chunk) {
      // an analysis that does not accept this kind of file: keep the file under "Other"
      const one = await db.from("record_files").insert(r);
      if (one.error) {
        const again = await db.from("record_files").insert({ ...r, analysis_type_id: analysisId.get("other") });
        if (again.error) return await undo(`file ${r.filename}: ${again.error.message}`);
      }
    }
  }

  if (draft.tags.length) {
    await db.from("tags").upsert(draft.tags.map((name) => ({ name, slug: slugify(name) })), { onConflict: "slug", ignoreDuplicates: true });
    const { data: tags } = await db.from("tags").select("id").in("slug", draft.tags.map(slugify));
    if (tags?.length) await db.from("record_tags").insert(tags.map((t) => ({ record_id: rid, tag_id: t.id })));
  }

  const { error: pubErr } = await db.rpc("import_publish_record", { p_id: rid });
  if (pubErr) return await undo(`publish: ${pubErr.message}`);
  return json({ slug: draft.slug, files: rows.length, plots });
});
