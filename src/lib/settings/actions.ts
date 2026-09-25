"use server";

import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { parseSettings, settingsSchema, type Settings } from "./schema";

/**
 * Saves settings to the signed-in user's profile (merged with what's there).
 * Visitors: nothing to save server-side – the browser cookie is enough.
 */
export async function saveSettings(patch: Partial<Settings>): Promise<{ ok: boolean; saved: "account" | "browser" }> {
  const clean = settingsSchema.partial().safeParse(patch);
  if (!clean.success) return { ok: false, saved: "browser" };
  if (!hasSupabase()) return { ok: true, saved: "browser" };

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: true, saved: "browser" };

  const { data: row } = await supabase.from("profiles").select("settings").eq("id", auth.user.id).single();
  const next = { ...parseSettings(row?.settings), ...clean.data };
  const { error } = await supabase.from("profiles").update({ settings: next }).eq("id", auth.user.id);
  return { ok: !error, saved: "account" };
}
