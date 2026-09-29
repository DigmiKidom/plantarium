import { getSiteUrl } from "@/lib/site-url";

/** Absolute URL on this site (search engines need absolute URLs in structured data and sitemaps). */
export const absoluteUrl = (path: string) => new URL(path, getSiteUrl()).toString();

/**
 * JSON for <script type="application/ld+json">. Escapes "<", ">", "&" and line separators so text from the
 * database (e.g. "</script><script>…") can never close the script tag.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
