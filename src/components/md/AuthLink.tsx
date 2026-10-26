"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "../../lib/supabase/env";
import { createBrowserSupabase } from "../../lib/supabase/client";

/** "Sign in" or "Dashboard" in the nav. Rendered client-side so public pages stay static and cacheable. */
export function AuthLink() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(!!session));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured()) return null;
  return (
    <span className="md-auth-slot">
      {signedIn === null ? null : signedIn ? <Link href="/dashboard">Dashboard</Link> : <Link href="/auth/sign-in">Sign in</Link>}
    </span>
  );
}
