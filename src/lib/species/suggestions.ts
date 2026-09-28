import "server-only";
import { createUserClient } from "@/lib/supabase/server";
import { EMPTY_SPECIES, type SpeciesFormValues } from "./form-schema";
import type { Category } from "./types";

export type SuggestionStatus = "pending" | "approved" | "rejected";
export const SUGGESTION_STATUS_HE: Record<SuggestionStatus, string> = { pending: "ממתינה לבדיקה", approved: "אושרה ונוספה למאגר", rejected: "לא אושרה" };

export type SuggestionRow = {
  id: string;
  author_id: string;
  common_name_he: string;
  scientific_name: string;
  category: Category;
  data: Partial<SpeciesFormValues>;
  photos: string[];
  status: SuggestionStatus;
  review_note: string | null;
  created_at: string;
  species: { slug: string } | null;
  author: { username: string | null; display_name: string } | null;
};

const COLS =
  "id, author_id, common_name_he, scientific_name, category, data, photos, status, review_note, created_at, species:species(slug), author:profiles!species_suggestions_author_id_fkey(username, display_name)";

export async function mySuggestions(userId: string) {
  const db = await createUserClient();
  const { data } = await db.from("species_suggestions").select(COLS).eq("author_id", userId).order("created_at", { ascending: false }).returns<SuggestionRow[]>();
  return data ?? [];
}

export async function getSuggestion(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const db = await createUserClient();
  const { data } = await db.from("species_suggestions").select(COLS).eq("id", id).maybeSingle<SuggestionRow>();
  return data;
}

export async function pendingSuggestions() {
  const db = await createUserClient();
  const { data } = await db.from("species_suggestions").select(COLS).eq("status", "pending").order("created_at").returns<SuggestionRow[]>();
  return data ?? [];
}

/** Stored suggestion → full form values (missing fields fall back to defaults). */
export function suggestionToForm(s: SuggestionRow): SpeciesFormValues {
  return {
    ...EMPTY_SPECIES,
    ...(s.data ?? {}),
    common_name_he: s.common_name_he,
    scientific_name: s.scientific_name,
    category: s.category,
    photos: s.photos ?? [],
  };
}
