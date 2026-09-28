import type { Category } from "@/lib/species/types";

export const SIZES = ["small", "medium", "large", "xl"] as const;
export type Size = (typeof SIZES)[number];
export const SIZE_HE: Record<Size, string> = {
  small: "קטן (עד 30 ס״מ)",
  medium: "בינוני (30–80 ס״מ)",
  large: "גדול (80–150 ס״מ)",
  xl: "ענק (מעל 150 ס״מ)",
};
export const SIZE_SHORT_HE: Record<Size, string> = { small: "קטן", medium: "בינוני", large: "גדול", xl: "ענק" };

/** Marketplace classes = species categories, in browsing order, with market-friendly names. */
export const MARKET_CATEGORIES: { key: Category; he: string; hint: string }[] = [
  { key: "houseplant", he: "צמחי בית", hint: "מונסטרה, פוטוס, פיקוס…" },
  { key: "garden", he: "צמחי גינה ועצים", hint: "שיחים, מטפסים, עצי נוי" },
  { key: "fruit_tree", he: "עצי פרי", hint: "לימון, זית, תאנה…" },
  { key: "succulent", he: "סוקולנטים וקקטוסים", hint: "אלוורה, קקטוסים, אצבעות" },
  { key: "herb", he: "תבלינים", hint: "נענע, בזיליקום, רוזמרין…" },
  { key: "vegetable", he: "ירקות", hint: "שתילי עגבניות, פלפלים…" },
];
export const isMarketCategory = (v: string): v is Category => MARKET_CATEGORIES.some((c) => c.key === v);
export const categoryHe = (c: Category) => MARKET_CATEGORIES.find((x) => x.key === c)?.he ?? c;

export type ListingStatus = "active" | "sold" | "removed";
export const LISTING_STATUS_HE: Record<ListingStatus, string> = { active: "פעילה", sold: "נמכר", removed: "הוסרה ע״י האתר" };

export type ListingRow = {
  id: string;
  price: number;
  size: Size | null;
  city: string | null;
  description: string | null;
  photos: string[];
  status: ListingStatus;
  removed_reason: string | null;
  created_at: string;
  sold_at: string | null;
  seller_id: string;
  category: Category;
  /** Free-text plant name when the plant isn't in our database ("אחר"). */
  other_species: string | null;
  species: { slug: string; common_name_he: string; scientific_name: string; category: Category } | null;
  seller: { username: string | null; display_name: string } | null;
};

export const LISTING_COLUMNS =
  "id, price, size, city, description, photos, status, removed_reason, created_at, sold_at, seller_id, category, other_species, species:species(slug, common_name_he, scientific_name, category), seller:profiles!market_listings_seller_id_fkey(username, display_name)";

export type Contact = { phone: string | null; whatsapp: boolean };

/** The plant's display name: the database species, or what the seller typed. */
export const listingName = (l: Pick<ListingRow, "species" | "other_species">) => l.species?.common_name_he ?? l.other_species ?? "צמח";

/** Value of the "other" choice in the species picker and in ?species= on category pages. */
export const OTHER_SPECIES = "other";

export const SORTS = { new: "חדש ביותר", price_asc: "מחיר: מהנמוך", price_desc: "מחיר: מהגבוה" } as const;
export type Sort = keyof typeof SORTS;

export const formatPrice = (p: number) => (p === 0 ? "למסירה" : `₪${p.toLocaleString("he-IL")}`);

/** 050-123-4567 → 972501234567 for wa.me links */
export function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
}

export const FREE_LISTING_LIMIT = 5;
