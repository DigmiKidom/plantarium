"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { canWrite, isBannedNow, isReviewer, type Role } from "@/lib/auth/roles";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, hasR2, presignImageUpload } from "@/lib/r2";
import { slugFromScientific, speciesFormSchema, type SpeciesFormValues } from "./form-schema";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function session() {
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
type S = NonNullable<Awaited<ReturnType<typeof session>>>;

const NO_ADMIN = { ok: false as const, error: "רק עורכים ראשיים ומנהלים יכולים לעשות את זה" };
const NO_WRITER = { ok: false as const, error: "רק כותבים יכולים להציע צמחים" };
const imagesBase = () => (process.env.NEXT_PUBLIC_IMAGES_URL ?? "").trim().replace(/\/+$/, "");

/** Validates the form; photos must be our uploads (or already on this plant). */
function parse(values: unknown, existing: Set<string> = new Set()): Result<{ v: SpeciesFormValues }> {
  const parsed = speciesFormSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  const v = parsed.data;
  const ours = (p: string) => Boolean(imagesBase()) && p.startsWith(`${imagesBase()}/species/`) && !p.includes("..");
  if (v.photos.some((p) => !ours(p) && !existing.has(p))) {
    return { ok: false, error: "אחת התמונות לא תקינה. העלו אותה מחדש" };
  }
  return { ok: true, v };
}

function speciesRow(v: SpeciesFormValues) {
  return {
    common_name_he: v.common_name_he,
    scientific_name: v.scientific_name,
    other_names_he: v.other_names_he,
    common_name_en: v.common_name_en || null,
    family: v.family || null,
    category: v.category,
    difficulty: v.difficulty,
    summary_he: v.summary_he,
    native_region_he: v.native_region_he || null,
    growth_rate: v.growth_rate,
    max_height_cm: v.max_height_cm,
    is_toxic_pets: v.is_toxic_pets === "unknown" ? null : v.is_toxic_pets === "yes",
    tags: v.tags,
  };
}

const DEFAULT_SEASONAL = { spring: { water_factor: 1 }, summer: { water_factor: 0.8 }, autumn: { water_factor: 1.1 }, winter: { water_factor: 1.6 } };

function careRow(speciesId: string, v: SpeciesFormValues) {
  return {
    species_id: speciesId,
    light: v.light,
    light_notes_he: v.light_notes_he || null,
    water_interval_min_days: v.water_min,
    water_interval_max_days: v.water_max,
    water_notes_he: v.water_notes_he || null,
    humidity_min: v.humidity_min,
    humidity_max: v.humidity_max,
    temp_min_c: v.temp_min,
    temp_max_c: v.temp_max,
    fertilize_interval_days: v.fertilize_days || null,
    fertilize_season: v.fertilize_season,
    medium: v.medium,
    medium_notes_he: v.medium_notes_he || null,
    pruning_he: v.pruning_he || null,
    propagation_he: v.propagation_he || null,
  };
}

/** Make species_images match the given ordered list of URLs. */
/** Makes the plant's photos match `photos` (order = sort). Returns false if any step failed. */
async function syncImages(s: S, speciesId: string, photos: string[], alt: string): Promise<boolean> {
  const { data: current, error } = await s.supabase.from("species_images").select("id, storage_path").eq("species_id", speciesId);
  if (error) return logErr("species.syncImages.read", error);
  const keep = new Set(photos);
  const toDelete = (current ?? []).filter((r) => !keep.has(r.storage_path as string)).map((r) => r.id as string);
  if (toDelete.length) {
    const { error: dErr } = await s.supabase.from("species_images").delete().in("id", toDelete);
    if (dErr) return logErr("species.syncImages.delete", dErr);
  }
  const existing = new Map((current ?? []).map((r) => [r.storage_path as string, r.id as string]));
  for (const [sort, url] of photos.entries()) {
    const id = existing.get(url);
    const { error: wErr } = id
      ? await s.supabase.from("species_images").update({ sort }).eq("id", id)
      : await s.supabase.from("species_images").insert({ species_id: speciesId, storage_path: url, alt, sort });
    if (wErr) return logErr("species.syncImages.write", wErr);
  }
  return true;
}

function logErr(at: string, error: { code?: string; message: string }): false {
  console.error(JSON.stringify({ at, code: error.code, error: error.message }));
  return false;
}

async function log(s: S, action: string, label: string, targetId?: string, reason?: string) {
  await s.supabase.from("admin_actions").insert({ admin_id: s.userId, action, target_label: label, target_id: targetId ?? null, reason: reason ?? null });
}

const refreshPlants = (slug?: string) => {
  revalidatePath("/magazine/plants");
  if (slug) revalidatePath(`/magazine/plants/${slug}`);
  revalidatePath("/market", "layout");
};

// ---------- photos ----------
const uploadInput = z.object({ contentType: z.enum(IMAGE_TYPES), size: z.number().int().positive().max(MAX_IMAGE_BYTES) });
export async function createSpeciesImageUpload(input: z.input<typeof uploadInput>): Promise<Result<{ uploadUrl: string; publicUrl: string }>> {
  const s = await session();
  if (!s || !(s.role === "admin" || canWrite(s.role))) return NO_WRITER;
  if (!hasR2()) return { ok: false, error: "העלאת תמונות לא מוגדרת (R2)" };
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "תמונה בפורמט JPG, PNG או WebP, עד 10MB" };
  const ext = parsed.data.contentType.split("/")[1].replace("jpeg", "jpg");
  const { uploadUrl, publicUrl } = await presignImageUpload(`species/${s.userId}/${randomUUID()}.${ext}`, parsed.data.contentType, parsed.data.size);
  return { ok: true, uploadUrl, publicUrl };
}

// ---------- admin: edit an existing plant ----------
export async function updateSpecies(slug: string, values: SpeciesFormValues): Promise<Result<{ slug: string }>> {
  const s = await session();
  if (!s || !isReviewer(s.role)) return NO_ADMIN;
  const { data: sp } = await s.supabase.from("species").select("id, species_images(storage_path)").eq("slug", slug).maybeSingle();
  if (!sp) return { ok: false, error: "הצמח לא נמצא" };
  const current = new Set(((sp.species_images ?? []) as { storage_path: string }[]).map((i) => i.storage_path));
  const p = parse(values, current);
  if (!p.ok) return p;
  const v = p.v;
  const { error } = await s.supabase.from("species").update(speciesRow(v)).eq("id", sp.id);
  if (error) {
    return { ok: false, error: error.code === "23505" ? "כבר יש צמח עם השם המדעי הזה" : "השמירה נכשלה" };
  }
  const { error: cErr } = await s.supabase.from("species_care").upsert(careRow(sp.id as string, v));
  if (cErr) {
    logErr("species.update.care", cErr);
    return { ok: false, error: "מידע הטיפול לא נשמר. נסו שוב" };
  }
  const imagesOk = await syncImages(s, sp.id as string, v.photos, v.common_name_he);
  await log(s, "edit_species", v.common_name_he, sp.id as string);
  refreshPlants(slug);
  if (!imagesOk) return { ok: false, error: "הפרטים נשמרו, אבל התמונות לא עודכנו. נסו לשמור שוב" };
  return { ok: true, slug };
}

// ---------- authors: suggest a new plant ----------
/** id = null for a new suggestion (bind it: saveSuggestion.bind(null, id)). */
export async function saveSuggestion(id: string | null, values: SpeciesFormValues): Promise<Result<{ id: string }>> {
  const s = await session();
  if (!s || !canWrite(s.role)) return NO_WRITER;
  const p = parse(values);
  if (!p.ok) return p;
  const { common_name_he, scientific_name, category, photos, ...rest } = p.v;

  const { data: dup } = await s.supabase.from("species").select("slug").ilike("scientific_name", scientific_name).maybeSingle();
  if (dup) return { ok: false, error: "הצמח הזה כבר קיים במאגר" };

  const row = { common_name_he, scientific_name, category, photos, data: rest };
  const res = id
    ? await s.supabase.from("species_suggestions").update(row).eq("id", id).eq("author_id", s.userId).select("id").maybeSingle()
    : await s.supabase.from("species_suggestions").insert(row).select("id").single();
  if (res.error?.code === "P0413") return { ok: false, error: "יש לך כבר 20 הצעות שממתינות לבדיקה" };
  if (res.error || !res.data) return { ok: false, error: "השליחה נכשלה" };
  revalidatePath("/magazine/write");
  revalidatePath("/admin", "layout");
  return { ok: true, id: res.data.id as string };
}

export async function deleteSuggestion(id: string): Promise<Result> {
  const s = await session();
  if (!s) return NO_WRITER;
  const { data } = await s.supabase.from("species_suggestions").delete().eq("id", id).select("id");
  if (!data?.length) return { ok: false, error: "אפשר למחוק רק הצעה שממתינה" };
  revalidatePath("/magazine/write");
  return { ok: true };
}

// ---------- admin: review suggestions ----------
export async function approveSuggestion(id: string, values: SpeciesFormValues): Promise<Result<{ slug: string }>> {
  const s = await session();
  if (!s || !isReviewer(s.role)) return NO_ADMIN;
  const p = parse(values);
  if (!p.ok) return p;
  const v = p.v;

  const { data: sug } = await s.supabase.from("species_suggestions").select("id, status").eq("id", id).maybeSingle();
  if (!sug || sug.status !== "pending") return { ok: false, error: "ההצעה לא נמצאה או כבר נבדקה" };

  let slug = slugFromScientific(v.scientific_name);
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return { ok: false, error: "שם מדעי לא תקין (אותיות לטיניות)" };
  const { data: taken } = await s.supabase.from("species").select("id").eq("slug", slug).maybeSingle();
  if (taken) slug = `${slug}-${randomUUID().slice(0, 4)}`;

  const { data: sp, error } = await s.supabase
    .from("species")
    .insert({ ...speciesRow(v), slug, published_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !sp) {
    if (error) logErr("species.approve.insert", error);
    return { ok: false, error: error?.code === "23505" ? "כבר יש צמח עם השם המדעי הזה" : "יצירת הצמח נכשלה. נסו שוב" };
  }
  const { error: cErr } = await s.supabase.from("species_care").insert({ ...careRow(sp.id as string, v), seasonal: DEFAULT_SEASONAL });
  if (cErr) {
    await s.supabase.from("species").delete().eq("id", sp.id);
    logErr("species.approve.care", cErr);
    return { ok: false, error: "מידע הטיפול לא נשמר. נסו שוב" };
  }
  const imagesOk = await syncImages(s, sp.id as string, v.photos, v.common_name_he);
  const { error: sErr } = await s.supabase.from("species_suggestions").update({ status: "approved", species_id: sp.id }).eq("id", id);
  if (sErr) logErr("species.approve.status", sErr);
  await log(s, "approve_species", v.common_name_he, sp.id as string);
  refreshPlants(slug);
  revalidatePath("/admin", "layout");
  if (!imagesOk || sErr) return { ok: false, error: "הצמח נוסף למאגר, אבל חלק מהעדכון נכשל (תמונות או סטטוס ההצעה). בדקו את דף הצמח" };
  return { ok: true, slug };
}

export async function rejectSuggestion(id: string, note: string): Promise<Result> {
  const s = await session();
  if (!s || !isReviewer(s.role)) return NO_ADMIN;
  if (note.trim().length < 3) return { ok: false, error: "נא לכתוב לכותב/ת למה" };
  const { data } = await s.supabase
    .from("species_suggestions")
    .update({ status: "rejected", review_note: note.trim().slice(0, 1000) })
    .eq("id", id)
    .select("common_name_he")
    .maybeSingle();
  if (!data) return { ok: false, error: "העדכון נכשל" };
  await log(s, "reject_species", data.common_name_he as string, undefined, note);
  revalidatePath("/admin", "layout");
  return { ok: true };
}
