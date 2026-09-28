"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function setFollow(userId: string, follow: boolean): Promise<Result> {
  if (!hasSupabase() || !z.uuid().safeParse(userId).success) return { ok: false, error: "משתמש לא תקין" };
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "צריך להתחבר כדי לעקוב" };
  if (data.user.id === userId) return { ok: false, error: "אי אפשר לעקוב אחרי עצמך" };

  const { error } = follow
    ? await supabase.from("follows").upsert({ follower_id: data.user.id, followee_id: userId }, { ignoreDuplicates: true })
    : await supabase.from("follows").delete().eq("follower_id", data.user.id).eq("followee_id", userId);
  if (error) {
    console.error(JSON.stringify({ at: "follows.set", error: error.message }));
    return { ok: false, error: "הפעולה נכשלה. נסו שוב" };
  }
  revalidatePath("/u", "layout");
  revalidatePath("/profile");
  return { ok: true };
}
