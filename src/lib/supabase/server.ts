import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/**
 * Client acting as the signed-in visitor (session from cookies). Reading cookies makes a page dynamic,
 * so use it only in dashboards, actions and route handlers, never on public pages.
 */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a Server Component, where cookies are read-only; the middleware refreshes the session
        }
      },
    },
  });
}
