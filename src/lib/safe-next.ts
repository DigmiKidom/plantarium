/**
 * Where to go after login/signup: only a path on this site, never another site.
 * Blocks "//evil.com", "/\evil.com", control characters and anything that resolves to another origin.
 */
export function safeNext(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\") || /[\u0000-\u001f\u007f]/.test(s)) return "/";
  try {
    const base = "https://plantarium.invalid";
    const url = new URL(s, base);
    if (url.origin !== base) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
