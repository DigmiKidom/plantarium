"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { canWrite, isBannedNow, type Role } from "@/lib/auth/roles";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, hasR2, presignImageUpload } from "@/lib/r2";
import { MAX_CONTENT_BYTES, firstImage, isOwnImageUrl, readingMinutes, sanitizeContent } from "./content";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function currentWriter() {
  if (!hasSupabase()) return null;
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, banned_until")
    .eq("id", data.user.id)
    .single<{ role: Role; banned_until: string | null }>();
  if (!profile || !canWrite(profile.role) || isBannedNow(profile.banned_until)) return null;
  return { supabase, userId: data.user.id };
}

const NO_PERMISSION = { ok: false as const, error: "אין לך הרשאת כתיבה במגזין" };

const articleInput = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().max(140, { error: "כותרת עד 140 תווים" }),
  excerpt: z.string().trim().max(300, { error: "תקציר עד 300 תווים" }),
  tags: z.array(z.string().trim().min(1).max(30)).max(8, { error: "עד 8 תגיות" }),
  coverUrl: z.string().nullable(),
  content: z.unknown(),
  submit: z.boolean(),
});
export type ArticleInput = z.input<typeof articleInput>;

/** Save a draft, or save and send to admin review (submit = true). */
export async function saveArticle(input: ArticleInput): Promise<Result<{ id: string; status: string }>> {
  const res = await saveArticleInner(input);
  // Every outcome goes to the server log, so a failed save is never silent.
  console.log(
    JSON.stringify({ at: "magazine.save", ok: res.ok, submit: input.submit, ...(res.ok ? { id: res.id, status: res.status } : { error: res.error }) }),
  );
  return res;
}

async function saveArticleInner(input: ArticleInput): Promise<Result<{ id: string; status: string }>> {
  const writer = await currentWriter();
  if (!writer) return NO_PERMISSION;

  const parsed = articleInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path[0] === "tags" ? "תגית ארוכה מדי (עד 30 תווים לתגית)" : issue?.message;
    return { ok: false, error: where ?? "נתונים לא תקינים" };
  }
  const v = parsed.data;

  let content;
  try {
    content = sanitizeContent(v.content);
  } catch {
    return { ok: false, error: "תוכן המאמר לא תקין. רעננו את הדף ונסו שוב" };
  }
  if (JSON.stringify(content).length > MAX_CONTENT_BYTES) return { ok: false, error: "המאמר ארוך מדי" };
  if (v.submit) {
    if (v.title.length < 5) return { ok: false, error: "לפני שליחה לאישור: כותרת של לפחות 5 תווים" };
    if (!content.content?.length) return { ok: false, error: "לפני שליחה לאישור: צריך תוכן למאמר" };
  }
  const coverUrl = v.coverUrl && isOwnImageUrl(v.coverUrl) ? v.coverUrl : firstImage(content);

  const row = {
    title: v.title,
    excerpt: v.excerpt,
    tags: [...new Set(v.tags)],
    cover_url: coverUrl,
    content,
    reading_minutes: readingMinutes(content),
    status: v.submit ? "pending" : "draft",
  };

  const { supabase } = writer;
  const res = v.id
    ? await supabase.from("magazine_articles").update(row).eq("id", v.id).select("id, status").maybeSingle()
    : await supabase.from("magazine_articles").insert(row).select("id, status").single();

  if (res.error || !res.data) {
    console.error(JSON.stringify({ at: "magazine.save.db", code: res.error?.code, error: res.error?.message, details: res.error?.details }));
    return { ok: false, error: `השמירה נכשלה: ${res.error?.message ?? "לא נמצא מאמר"}` };
  }

  revalidatePath("/magazine", "layout");
  return { ok: true, id: res.data.id as string, status: res.data.status as string };
}

export async function deleteArticle(id: string): Promise<Result> {
  const writer = await currentWriter();
  if (!writer) return NO_PERMISSION;
  const { data, error } = await writer.supabase
    .from("magazine_articles")
    .delete()
    .eq("id", id)
    .eq("author_id", writer.userId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "אפשר למחוק רק מאמר שלא פורסם" };
  revalidatePath("/magazine", "layout");
  return { ok: true };
}

const uploadInput = z.object({ contentType: z.enum(IMAGE_TYPES), size: z.number().int().positive().max(MAX_IMAGE_BYTES) });

/** Signed upload URL for an image in an article. Path always starts with the writer's id. */
export async function createArticleImageUpload(
  input: z.input<typeof uploadInput>,
): Promise<Result<{ uploadUrl: string; publicUrl: string }>> {
  const writer = await currentWriter();
  if (!writer) return NO_PERMISSION;
  if (!hasR2()) return { ok: false, error: "העלאת תמונות לא מוגדרת (R2)" };
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "תמונה בפורמט JPG, PNG או WebP, עד 10MB" };

  const ext = parsed.data.contentType.split("/")[1].replace("jpeg", "jpg");
  const key = `magazine/${writer.userId}/${randomUUID()}.${ext}`;
  const { uploadUrl, publicUrl } = await presignImageUpload(key, parsed.data.contentType, parsed.data.size);
  return { ok: true, uploadUrl, publicUrl };
}
