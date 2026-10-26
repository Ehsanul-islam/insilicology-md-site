import { createPublicClient } from "../supabase/public";
import { ANALYSIS_TYPES, type AnalysisType } from "./analysis-types";
import { cachedRead } from "./cache";
import { mapAnalysisType, type AnalysisTypeRow } from "./map";

/**
 * The analysis types shown on public pages. Administrators manage them in the database; without Supabase
 * the built-in list in analysis-types.ts is used. (That file's synchronous helpers stay for client-side
 * search suggestions.)
 */
const dbList = cachedRead(
  async (): Promise<AnalysisType[]> => {
    const db = createPublicClient()!;
    const { data, error } = await db
      .from("analysis_types")
      .select("slug,name,aliases,summary,intro,command,tutorial_slug,requires_structure,sort_order")
      .eq("status", "active")
      .order("sort_order");
    if (error) throw new Error(`could not load analysis types: ${error.message}`);
    return (data as AnalysisTypeRow[]).map(mapAnalysisType);
  },
  "types:list",
  ["types"],
);

export async function listAnalysisTypes(): Promise<AnalysisType[]> {
  if (!createPublicClient()) return ANALYSIS_TYPES;
  try {
    const rows = await dbList();
    return rows.length ? rows : ANALYSIS_TYPES;
  } catch (e) {
    // the footer and navigation use this on every page; a database hiccup must not take the site down
    console.error(e);
    return ANALYSIS_TYPES;
  }
}

export async function getAnalysisTypeBySlug(slug: string) {
  return (await listAnalysisTypes()).find((t) => t.slug === slug);
}
