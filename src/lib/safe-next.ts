/**
 * Only allow redirects to a path on this site. A `next` value like "//evil.com", "/\\evil.com" or
 * "https://evil.com" would turn the sign-in page into an open redirect.
 */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  // control characters and encoded slashes/backslashes at the start can also confuse browsers
  if (/[\u0000-\u001f]/.test(next) || /^\/(%2f|%5c)/i.test(next)) return fallback;
  try {
    const url = new URL(next, "https://placeholder.invalid");
    if (url.origin !== "https://placeholder.invalid") return fallback;
  } catch {
    return fallback;
  }
  return next;
}
