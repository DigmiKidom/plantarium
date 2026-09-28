import "server-only";
import { createPublicClient, createUserClient, hasSupabase } from "@/lib/supabase/server";
import type { Category } from "@/lib/species/types";
import { LISTING_COLUMNS, type Contact, type ListingRow, type Sort } from "./types";

const log = (at: string, error: { message: string } | null) =>
  error && console.error(JSON.stringify({ at, error: error.message }));

export type SpeciesCount = {
  species_id: string;
  slug: string;
  common_name_he: string;
  scientific_name: string;
  category: Category;
  active_count: number;
  min_price: number;
};

/** Active listings per species (only species that have listings). */
export async function speciesCounts(category?: Category): Promise<SpeciesCount[]> {
  if (!hasSupabase()) return [];
  let q = createPublicClient().from("market_species_counts").select("*").order("active_count", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data, error } = await q.returns<SpeciesCount[]>();
  log("market.speciesCounts", error);
  return data ?? [];
}

export async function categoryCounts(): Promise<Partial<Record<Category, number>>> {
  const out: Partial<Record<Category, number>> = {};
  for (const s of await speciesCounts()) out[s.category] = (out[s.category] ?? 0) + s.active_count;
  return out;
}

/** Active listings, newest first by default. */
export async function listListings({
  category,
  speciesSlug,
  sellerId,
  sort = "new",
  limit = 60,
}: { category?: Category; speciesSlug?: string; sellerId?: string; sort?: Sort; limit?: number }) {
  if (!hasSupabase()) return [] as ListingRow[];
  let q = createPublicClient().from("market_listings").select(LISTING_COLUMNS).eq("status", "active").limit(limit);
  if (category) q = q.eq("species.category", category);
  if (speciesSlug) q = q.eq("species.slug", speciesSlug);
  if (sellerId) q = q.eq("seller_id", sellerId);
  q =
    sort === "price_asc"
      ? q.order("price", { ascending: true })
      : sort === "price_desc"
        ? q.order("price", { ascending: false })
        : q.order("created_at", { ascending: false });
  const { data, error } = await q.returns<ListingRow[]>();
  log("market.listListings", error);
  return data ?? [];
}

/** A listing the viewer may see (active, own, or any for admins), plus contact details if signed in. */
export async function getListing(id: string) {
  if (!hasSupabase() || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createUserClient();
  const [{ data: listing, error }, { data: auth }] = await Promise.all([
    supabase.from("market_listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle<ListingRow>(),
    supabase.auth.getUser(),
  ]);
  log("market.getListing", error);
  if (!listing) return null;

  let contact: Contact | null = null;
  if (auth.user) {
    const { data } = await supabase
      .from("market_listing_contacts")
      .select("phone, whatsapp, email")
      .eq("listing_id", id)
      .maybeSingle<Contact>();
    contact = data;
  }
  return { listing, contact, viewerId: auth.user?.id ?? null };
}

export async function myListings(userId: string) {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("market_listings")
    .select(LISTING_COLUMNS)
    .eq("seller_id", userId)
    .order("created_at", { ascending: false })
    .returns<ListingRow[]>();
  log("market.myListings", error);
  return data ?? [];
}

/** How many active listings the user has and may have. */
export async function listingQuota(userId: string) {
  const supabase = await createUserClient();
  const [{ count }, { data: limit }] = await Promise.all([
    supabase.from("market_listings").select("id", { count: "exact", head: true }).eq("seller_id", userId).eq("status", "active"),
    supabase.rpc("listing_limit", { uid: userId }),
  ]);
  return { used: count ?? 0, limit: typeof limit === "number" ? limit : 5 };
}
