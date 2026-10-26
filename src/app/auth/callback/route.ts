import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "../../../lib/safe-next";
import { createServerSupabase } from "../../../lib/supabase/server";

/** Finishes email confirmation and magic-link sign-in, then sends the visitor on to `next`. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.redirect(new URL("/", origin));

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let error: unknown = new Error("missing code");
  if (code) ({ error } = await supabase.auth.exchangeCodeForSession(code));
  else if (tokenHash && type) ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));

  if (error) return NextResponse.redirect(new URL("/auth/sign-in?error=link", origin));
  return NextResponse.redirect(new URL(next, origin));
}
