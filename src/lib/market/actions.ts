"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { isBannedNow, type Role } from "@/lib/auth/roles";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, hasR2, presignImageUpload } from "@/lib/r2";
import { SIZES } from "./types";

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

const imagesBase = () => (process.env.NEXT_PUBLIC_IMAGES_URL ?? "").replace(/\/+$/, "");

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
    speciesSlug: z.string().regex(/^[a-z0-9-]+$/, { error: "נא לבחור צמח מהרשימה" }),
    price: z.number({ error: "נא להזין מחיר" }).int({ error: "מחיר בשקלים שלמים" }).min(0, { error: "מחיר לא תקין" }).max(100000, { error: "מחיר עד ₪100,000" }),
    size: z.enum(SIZES).nullable(),
    city: z.string().trim().max(60, { error: "עיר עד 60 תווים" }),
    description: z.string().trim().max(2000, { error: "תיאור עד 2000 תווים" }),
    photos: z.array(z.string()).min(1, { error: "צריך לפחות תמונה אחת" }).max(6, { error: "עד 6 תמונות" }),
    phone: z.string().trim().refine((v) => v === "" || phoneRe.test(v), { error: "מספר טלפון לא תקין" }),
    whatsapp: z.boolean(),
    email: z.string().trim().refine((v) => v === "" || z.email().safeParse(v).success, { error: "אימייל לא תקין" }),
  })
  .refine((v) => v.phone !== "" || v.email !== "", { path: ["phone"], error: "צריך לפחות דרך יצירת קשר אחת: טלפון או אימייל" });
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

  const { data: sp } = await s.supabase.from("species").select("id").eq("slug", v.speciesSlug).maybeSingle();
  if (!sp) return { ok: false, error: "הצמח לא נמצא במאגר" };

  const row = {
    species_id: sp.id as string,
    price: v.price,
    size: v.size,
    city: v.city || null,
    description: v.description || null,
    photos: v.photos,
  };
  const contact = { phone: v.phone || null, whatsapp: v.phone ? v.whatsapp : false, email: v.email || null };

  if (v.id) {
    const { data, error } = await s.supabase.from("market_listings").update(row).eq("id", v.id).eq("seller_id", s.userId).select("id").maybeSingle();
    if (error || !data) return { ok: false, error: "השמירה נכשלה" };
    const { error: cErr } = await s.supabase.from("market_listing_contacts").upsert({ listing_id: v.id, ...contact });
    if (cErr) return { ok: false, error: "פרטי הקשר לא נשמרו" };
    refresh(v.id);
    return { ok: true, id: v.id };
  }

  const { data, error } = await s.supabase.from("market_listings").insert(row).select("id").single();
  if (error?.code === "P0413") {
    return { ok: false, error: "הגעת למכסת המודעות הפעילות בחשבון. סמנו מודעה כ״נמכר״ או מחקו אחת כדי לפרסם חדשה" };
  }
  if (error || !data) {
    console.error(JSON.stringify({ at: "market.save", code: error?.code, error: error?.message }));
    return { ok: false, error: "הפרסום נכשל. נסו שוב" };
  }
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
    .select("id, seller_id, species:species(common_name_he)")
    .maybeSingle<{ id: string; seller_id: string; species: { common_name_he: string } | null }>();
  if (error || !data) return { ok: false, error: "ההסרה נכשלה" };

  await s.supabase
    .from("reports")
    .update({ status: "actioned", handled_by: s.userId, handled_at: new Date().toISOString() })
    .eq("listing_id", id)
    .eq("status", "open");
  await s.supabase.from("admin_actions").insert({
    admin_id: s.userId,
    target_id: data.seller_id,
    target_label: `מודעה: ${data.species?.common_name_he ?? id}`,
    action: "remove_listing",
    reason: note,
    meta: { listing_id: id },
  });
  refresh(id);
  revalidatePath("/admin", "layout");
  return { ok: true };
}
