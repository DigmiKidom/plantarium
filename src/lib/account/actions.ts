"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { createAdminClient, hasAdmin } from "@/lib/supabase/admin";
import { deletePrefix, hasR2 } from "@/lib/r2";
import { rateLimit, TOO_MANY } from "@/lib/auth/guard";
import { EXPORT_TABLES, PHOTO_FOLDERS, DELETE_WORD } from "./data";

type Fail = { ok: false; error: string };

async function currentUser() {
  if (!hasSupabase()) return null;
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, user: data.user } : null;
}

/** Everything the signed-in user has in Plantarium, as one JSON file (right of access / data portability). */
export async function exportMyData(): Promise<{ ok: true; json: string; fileName: string } | Fail> {
  const me = await currentUser();
  if (!me) return { ok: false, error: "צריך להתחבר" };
  if (!hasAdmin()) return { ok: false, error: "הייצוא לא זמין כרגע" };
  if (!(await rateLimit(`export:${me.user.id}`, 5, 3600))) return { ok: false, error: TOO_MANY };

  const db = createAdminClient();
  const uid = me.user.id;
  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { id: uid, email: me.user.email, created_at: me.user.created_at, last_sign_in_at: me.user.last_sign_in_at },
  };
  const ids: Record<string, string[]> = {};

  for (const t of EXPORT_TABLES) {
    let q = db.from(t.table).select("*").limit(10000);
    if ("column" in t) q = q.eq(t.column, uid);
    else {
      const parents = ids[t.parent] ?? [];
      if (!parents.length) {
        out[t.table] = [];
        continue;
      }
      q = q.in(t.parentColumn, parents);
    }
    const { data, error } = await q;
    if (error) {
      console.error(JSON.stringify({ at: "account.export", table: t.table, code: error.code, error: error.message }));
      out[t.table] = { error: "לא נקרא" };
      continue;
    }
    out[t.table] = data;
    ids[t.table] = (data ?? []).map((r) => String((r as { id?: unknown }).id));
  }

  const day = new Date().toISOString().slice(0, 10);
  return { ok: true, json: JSON.stringify(out, null, 2), fileName: `plantarium-${day}.json` };
}

/**
 * Deletes the account for good: the sign-in account and, through the database's cascades, every plant, post,
 * listing, comment and setting; then the user's photos in R2. Needs the password again and the confirm word.
 */
export async function deleteMyAccount(input: { password: string; confirm: string }): Promise<Fail> {
  const me = await currentUser();
  if (!me) return { ok: false, error: "צריך להתחבר" };
  if (!hasAdmin()) return { ok: false, error: "מחיקת החשבון לא זמינה כרגע" };
  if (input.confirm.trim() !== DELETE_WORD) return { ok: false, error: `כדי לאשר, כתבו ״${DELETE_WORD}״` };
  if (!(await rateLimit(`delete:${me.user.id}`, 5, 3600))) return { ok: false, error: TOO_MANY };

  const uid = me.user.id;
  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("role").eq("id", uid).maybeSingle();
  if (profile?.role === "admin") {
    return { ok: false, error: "חשבון מנהל לא נמחק מכאן. העבירו את הניהול למשתמש אחר קודם, או פנו למנהל אחר" };
  }

  // Re-check the password with a throwaway client, so the visitor's own session isn't touched.
  if (!me.user.email) return { ok: false, error: "לא ניתן לאמת את החשבון" };
  const check = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: pwError } = await check.auth.signInWithPassword({ email: me.user.email, password: input.password });
  if (pwError) return { ok: false, error: "הסיסמה לא נכונה" };
  await check.auth.signOut({ scope: "local" });

  const { error } = await db.auth.admin.deleteUser(uid);
  if (error) {
    console.error(JSON.stringify({ at: "account.delete", uid, error: error.message }));
    return { ok: false, error: "המחיקה נכשלה. נסו שוב מאוחר יותר" };
  }
  console.log(JSON.stringify({ at: "account.deleted", uid }));

  // Photos: after the account is gone. A failure here only leaves files nobody can see (logged for cleanup).
  if (hasR2()) {
    for (const folder of PHOTO_FOLDERS) {
      try {
        await deletePrefix(`${folder}/${uid}/`);
      } catch (e) {
        console.error(JSON.stringify({ at: "account.delete.photos", uid, folder, error: e instanceof Error ? e.message : String(e) }));
      }
    }
  }

  await me.supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/?account=deleted");
}
