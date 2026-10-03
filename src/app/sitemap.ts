import type { MetadataRoute } from "next";
import { allSlugs } from "@/lib/species/repo";
import { publishedSlugs } from "@/lib/magazine/queries";
import { MARKET_CATEGORIES } from "@/lib/market/types";
import { absoluteUrl } from "@/lib/seo";

// Rebuilt at most once an hour.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A database hiccup (e.g. during a deploy) must not break the build: fall back to the fixed pages,
  // the next hourly refresh fills the rest in.
  const safe = <T,>(p: Promise<T[]>, at: string) =>
    p.catch((e: unknown) => {
      console.error(JSON.stringify({ at, error: e instanceof Error ? e.message : JSON.stringify(e) }));
      return [] as T[];
    });
  const [species, articles] = await Promise.all([safe(allSlugs(), "sitemap.species"), safe(publishedSlugs(), "sitemap.articles")]);
  return [
    { url: absoluteUrl("/"), changeFrequency: "hourly", priority: 1 },
    { url: absoluteUrl("/magazine"), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/magazine/plants"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/market"), changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    ...MARKET_CATEGORIES.map((c) => ({ url: absoluteUrl(`/market/${c.key}`), changeFrequency: "daily" as const, priority: 0.5 })),
    ...species.map((slug) => ({ url: absoluteUrl(`/magazine/plants/${slug}`), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...articles.map((a) => ({ url: absoluteUrl(`/magazine/${a.slug}`), lastModified: a.updated, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
