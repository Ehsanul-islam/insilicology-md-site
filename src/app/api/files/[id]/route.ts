import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "../../../../lib/supabase/admin";
import { DOWNLOADS_ENABLED } from "../../../../lib/features";
import { createPublicClient } from "../../../../lib/supabase/public";

const EXTERNAL_HOSTS = new Set(["cdn.jsdelivr.net", "raw.githubusercontent.com"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Serves a file of a PUBLISHED record: it looks the file up in the public snapshot (so unpublished and
 * unapproved files are never served), then redirects to a signed storage URL that expires in a minute.
 * Add ?download=1 to get it as an attachment.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("Not found", { status: 404 });

  const pub = createPublicClient();
  if (!pub) return new NextResponse("File downloads are not configured", { status: 503 });

  // an explicit JSON filter: supabase-js's contains() would turn an array of objects into a Postgres array literal
  const { data, error } = await pub.from("public_records").select("files").filter("files", "cs", JSON.stringify([{ id }])).limit(1).maybeSingle();
  if (error) {
    console.error("file lookup failed", error.message);
    return new NextResponse("Temporarily unavailable", { status: 503 });
  }
  const file = (data?.files as { id: string; kind: string; storage_path: string; filename: string; external_url?: string | null }[] | undefined)?.find((f) => f.id === id);
  if (!file) return new NextResponse("Not found", { status: 404 });

  // while downloads are off, only the figures the pages display inline are served; data files are not
  if (!DOWNLOADS_ENABLED && file.kind !== "png" && file.kind !== "svg") return new NextResponse("Downloads are not available", { status: 403 });

  // files that live in the GitHub repository (imported datasets) are served by the CDN
  if (file.external_url && EXTERNAL_HOSTS.has(new URL(file.external_url).hostname)) {
    return NextResponse.redirect(file.external_url, { status: 302, headers: { "Cache-Control": "public, max-age=3600" } });
  }

  // files in Storage need the service key to be signed
  const admin = createAdminSupabase();
  if (!admin) return new NextResponse("File downloads are not configured", { status: 503 });
  const download = DOWNLOADS_ENABLED && request.nextUrl.searchParams.get("download") === "1";
  const { data: signed, error: signError } = await admin.storage
    .from("record-files")
    .createSignedUrl(file.storage_path, 60, download ? { download: file.filename } : undefined);
  if (signError || !signed) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(signed.signedUrl, { status: 302, headers: { "Cache-Control": "no-store" } });
}
