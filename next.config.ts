import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/** Origin of the Supabase project, so the browser may call its API and load its storage images. */
function supabaseOrigin() {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  } catch {
    return "";
  }
}

/**
 * Content-Security-Policy. Next.js emits inline bootstrap scripts, so script-src needs 'unsafe-inline'
 * (a nonce-based policy would make every page dynamic and uncacheable). Everything else is locked to this
 * site, Supabase and, if the contact form uses it, Cloudflare Turnstile. Skipped in development, where
 * Next needs eval for hot reloading.
 */
function contentSecurityPolicy() {
  const supabase = supabaseOrigin();
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${supabase}`.trim(),
    "frame-src https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    // review notifications link to /dashboard/records/<id>; the editor lives under /simulations
    return [{ source: "/dashboard/records/:id", destination: "/dashboard/simulations/:id", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...(isProd ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy() }] : []),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default config;
