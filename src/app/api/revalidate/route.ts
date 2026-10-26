import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

const TABLE_TAGS: Record<string, string[]> = {
  records: ["records"],
  record_files: ["records"],
  record_tags: ["records"],
  posts: ["posts"],
  post_tags: ["posts"],
  analysis_types: ["types", "records"],
  blog_categories: ["posts"],
};

function sameSecret(given: string | null, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Called by a Supabase Database Webhook (or by hand) when published content changes, so approvals show up
 * on the public pages immediately instead of after the hourly cache expires. Protected by REVALIDATE_SECRET.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (!sameSecret(request.headers.get("x-revalidate-secret"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let table = "";
  try {
    table = String(((await request.json()) as { table?: string }).table ?? "");
  } catch {
    // an empty body means "refresh everything"
  }
  const tags = TABLE_TAGS[table] ?? Object.values(TABLE_TAGS).flat();
  for (const tag of new Set(tags)) revalidateTag(tag);
  revalidatePath("/", "layout");
  return NextResponse.json({ revalidated: [...new Set(tags)] });
}
