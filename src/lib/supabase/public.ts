import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

let client: SupabaseClient | null = null;

/**
 * Cookie-less client for reading published content. It never carries a session, so pages that use it
 * stay statically generated and cacheable, and it can only see what the anonymous role may see.
 */
export function createPublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
