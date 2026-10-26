import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createServerSupabase } from "../supabase/server";
import type { AnalysisRules } from "./validate";

export type Profile = { display_name: string; affiliation: string | null; orcid: string | null; role: "user" | "admin"; status: "active" | "restricted" };

/** The signed-in visitor and a client that acts as them. Redirects to sign-in when there is no session. */
export async function requireUser(next = "/dashboard"): Promise<{ supabase: SupabaseClient; user: User; profile: Profile }> {
  const supabase = await createServerSupabase();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (!supabase || !data.user) redirect(`/auth/sign-in?next=${encodeURIComponent(next)}`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,affiliation,orcid,role,status")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    supabase,
    user: data.user,
    profile: (profile as Profile | null) ?? { display_name: "", affiliation: null, orcid: null, role: "user", status: "active" },
  };
}

export type AnalysisOption = AnalysisRules & {
  id: string;
  summary: string;
  citation: "required" | "optional";
  molecules: "required" | "optional";
};

type AnalysisRow = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  file_rules: { allowed?: string[]; required?: string[]; max_mb?: number } | null;
  field_schema: { citation?: string; molecules?: string } | null;
};

export const toAnalysisOption = (r: AnalysisRow): AnalysisOption => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  summary: r.summary,
  allowed: r.file_rules?.allowed ?? [],
  required: r.file_rules?.required ?? [],
  maxMb: r.file_rules?.max_mb ?? 50,
  citation: r.field_schema?.citation === "required" ? "required" : "optional",
  molecules: r.field_schema?.molecules === "required" ? "required" : "optional",
});

/** Active analyses with their upload rules, as the database holds them (admins can change them). */
export async function loadAnalyses(supabase: SupabaseClient): Promise<AnalysisOption[]> {
  const { data } = await supabase
    .from("analysis_types")
    .select("id,slug,name,summary,file_rules,field_schema")
    .eq("status", "active")
    .order("sort_order")
    .order("name");
  return ((data ?? []) as AnalysisRow[]).map(toAnalysisOption);
}

export type SimulationOption = { id: string; slug: string; name: string; summary: string; requiresStructure: boolean };

export async function loadSimulationTypes(supabase: SupabaseClient): Promise<SimulationOption[]> {
  const { data } = await supabase
    .from("simulation_types")
    .select("id,slug,name,summary,requires_structure")
    .eq("status", "active")
    .order("sort_order")
    .order("name");
  return (data ?? []).map((r) => ({ id: r.id, slug: r.slug, name: r.name, summary: r.summary, requiresStructure: r.requires_structure }));
}

/** Plain-language message for a database error raised by our triggers and functions. */
export function friendlyError(e: { message?: string; code?: string } | null | undefined): string {
  const msg = e?.message ?? "";
  switch (e?.code) {
    case "23514": // our own check messages are already written for people
      return /violates check constraint/.test(msg) ? "One of the values is not valid. Check the fields and try again." : msg;
    case "54000":
    case "55000":
      return msg;
    case "P0002":
      return "We could not find that record.";
    case "42501":
      return /restricted/.test(msg)
        ? "This account is restricted, so it cannot publish. Contact us if you think this is a mistake."
        : "You cannot change this record right now. Records in review are locked until an administrator decides.";
    case "23505":
      return msg.includes("already") ? msg : "That value is already used.";
    default:
      return "Something went wrong. Please try again.";
  }
}
