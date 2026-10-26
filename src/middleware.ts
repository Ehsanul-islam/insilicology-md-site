import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "./lib/supabase/env";
import { updateSession } from "./lib/supabase/middleware";

/**
 * Guards /dashboard and /admin. Administrators are checked against profiles.role in the database; the
 * admin pages and their actions re-check it, so this is a convenience redirect, not the only control.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isSupabaseConfigured()) {
    // no backend yet: the protected areas simply do not exist
    return NextResponse.rewrite(new URL("/not-found", request.url), { status: 404 });
  }

  const { response, user, supabase } = await updateSession(request);

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && supabase) {
    const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin" || profile?.status !== "active") {
      return NextResponse.rewrite(new URL("/not-found", request.url), { status: 404 });
    }
  }
  return response;
}

export const config = { matcher: ["/dashboard/:path*", "/admin/:path*"] };
