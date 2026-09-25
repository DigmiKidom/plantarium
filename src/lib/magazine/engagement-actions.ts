"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { isBannedNow, type Role } from "@/lib/auth/roles";

type Result = { ok: true } | { ok: false; error: string };

async function signedIn() {
  if (!hasSupabase()) return null;
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: me } = await supabase
    .from("profiles")
    .select("role, username, banned_until")
    .eq("id", data.user.id)
    .single<{ role: Role; username: string | null; banned_until: string | null }>();
  if (!me || isBannedNow(me.banned_until)) return null;
  return { supabase, userId: data.user.id, role: me.role };
}

/** Counts on the magazine cards (home + /magazine) are cached pages – refresh them. */
function refreshCounts() {
  revalidatePath("/magazine");
  revalidatePath("/");
}

const SIGN_IN = { ok: false as const, error: "צריך להתחבר כדי לעשות את זה" };
const uuid = z.uuid();

export async function setLike(articleId: string, like: boolean): Promise<Result> {
  const s = await signedIn();
  if (!s) return SIGN_IN;
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "מאמר לא תקין" };

  const { error } = like
    ? await s.supabase.from("magazine_likes").upsert({ article_id: articleId, user_id: s.userId }, { ignoreDuplicates: true })
    : await s.supabase.from("magazine_likes").delete().eq("article_id", articleId).eq("user_id", s.userId);
  if (error) {
    console.error(JSON.stringify({ at: "magazine.like", error: error.message }));
    return { ok: false, error: "הלייק לא נשמר. נסו שוב" };
  }
  refreshCounts();
  return { ok: true };
}

const commentInput = z.object({
  articleId: z.uuid(),
  body: z.string().trim().min(1, { error: "התגובה ריקה" }).max(2000, { error: "תגובה עד 2000 תווים" }),
});

export async function addComment(raw: z.input<typeof commentInput>): Promise<Result> {
  const s = await signedIn();
  if (!s) return SIGN_IN;
  const parsed = commentInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "תגובה לא תקינה" };

  const { error } = await s.supabase
    .from("magazine_comments")
    .insert({ article_id: parsed.data.articleId, body: parsed.data.body });
  if (error) {
    if (error.code === "P0429") return { ok: false, error: "יותר מדי תגובות בזמן קצר. נסו שוב בעוד דקה" };
    console.error(JSON.stringify({ at: "magazine.comment", code: error.code, error: error.message }));
    return { ok: false, error: "התגובה לא נשלחה. נסו שוב" };
  }
  refreshCounts();
  return { ok: true };
}

export async function deleteComment(commentId: string): Promise<Result> {
  const s = await signedIn();
  if (!s) return SIGN_IN;
  if (!uuid.safeParse(commentId).success) return { ok: false, error: "תגובה לא תקינה" };

  const { data, error } = await s.supabase
    .from("magazine_comments")
    .delete()
    .eq("id", commentId)
    .select("id, user_id, body, author:profiles!magazine_comments_user_id_fkey(username, display_name)")
    .maybeSingle<{ id: string; user_id: string; body: string; author: { username: string | null; display_name: string } | null }>();
  if (error || !data) return { ok: false, error: "אי אפשר למחוק את התגובה" };

  // An admin removing someone else's comment goes to the admin log
  if (data.user_id !== s.userId && s.role === "admin") {
    await s.supabase.from("admin_actions").insert({
      admin_id: s.userId,
      target_id: data.user_id,
      target_label: data.author?.username ? `@${data.author.username}` : data.author?.display_name ?? null,
      action: "delete_comment",
      reason: data.body.slice(0, 300),
    });
  }
  refreshCounts();
  return { ok: true };
}
