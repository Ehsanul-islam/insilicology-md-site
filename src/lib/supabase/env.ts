/**
 * Supabase settings. Every NEXT_PUBLIC_* variable must be read with its full static name so the
 * bundler can inline it into browser code. When they are not set the site runs on sample data.
 *
 * The publishable key (older projects call it the anon key) is meant to be public: what a visitor
 * may do is decided by the row-level security policies in supabase/migrations, not by hiding it.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_KEY);
