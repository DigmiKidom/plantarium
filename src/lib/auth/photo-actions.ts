"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, hasR2, presignImageUpload } from "@/lib/r2";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
export type PhotoKind = "avatar" | "cover";

async function me() {
  if (!hasSupabase()) return null;
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, userId: data.user.id } : null;
}
const imagesBase = () => (process.env.NEXT_PUBLIC_IMAGES_URL ?? "").replace(/\/+$/, "");

const uploadInput = z.object({ contentType: z.enum(IMAGE_TYPES), size: z.number().int().positive().max(MAX_IMAGE_BYTES) });

/** Signed upload for a profile photo; bind the kind: createProfilePhotoUpload.bind(null, "avatar"). */
export async function createProfilePhotoUpload(
  kind: PhotoKind,
  input: z.input<typeof uploadInput>,
): Promise<Result<{ uploadUrl: string; publicUrl: string }>> {
  const m = await me();
  if (!m) return { ok: false, error: "צריך להתחבר" };
  if (!hasR2()) return { ok: false, error: "העלאת תמונות לא מוגדרת (R2)" };
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success || !["avatar", "cover"].includes(kind)) return { ok: false, error: "תמונה בפורמט JPG, PNG או WebP, עד 10MB" };
  const ext = parsed.data.contentType.split("/")[1].replace("jpeg", "jpg");
  const { uploadUrl, publicUrl } = await presignImageUpload(`profiles/${m.userId}/${kind}-${randomUUID()}.${ext}`, parsed.data.contentType, parsed.data.size);
  return { ok: true, uploadUrl, publicUrl };
}

/** Set (or remove with null) the profile or cover photo. */
export async function setProfilePhoto(kind: PhotoKind, url: string | null): Promise<Result> {
  const m = await me();
  if (!m) return { ok: false, error: "צריך להתחבר" };
  if (!["avatar", "cover"].includes(kind)) return { ok: false, error: "סוג תמונה לא תקין" };
  if (url !== null && (!imagesBase() || !url.startsWith(`${imagesBase()}/profiles/${m.userId}/`) || url.includes(".."))) {
    return { ok: false, error: "התמונה לא תקינה. העלו אותה מחדש" };
  }
  const column = kind === "avatar" ? "avatar_url" : "cover_url";
  const { data, error } = await m.supabase.from("profiles").update({ [column]: url }).eq("id", m.userId).select("username").maybeSingle();
  if (error || !data) {
    console.error(JSON.stringify({ at: "profile.setPhoto", error: error?.message }));
    return { ok: false, error: error?.code === "42703" ? "צריך להריץ npm run db:push (עדכון 0014)" : "השמירה נכשלה" };
  }
  if (data.username) revalidatePath(`/u/${data.username}`);
  revalidatePath("/profile");
  revalidatePath("/");
  return { ok: true };
}
