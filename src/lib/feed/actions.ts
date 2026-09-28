"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { isBannedNow, type Role } from "@/lib/auth/roles";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, hasR2, presignImageUpload } from "@/lib/r2";
import { getFeed } from "./queries";
import { MAX_POST_CHARS, MAX_POST_PHOTOS, imagesBase, type FeedTab } from "./types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const SIGN_IN = { ok: false as const, error: "צריך להתחבר כדי לעשות את זה" };

async function member() {
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

const refresh = () => revalidatePath("/");
const uuid = z.uuid();

// ---------- photos ----------
const uploadInput = z.object({ contentType: z.enum(IMAGE_TYPES), size: z.number().int().positive().max(MAX_IMAGE_BYTES) });
export async function createFeedImageUpload(input: z.input<typeof uploadInput>): Promise<Result<{ uploadUrl: string; publicUrl: string }>> {
  const m = await member();
  if (!m) return SIGN_IN;
  if (!hasR2()) return { ok: false, error: "העלאת תמונות לא מוגדרת (R2)" };
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "תמונה בפורמט JPG, PNG או WebP, עד 10MB" };
  const ext = parsed.data.contentType.split("/")[1].replace("jpeg", "jpg");
  const { uploadUrl, publicUrl } = await presignImageUpload(`feed/${m.userId}/${randomUUID()}.${ext}`, parsed.data.contentType, parsed.data.size);
  return { ok: true, uploadUrl, publicUrl };
}

// ---------- posts ----------
const postInput = z
  .object({
    body: z.string().trim().max(MAX_POST_CHARS, { error: `עד ${MAX_POST_CHARS} תווים` }),
    type: z.enum(["post", "question"]),
    speciesSlug: z.string().regex(/^[a-z0-9-]*$/),
    photos: z.array(z.string()).max(MAX_POST_PHOTOS, { error: `עד ${MAX_POST_PHOTOS} תמונות` }),
  })
  .refine((v) => v.body.length > 0 || v.photos.length > 0, { error: "כתבו משהו או הוסיפו תמונה" });

export async function createPost(raw: z.input<typeof postInput>): Promise<Result<{ id: string }>> {
  const m = await member();
  if (!m) return SIGN_IN;
  const parsed = postInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "פוסט לא תקין" };
  const v = parsed.data;

  const prefix = `${imagesBase()}/feed/${m.userId}/`;
  if (v.photos.some((p) => !imagesBase() || !p.startsWith(prefix) || p.includes(".."))) {
    return { ok: false, error: "אחת התמונות לא תקינה. העלו אותה מחדש" };
  }

  let speciesId: string | null = null;
  if (v.speciesSlug) {
    const { data } = await m.supabase.from("species").select("id").eq("slug", v.speciesSlug).maybeSingle();
    speciesId = (data?.id as string) ?? null;
  }

  const { data: post, error } = await m.supabase
    .from("posts")
    .insert({ body: v.body || null, type: v.type, species_id: speciesId })
    .select("id")
    .single();
  if (error?.code === "P0429") return { ok: false, error: "יותר מדי פוסטים בזמן קצר. נסו שוב בעוד כמה דקות" };
  if (error || !post) {
    console.error(JSON.stringify({ at: "feed.createPost", code: error?.code, error: error?.message }));
    return { ok: false, error: "הפרסום נכשל. נסו שוב" };
  }

  if (v.photos.length) {
    const base = imagesBase() + "/";
    const { error: mErr } = await m.supabase
      .from("post_media")
      .insert(v.photos.map((url, sort) => ({ post_id: post.id, storage_path: url.slice(base.length), sort })));
    if (mErr) {
      await m.supabase.from("posts").delete().eq("id", post.id);
      return { ok: false, error: "התמונות לא נשמרו. נסו שוב" };
    }
  }
  refresh();
  return { ok: true, id: post.id as string };
}

export async function deletePost(id: string): Promise<Result> {
  const m = await member();
  if (!m) return SIGN_IN;
  if (!uuid.safeParse(id).success) return { ok: false, error: "פוסט לא תקין" };
  const { data, error } = await m.supabase
    .from("posts")
    .delete()
    .eq("id", id)
    .select("id, author_id, body, author:profiles!posts_author_id_fkey(username, display_name)")
    .maybeSingle<{ id: string; author_id: string; body: string | null; author: { username: string | null; display_name: string } | null }>();
  if (error || !data) return { ok: false, error: "אי אפשר למחוק את הפוסט" };
  if (data.author_id !== m.userId && m.role === "admin") {
    await m.supabase.from("admin_actions").insert({
      admin_id: m.userId,
      target_id: data.author_id,
      target_label: data.author?.username ? `@${data.author.username}` : (data.author?.display_name ?? null),
      action: "delete_post",
      reason: data.body?.slice(0, 300) ?? null,
    });
  }
  refresh();
  return { ok: true };
}

export async function setPostLike(id: string, like: boolean): Promise<Result> {
  const m = await member();
  if (!m) return SIGN_IN;
  if (!uuid.safeParse(id).success) return { ok: false, error: "פוסט לא תקין" };
  const { error } = like
    ? await m.supabase.from("reactions").upsert({ post_id: id, user_id: m.userId }, { ignoreDuplicates: true })
    : await m.supabase.from("reactions").delete().eq("post_id", id).eq("user_id", m.userId);
  if (error) return { ok: false, error: "הלייק לא נשמר" };
  return { ok: true };
}

// ---------- comments ----------
const commentInput = z.object({ postId: z.uuid(), body: z.string().trim().min(1, { error: "התגובה ריקה" }).max(2000) });
export async function addPostComment(raw: z.input<typeof commentInput>): Promise<Result> {
  const m = await member();
  if (!m) return SIGN_IN;
  const parsed = commentInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "תגובה לא תקינה" };
  const { error } = await m.supabase.from("comments").insert({ post_id: parsed.data.postId, body: parsed.data.body });
  if (error?.code === "P0429") return { ok: false, error: "יותר מדי תגובות בזמן קצר. נסו שוב בעוד דקה" };
  if (error) return { ok: false, error: "התגובה לא נשלחה" };
  return { ok: true };
}

export async function deletePostComment(id: string): Promise<Result> {
  const m = await member();
  if (!m) return SIGN_IN;
  const { data, error } = await m.supabase.from("comments").delete().eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "אי אפשר למחוק את התגובה" };
  return { ok: true };
}

// ---------- paging ----------
export async function loadMorePosts(tab: FeedTab, before: string, authorId?: string) {
  if (!["all", "following"].includes(tab) || Number.isNaN(Date.parse(before))) return { posts: [], hasMore: false };
  if (authorId && !uuid.safeParse(authorId).success) return { posts: [], hasMore: false };
  const { posts, hasMore } = await getFeed({ tab, before, authorId });
  return { posts, hasMore };
}
