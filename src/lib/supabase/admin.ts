import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

let client: SupabaseClient | null = null;

/**
 * Service-role client. It bypasses row-level security, so it is for trusted server code only (signed
 * download URLs, the contact form, webhooks) and must never be imported from a client component.
 * SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix, so it is never sent to the browser.
 */
export function createAdminSupabase(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  client ??= createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
