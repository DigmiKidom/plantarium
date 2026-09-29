import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import seed from "@/data/species.json";
import { matchScore } from "@/lib/search/hebrew";
import { createPublicClient, hasSupabase } from "@/lib/supabase/server";
import type { Species, SpeciesFilters } from "./types";

/**
 * Species data access.
 * - With Supabase env vars set: reads published species from Postgres.
 * - Without them: reads the local seed (src/data/species.json), so the site runs out of the box.
 */

const local = (seed as unknown as { species: Species[] }).species;

function applyFilters(list: Species[], f: SpeciesFilters): Species[] {
  let out = list.filter(
    (s) =>
      (!f.category || s.category === f.category) &&
      (!f.light || s.care.light === f.light) &&
      (!f.difficulty || s.difficulty === f.difficulty) &&
      (!f.petSafe || s.is_toxic_pets === false),
  );

  if (f.q?.trim()) {
    out = out
      .map((s) => ({
        s,
        score: matchScore(f.q!, [
          s.common_name_he,
          ...s.other_names_he,
          s.scientific_name,
          s.common_name_en,
        ]),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.s);
  } else {
    out = [...out].sort((a, b) => a.common_name_he.localeCompare(b.common_name_he, "he"));
  }
  return out;
}

type Row = Omit<Species, "care" | "images"> & {
  species_care: Species["care"] | null;
  species_images: { storage_path: string; alt: string | null; credit: string | null }[] | null;
};

const SELECT =
  "slug, scientific_name, common_name_he, other_names_he, common_name_en, family, category, difficulty, summary_he, native_region_he, growth_rate, max_height_cm, is_toxic_pets, tags, species_care(*), species_images(storage_path, alt, credit)";

function fromRow(r: Row): Species {
  const { species_care, species_images, ...rest } = r;
  return {
    ...rest,
    care: species_care as Species["care"],
    images: (species_images ?? []).map((i) => ({
      url: i.storage_path,
      alt: i.alt ?? rest.common_name_he,
      credit: i.credit ?? undefined,
    })),
  };
}

/**
 * Lists only need the card fields + care numbers (no long care notes), so ~1,100 species stay small.
 * Species pages use getSpecies() for the full record.
 */
const LIST_SELECT =
  "slug, scientific_name, common_name_he, other_names_he, common_name_en, family, category, difficulty, summary_he, native_region_he, growth_rate, max_height_cm, is_toxic_pets, tags, species_care(light, water_interval_min_days, water_interval_max_days, humidity_min, humidity_max, temp_min_c, temp_max_c, fertilize_interval_days, fertilize_season, seasonal), species_images(storage_path, alt, credit)";
const PAGE = 1000; // PostgREST's default max rows per request

async function fetchAllPublished(): Promise<Species[]> {
  const db = createPublicClient();
  const out: Species[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("species")
      .select(LIST_SELECT)
      .not("published_at", "is", null)
      .order("slug")
      .order("sort", { referencedTable: "species_images" })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data as unknown as Row[]).map(fromRow));
    if (!data || data.length < PAGE) return out;
  }
}

// Shared across requests for 5 minutes (edits also refresh it through revalidatePath), and deduped within a request.
const allPublished = cache(
  unstable_cache(fetchAllPublished, ["species-list-v2"], { revalidate: 300 }),
);

export async function listSpecies(filters: SpeciesFilters = {}): Promise<Species[]> {
  if (!hasSupabase()) return applyFilters(local, filters);
  // Filtering is done in JS (~1k rows, cached). Move to the search_species RPC past ~5k species.
  return applyFilters(await allPublished(), filters);
}

export async function getSpecies(slug: string): Promise<Species | null> {
  if (!hasSupabase()) return local.find((s) => s.slug === slug) ?? null;

  const db = createPublicClient();
  const { data, error } = await db
    .from("species")
    .select(SELECT)
    .eq("slug", slug)
    .not("published_at", "is", null)
    .order("sort", { referencedTable: "species_images" })
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as unknown as Row) : null;
}

export async function allSlugs(): Promise<string[]> {
  if (!hasSupabase()) return local.map((s) => s.slug);
  return (await allPublished()).map((s) => s.slug);
}

/** Species sharing the most tags within the same category. */
export async function relatedSpecies(s: Species, limit = 4): Promise<Species[]> {
  const all = await listSpecies({ category: s.category });
  return all
    .filter((o) => o.slug !== s.slug)
    .map((o) => ({ o, n: o.tags.filter((t) => s.tags.includes(t)).length }))
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((x) => x.o);
}
