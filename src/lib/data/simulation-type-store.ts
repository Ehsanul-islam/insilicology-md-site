import { createPublicClient } from "../supabase/public";
import { cachedRead } from "./cache";
import { mapSimulationType, type SimulationTypeRow } from "./map";
import { SIMULATION_TYPES, type SimulationType } from "./simulation-types";

/**
 * The simulation types shown on public pages. Administrators manage them in the database; without Supabase
 * (or if it cannot be reached) the built-in list in simulation-types.ts is used, so a database hiccup never
 * takes the site down. The synchronous helpers in that file stay for client-side search suggestions.
 */
const dbList = cachedRead(
  async (): Promise<SimulationType[]> => {
    const db = createPublicClient()!;
    const { data, error } = await db
      .from("simulation_types")
      .select("slug,name,aliases,summary,intro,requires_structure,sort_order")
      .eq("status", "active")
      .order("sort_order");
    if (error) throw new Error(`could not load simulation types: ${error.message}`);
    return (data as SimulationTypeRow[]).map(mapSimulationType);
  },
  "types:simulation",
  ["types"],
);

export async function listSimulationTypes(): Promise<SimulationType[]> {
  if (!createPublicClient()) return SIMULATION_TYPES;
  try {
    const rows = await dbList();
    return rows.length ? rows : SIMULATION_TYPES;
  } catch (e) {
    console.error(e);
    return SIMULATION_TYPES;
  }
}

export async function getSimulationTypeBySlug(slug: string) {
  return (await listSimulationTypes()).find((t) => t.slug === slug);
}
