"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { isBannedNow } from "@/lib/auth/roles";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, hasR2, presignImageUpload } from "@/lib/r2";
import { DIRECTIONS, OTHER_PLANT, PLACE_KINDS, PLANT_MEDIUMS } from "./types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function me() {
  if (!hasSupabase()) return null;
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await supabase.from("profiles").select("banned_until").eq("id", data.user.id).single<{ banned_until: string | null }>();
  if (p && isBannedNow(p.banned_until)) return null;
  return { supabase, userId: data.user.id };
}
const SIGN_IN = { ok: false as const, error: "צריך להתחבר" };
const imagesBase = () => (process.env.NEXT_PUBLIC_IMAGES_URL ?? "").replace(/\/+$/, "");

function dbError(error: { code?: string; message: string }, at: string): { ok: false; error: string } {
  console.error(JSON.stringify({ at, code: error.code, error: error.message }));
  if (error.code === "42703" || error.code === "PGRST204") return { ok: false, error: "מסד הנתונים לא מעודכן – צריך להריץ npm run db:push" };
  if (error.code === "42501") return { ok: false, error: "אין הרשאה" };
  if (error.code === "23514") return { ok: false, error: "אחד הערכים לא תקין" };
  return { ok: false, error: "משהו השתבש, נסו שוב" };
}

const refresh = (id?: string) => {
  revalidatePath("/plants", "layout");
  if (id) revalidatePath(`/plants/${id}`);
};

// ---------- places ----------
const placeInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "נא לתת שם למקום").max(40, "עד 40 תווים"),
  kind: z.enum(PLACE_KINDS),
  direction: z.enum(DIRECTIONS).nullable(),
});

export async function savePlace(input: z.input<typeof placeInput>): Promise<Result<{ id: string }>> {
  const m = await me();
  if (!m) return SIGN_IN;
  const parsed = placeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "פרטים לא תקינים" };
  const { id, ...row } = parsed.data;
  const q = id
    ? m.supabase.from("locations").update({ ...row, is_outdoor: row.kind !== "room" }).eq("id", id).eq("user_id", m.userId).select("id").single()
    : m.supabase.from("locations").insert({ ...row, is_outdoor: row.kind !== "room" }).select("id").single();
  const { data, error } = await q;
  if (error) return dbError(error, "plants.savePlace");
  refresh();
  return { ok: true, id: data.id as string };
}

export async function deletePlace(id: string): Promise<Result> {
  const m = await me();
  if (!m) return SIGN_IN;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "מקום לא נמצא" };
  const { error } = await m.supabase.from("locations").delete().eq("id", id).eq("user_id", m.userId);
  if (error) return dbError(error, "plants.deletePlace");
  refresh();
  return { ok: true };
}

// ---------- photos ----------
const uploadInput = z.object({ contentType: z.enum(IMAGE_TYPES), size: z.number().int().positive().max(MAX_IMAGE_BYTES) });

export async function createPlantImageUpload(input: z.input<typeof uploadInput>): Promise<Result<{ uploadUrl: string; publicUrl: string }>> {
  const m = await me();
  if (!m) return SIGN_IN;
  if (!hasR2()) return { ok: false, error: "העלאת תמונות לא מוגדרת (R2)" };
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "תמונה בפורמט JPG, PNG או WebP, עד 10MB" };
  const ext = parsed.data.contentType.split("/")[1].replace("jpeg", "jpg");
  const { uploadUrl, publicUrl } = await presignImageUpload(`plants/${m.userId}/${randomUUID()}.${ext}`, parsed.data.contentType, parsed.data.size);
  return { ok: true, uploadUrl, publicUrl };
}

// ---------- plants ----------
const LAST_WATERED = { today: 0, yesterday: 1, days3: 3, week: 7 } as const;

const plantInput = z
  .object({
    id: z.uuid().optional(),
    speciesSlug: z.string().min(1, "נא לבחור צמח"),
    otherName: z.string().trim().max(80).optional().default(""),
    nickname: z.string().trim().max(60, "כינוי עד 60 תווים").optional().default(""),
    placeId: z.uuid().nullable(),
    potCm: z.number().min(3).max(300).nullable(),
    medium: z.enum(PLANT_MEDIUMS).nullable(),
    acquiredOn: z.iso.date().nullable(),
    waterEveryDays: z.number().int().min(1).max(90).nullable(),
    notes: z.string().trim().max(2000).optional().default(""),
    photoUrl: z.string().max(500).nullable(),
    lastWatered: z.enum(["today", "yesterday", "days3", "week", "unknown"]).optional(),
  })
  .refine((v) => v.speciesSlug !== OTHER_PLANT || v.otherName.length >= 2, { message: "נא לכתוב את שם הצמח", path: ["otherName"] });

export async function savePlant(input: z.input<typeof plantInput>): Promise<Result<{ id: string }>> {
  const m = await me();
  if (!m) return SIGN_IN;
  const parsed = plantInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "פרטים לא תקינים" };
  const v = parsed.data;

  if (v.photoUrl && (!imagesBase() || !v.photoUrl.startsWith(`${imagesBase()}/plants/${m.userId}/`) || v.photoUrl.includes(".."))) {
    return { ok: false, error: "תמונה לא תקינה" };
  }

  let speciesId: string | null = null;
  if (v.speciesSlug !== OTHER_PLANT) {
    const { data: sp } = await m.supabase.from("species").select("id").eq("slug", v.speciesSlug).maybeSingle<{ id: string }>();
    if (!sp) return { ok: false, error: "הצמח לא נמצא במאגר" };
    speciesId = sp.id;
  }

  const row = {
    species_id: speciesId,
    species_name: speciesId ? null : v.otherName,
    nickname: v.nickname || null,
    location_id: v.placeId,
    pot_diameter_cm: v.potCm,
    medium: v.medium,
    acquired_on: v.acquiredOn,
    water_every_days: v.waterEveryDays,
    notes: v.notes || null,
    photo_url: v.photoUrl,
  };

  if (v.id) {
    const { error } = await m.supabase.from("user_plants").update(row).eq("id", v.id).eq("user_id", m.userId);
    if (error) return dbError(error, "plants.update");
    refresh(v.id);
    return { ok: true, id: v.id };
  }

  const { count } = await m.supabase.from("user_plants").select("id", { count: "exact", head: true }).eq("user_id", m.userId);
  if ((count ?? 0) >= 500) return { ok: false, error: "הגעת למקסימום של 500 צמחים" };

  const { data, error } = await m.supabase.from("user_plants").insert(row).select("id").single<{ id: string }>();
  if (error) return dbError(error, "plants.create");

  if (v.lastWatered && v.lastWatered !== "unknown") {
    const at = new Date(Date.now() - LAST_WATERED[v.lastWatered] * 86_400_000).toISOString();
    await m.supabase.from("care_events").insert({ user_plant_id: data.id, type: "water", occurred_at: at });
  }
  refresh();
  return { ok: true, id: data.id };
}

export async function deletePlant(id: string): Promise<Result> {
  const m = await me();
  if (!m) return SIGN_IN;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "צמח לא נמצא" };
  const { error } = await m.supabase.from("user_plants").delete().eq("id", id).eq("user_id", m.userId);
  if (error) return dbError(error, "plants.delete");
  refresh();
  return { ok: true };
}

// ---------- care log ----------
const careInput = z.object({
  plantIds: z.array(z.uuid()).min(1).max(200),
  type: z.enum(["water", "fertilize", "mist", "prune", "repot", "rotate", "treat", "note"]),
  note: z.string().trim().max(1000).optional(),
});

/** Logs one care action on one or more plants ("watered them all"). */
export async function logCare(input: z.input<typeof careInput>): Promise<Result<{ ids: string[] }>> {
  const m = await me();
  if (!m) return SIGN_IN;
  const parsed = careInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "פעולה לא תקינה" };
  const { plantIds, type, note } = parsed.data;
  if (type === "note" && !note) return { ok: false, error: "נא לכתוב הערה" };
  const { data, error } = await m.supabase
    .from("care_events")
    .insert(plantIds.map((id) => ({ user_plant_id: id, type, note: note || null, source: plantIds.length > 1 ? "bulk" : "manual" })))
    .select("id");
  if (error) return dbError(error, "plants.logCare");
  refresh(plantIds.length === 1 ? plantIds[0] : undefined);
  return { ok: true, ids: (data ?? []).map((r) => r.id as string) };
}

export async function deleteCareEvents(ids: string[]): Promise<Result> {
  const m = await me();
  if (!m) return SIGN_IN;
  if (!z.array(z.uuid()).min(1).max(200).safeParse(ids).success) return { ok: false, error: "פעולה לא תקינה" };
  const { error } = await m.supabase.from("care_events").delete().in("id", ids).eq("user_id", m.userId);
  if (error) return dbError(error, "plants.deleteCare");
  refresh();
  return { ok: true };
}
