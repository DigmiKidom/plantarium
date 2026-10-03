"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { isBannedNow, type Role } from "@/lib/auth/roles";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, hasR2, presignImageUpload } from "@/lib/r2";
import { CONDITIONS, MARKET_CATEGORIES, OTHER_SPECIES, SIZES, isSupplyCategory, type MarketCategory } from "./types";

const CATEGORIES = MARKET_CATEGORIES.map((c) => c.key) as [MarketCategory, ...MarketCategory[]];

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function seller() {
  if (!hasSupabase()) return null;
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: me } = await supabase
    .from("profiles")
    .select("role, banned_until")
    .eq("id", data.user.id)
    .single<{ role: Role; banned_until: string | null }>();
  if (!me || isBannedNow(me.banned_until)) return null;
  return { supabase, userId: data.user.id, role: me.role };
}
const SIGN_IN = { ok: false as const, error: "צריך להתחבר כדי לפרסם בשוק" };

const refresh = (id?: string) => {
  revalidatePath("/market", "layout");
  if (id) revalidatePath(`/market/l/${id}`);
};

const imagesBase = () => (process.env.NEXT_PUBLIC_IMAGES_URL ?? "").trim().replace(/\/+$/, "");

// ---------- photos ----------
const uploadInput = z.object({ contentType: z.enum(IMAGE_TYPES), size: z.number().int().positive().max(MAX_IMAGE_BYTES) });

export async function createListingImageUpload(
  input: z.input<typeof uploadInput>,
): Promise<Result<{ uploadUrl: string; publicUrl: string }>> {
  const s = await seller();
  if (!s) return SIGN_IN;
  if (!hasR2()) return { ok: false, error: "העלאת תמונות לא מוגדרת (R2)" };
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "תמונה בפורמט JPG, PNG או WebP, עד 10MB" };
  const ext = parsed.data.contentType.split("/")[1].replace("jpeg", "jpg");
  const key = `market/${s.userId}/${randomUUID()}.${ext}`;
  const { uploadUrl, publicUrl } = await presignImageUpload(key, parsed.data.contentType, parsed.data.size);
  return { ok: true, uploadUrl, publicUrl };
}

// ---------- create / edit ----------
const phoneRe = /^\+?[0-9][0-9 -]{6,18}$/;
const listingInput = z
  .object({
    id: z.uuid().optional(),
    category: z.enum(CATEGORIES, { error: "נא לבחור קטגוריה" }),
    speciesSlug: z.string().regex(/^[a-z0-9-]+$/, { error: "נא לבחור צמח מהרשימה, או ״אחר״" }),
    otherName: z.string().trim().max(80, { error: "שם הצמח עד 80 תווים" }),
    price: z.number({ error: "נא להזין מחיר" }).int({ error: "מחיר בשקלים שלמים" }).min(0, { error: "מחיר לא תקין" }).max(100000, { error: "מחיר עד ₪100,000" }),
    size: z.enum(SIZES).nullable(),
    condition: z.enum(CONDITIONS).nullable().optional(),
    city: z.string().trim().max(60, { error: "עיר עד 60 תווים" }),
    description: z.string().trim().max(2000, { error: "תיאור עד 2000 תווים" }),
    photos: z.array(z.string()).min(1, { error: "צריך לפחות תמונה אחת" }).max(6, { error: "עד 6 תמונות" }),
    phone: z.string().trim().min(1, { error: "נא להזין מספר טלפון ליצירת קשר" }).regex(phoneRe, { error: "מספר טלפון לא תקין" }),
    whatsapp: z.boolean(),
  })
  .refine((v) => v.speciesSlug !== OTHER_SPECIES || v.otherName.length >= 2, {
    path: ["otherName"],
    error: "כתבו את שם הפריט (לפחות 2 תווים)",
  })
  .refine((v) => !isSupplyCategory(v.category) || v.speciesSlug === OTHER_SPECIES, { path: ["speciesSlug"], error: "פריט ציוד לא מקושר לצמח" });
export type ListingInput = z.input<typeof listingInput>;

export async function saveListing(raw: ListingInput): Promise<Result<{ id: string }>> {
  const s = await seller();
  if (!s) return SIGN_IN;
  const parsed = listingInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  const v = parsed.data;

  // Photos must be ours, uploaded by this seller
  const prefix = `${imagesBase()}/market/${s.userId}/`;
  if (!imagesBase() || v.photos.some((p) => !p.startsWith(prefix) || p.includes(".."))) {
    return { ok: false, error: "אחת התמונות לא תקינה. העלו אותה מחדש" };
  }

  let speciesId: string | null = null;
  if (v.speciesSlug !== OTHER_SPECIES) {
    const { data: sp } = await s.supabase.from("species").select("id").eq("slug", v.speciesSlug).maybeSingle();
    if (!sp) return { ok: false, error: "הצמח לא נמצא במאגר" };
    speciesId = sp.id as string;
  }

  const row = {
    species_id: speciesId,
    other_species: speciesId ? null : v.otherName,
    category: v.category,
    price: v.price,
    size: isSupplyCategory(v.category) ? null : v.size,
    condition: v.condition ?? null,
    city: v.city || null,
    description: v.description || null,
    photos: v.photos,
  };
  const contact = { phone: v.phone, whatsapp: v.whatsapp };

  // Listing + phone in one database transaction (migration 0020).
  const { data: savedId, error } = await s.supabase.rpc("save_listing", {
    p_id: v.id ?? null,
    p_species_id: row.species_id,
    p_other_species: row.other_species,
    p_category: row.category,
    p_price: row.price,
    p_size: row.size,
    p_condition: row.condition,
    p_city: row.city,
    p_description: row.description,
    p_photos: row.photos,
    p_phone: contact.phone,
    p_whatsapp: contact.whatsapp,
  });
  if (error?.code === "PGRST202") return saveListingLegacy(s, v.id, row, contact);
  if (error?.code === "P0413") {
    return { ok: false, error: "הגעת למכסת המודעות הפעילות בחשבון. סמנו מודעה כ״נמכר״ או מחקו אחת כדי לפרסם חדשה" };
  }
  if (error || !savedId) {
    console.error(JSON.stringify({ at: "market.save", code: error?.code, error: error?.message }));
    if (error?.code === "23514") {
      return { ok: false, error: checkMessage(error.message) };
    }
    return { ok: false, error: v.id ? "השמירה נכשלה" : "הפרסום נכשל. נסו שוב" };
  }
  refresh(savedId as string);
  return { ok: true, id: savedId as string };
}

/** Which database rule a listing broke → a message that names the field. */
function checkMessage(message: string): string {
  const rule = /constraint "([^"]+)"/.exec(message)?.[1] ?? "";
  if (rule.includes("phone")) return "מספר הטלפון לא תקין. כתבו רק ספרות, רווח או מקף, למשל 050-1234567";
  if (rule.includes("photos")) return "אחת התמונות לא תקינה. הסירו את התמונות, העלו אותן מחדש ונסו שוב";
  if (rule.includes("price")) return "המחיר לא תקין (בין 0 ל-100,000 ₪)";
  if (rule.includes("other_species")) return "שם הצמח או הפריט צריך להיות 2–80 תווים";
  if (rule.includes("city")) return "שם העיר ארוך מדי (עד 60 תווים)";
  if (rule.includes("description")) return "התיאור ארוך מדי (עד 2000 תווים)";
  if (rule.includes("category") || rule.includes("species")) return "הקטגוריה או הצמח לא תקינים. בחרו שוב";
  if (rule.includes("condition")) return "מצב הפריט לא תקין. בחרו שוב";
  return `אחד הפרטים לא תקין${rule ? ` (${rule})` : ""}`;
}

/** Before migration 0020 is applied: the old two-step save. Remove once every database has 0020. */
async function saveListingLegacy(
  s: NonNullable<Awaited<ReturnType<typeof seller>>>,
  id: string | undefined,
  row: Record<string, unknown>,
  contact: { phone: string; whatsapp: boolean },
): Promise<Result<{ id: string }>> {
  if (id) {
    const { data, error } = await s.supabase.from("market_listings").update(row).eq("id", id).eq("seller_id", s.userId).select("id").maybeSingle();
    if (error || !data) return { ok: false, error: "השמירה נכשלה" };
    const { error: cErr } = await s.supabase.from("market_listing_contacts").upsert({ listing_id: id, ...contact });
    if (cErr) return { ok: false, error: "פרטי הקשר לא נשמרו" };
    refresh(id);
    return { ok: true, id };
  }
  const { data, error } = await s.supabase.from("market_listings").insert(row).select("id").single();
  if (error?.code === "P0413") {
    return { ok: false, error: "הגעת למכסת המודעות הפעילות בחשבון. סמנו מודעה כ״נמכר״ או מחקו אחת כדי לפרסם חדשה" };
  }
  if (error || !data) return { ok: false, error: "הפרסום נכשל. נסו שוב" };
  const { error: cErr } = await s.supabase.from("market_listing_contacts").insert({ listing_id: data.id, ...contact });
  if (cErr) {
    await s.supabase.from("market_listings").delete().eq("id", data.id);
    return { ok: false, error: "פרטי הקשר לא תקינים" };
  }
  refresh(data.id);
  return { ok: true, id: data.id as string };
}

// ---------- status ----------
export async function setListingStatus(id: string, status: "active" | "sold"): Promise<Result> {
  const s = await seller();
  if (!s) return SIGN_IN;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "מודעה לא תקינה" };
  const { data, error } = await s.supabase
    .from("market_listings")
    .update({ status })
    .eq("id", id)
    .eq("seller_id", s.userId)
    .select("id")
    .maybeSingle();
  if (error?.code === "P0413") return { ok: false, error: "הגעת למכסת המודעות הפעילות. סמנו מודעה אחרת כ״נמכר״ קודם" };
  if (error || !data) return { ok: false, error: "העדכון נכשל" };
  refresh(id);
  return { ok: true };
}

export async function deleteListing(id: string): Promise<Result> {
  const s = await seller();
  if (!s) return SIGN_IN;
  const { data, error } = await s.supabase.from("market_listings").delete().eq("id", id).eq("seller_id", s.userId).select("id");
  if (error || !data?.length) return { ok: false, error: "המחיקה נכשלה" };
  refresh(id);
  return { ok: true };
}

// ---------- admin moderation ----------
export async function adminRemoveListing(id: string, reason: string): Promise<Result> {
  const s = await seller();
  if (!s || s.role !== "admin") return { ok: false, error: "אין הרשאת מנהל" };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "מודעה לא תקינה" };
  const note = reason.trim();
  if (note.length < 3) return { ok: false, error: "נא לכתוב סיבה" };

  const { data, error } = await s.supabase
    .from("market_listings")
    .update({ status: "removed", removed_reason: note.slice(0, 500) })
    .eq("id", id)
    .select("id, seller_id, other_species, species:species(common_name_he)")
    .maybeSingle<{ id: string; seller_id: string; other_species: string | null; species: { common_name_he: string } | null }>();
  if (error || !data) return { ok: false, error: "ההסרה נכשלה" };

  await s.supabase
    .from("reports")
    .update({ status: "actioned", handled_by: s.userId, handled_at: new Date().toISOString() })
    .eq("listing_id", id)
    .eq("status", "open");
  await s.supabase.from("admin_actions").insert({
    admin_id: s.userId,
    target_id: data.seller_id,
    target_label: `מודעה: ${data.species?.common_name_he ?? data.other_species ?? id}`,
    action: "remove_listing",
    reason: note,
    meta: { listing_id: id },
  });
  refresh(id);
  revalidatePath("/admin", "layout");
  return { ok: true };
}
