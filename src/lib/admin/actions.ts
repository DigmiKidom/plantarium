"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { createAdminClient, hasAdmin } from "@/lib/supabase/admin";
import { ROLES, isBannedNow, type Role } from "@/lib/auth/roles";
import { BAN_DURATIONS, type BanDuration } from "./bans";

export type AdminResult = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): AdminResult => ({ ok: false, error });

/**
 * Every admin action starts here. Uses the admin's own session, so the database rules
 * (RLS + guard triggers) check every change again – the service key is used only for
 * the two things only Supabase Auth can do: blocking sign-in and deleting a login.
 */
async function adminSession() {
  if (!hasSupabase()) return null;
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: me } = await supabase
    .from("profiles")
    .select("role, banned_until")
    .eq("id", data.user.id)
    .single<{ role: Role; banned_until: string | null }>();
  if (me?.role !== "admin" || isBannedNow(me.banned_until)) return null;
  return { supabase, adminId: data.user.id };
}
type Session = NonNullable<Awaited<ReturnType<typeof adminSession>>>;

async function getTarget(s: Session, userId: string) {
  const { data } = await s.supabase
    .from("profiles")
    .select("id, username, display_name, role")
    .eq("id", userId)
    .maybeSingle<{ id: string; username: string | null; display_name: string; role: Role }>();
  return data;
}
const labelOf = (t: { username: string | null; display_name: string }) => (t.username ? `@${t.username}` : t.display_name);

async function log(s: Session, entry: { action: string; targetId?: string; label?: string; reason?: string | null; meta?: object }) {
  const { error } = await s.supabase.from("admin_actions").insert({
    admin_id: s.adminId,
    target_id: entry.targetId ?? null,
    target_label: entry.label ?? null,
    action: entry.action,
    reason: entry.reason ?? null,
    meta: entry.meta ?? {},
  });
  if (error) console.error(JSON.stringify({ at: "admin.log", error: error.message }));
}

async function closeReports(s: Session, userId: string, status: "actioned" | "dismissed") {
  await s.supabase
    .from("reports")
    .update({ status, handled_by: s.adminId, handled_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "open");
}

const refreshAdmin = () => revalidatePath("/admin", "layout");
const uuid = z.uuid();

// ---------- roles ----------
export async function setRole(userId: string, role: Role): Promise<AdminResult> {
  const s = await adminSession();
  if (!s) return fail("אין הרשאת מנהל");
  if (!uuid.safeParse(userId).success || !ROLES.includes(role)) return fail("נתונים לא תקינים");
  if (userId === s.adminId) return fail("אי אפשר לשנות את התפקיד של עצמך");
  const target = await getTarget(s, userId);
  if (!target) return fail("המשתמש לא נמצא");
  if (target.role === "admin") return fail("אי אפשר לשנות מנהל אחר מהאתר");

  const { data, error } = await s.supabase.from("profiles").update({ role }).eq("id", userId).select("id");
  if (error || !data?.length) return fail("העדכון נכשל");
  await log(s, { action: "set_role", targetId: userId, label: labelOf(target), meta: { from: target.role, to: role } });
  refreshAdmin();
  return { ok: true, message: "התפקיד עודכן" };
}

// ---------- bans ----------
const banInput = z.object({
  userId: z.uuid(),
  duration: z.enum(Object.keys(BAN_DURATIONS) as [BanDuration, ...BanDuration[]]),
  reason: z.string().trim().min(3, { error: "נא לכתוב סיבה" }).max(500),
});

export async function banUser(raw: z.input<typeof banInput>): Promise<AdminResult> {
  const s = await adminSession();
  if (!s) return fail("אין הרשאת מנהל");
  const parsed = banInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "נתונים לא תקינים");
  const { userId, duration, reason } = parsed.data;
  if (userId === s.adminId) return fail("אי אפשר להשעות את עצמך");
  const target = await getTarget(s, userId);
  if (!target) return fail("המשתמש לא נמצא");
  if (target.role === "admin") return fail("אי אפשר להשעות מנהל");

  const hours = BAN_DURATIONS[duration];
  const until = hours === null ? "infinity" : new Date(Date.now() + hours * 3_600_000).toISOString();

  // 1. Profile (checked by the database rules)
  const { data, error } = await s.supabase
    .from("profiles")
    .update({ banned_until: until, ban_reason: reason })
    .eq("id", userId)
    .select("id");
  if (error || !data?.length) return fail("ההשעיה נכשלה");

  // 2. Block sign-in and token refresh in Supabase Auth
  let authBlocked = false;
  if (hasAdmin()) {
    const { error: authError } = await createAdminClient().auth.admin.updateUserById(userId, {
      ban_duration: hours === null ? "876000h" : `${hours}h`,
    });
    authBlocked = !authError;
    if (authError) console.error(JSON.stringify({ at: "admin.ban.auth", error: authError.message }));
  }

  await closeReports(s, userId, "actioned");
  await log(s, { action: "ban", targetId: userId, label: labelOf(target), reason, meta: { duration, until, authBlocked } });
  refreshAdmin();
  return authBlocked
    ? { ok: true, message: "החשבון הושעה" }
    : { ok: true, message: "החשבון הושעה באתר, אבל חסימת ההתחברות נכשלה (בדקו SUPABASE_SERVICE_ROLE_KEY)" };
}

export async function unbanUser(userId: string): Promise<AdminResult> {
  const s = await adminSession();
  if (!s) return fail("אין הרשאת מנהל");
  if (!uuid.safeParse(userId).success) return fail("נתונים לא תקינים");
  const target = await getTarget(s, userId);
  if (!target) return fail("המשתמש לא נמצא");

  const { data, error } = await s.supabase
    .from("profiles")
    .update({ banned_until: null, ban_reason: null })
    .eq("id", userId)
    .select("id");
  if (error || !data?.length) return fail("ביטול ההשעיה נכשל");
  if (hasAdmin()) await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: "none" });

  await log(s, { action: "unban", targetId: userId, label: labelOf(target) });
  refreshAdmin();
  return { ok: true, message: "ההשעיה בוטלה" };
}

// ---------- delete ----------
const deleteInput = z.object({ userId: z.uuid(), confirm: z.string(), reason: z.string().trim().min(3, { error: "נא לכתוב סיבה" }).max(500) });

/** Deletes the login and, through the database's cascades, the profile, plants, articles and reports. */
export async function deleteUser(raw: z.input<typeof deleteInput>): Promise<AdminResult> {
  const s = await adminSession();
  if (!s) return fail("אין הרשאת מנהל");
  if (!hasAdmin()) return fail("חסר SUPABASE_SERVICE_ROLE_KEY");
  const parsed = deleteInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "נתונים לא תקינים");
  const { userId, confirm, reason } = parsed.data;
  if (userId === s.adminId) return fail("אי אפשר למחוק את עצמך");
  const target = await getTarget(s, userId);
  if (!target) return fail("המשתמש לא נמצא");
  if (target.role === "admin") return fail("אי אפשר למחוק מנהל");
  if (confirm.trim().toLowerCase() !== (target.username ?? "").toLowerCase()) return fail("שם המשתמש לאישור לא תואם");

  await log(s, { action: "delete_user", targetId: userId, label: labelOf(target), reason });
  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) {
    console.error(JSON.stringify({ at: "admin.delete", error: error.message }));
    return fail("המחיקה נכשלה");
  }
  refreshAdmin();
  revalidatePath("/magazine", "layout");
  return { ok: true, message: "החשבון נמחק" };
}

// ---------- reports ----------
export async function dismissReports(userId: string): Promise<AdminResult> {
  const s = await adminSession();
  if (!s) return fail("אין הרשאת מנהל");
  if (!uuid.safeParse(userId).success) return fail("נתונים לא תקינים");
  const target = await getTarget(s, userId);
  await closeReports(s, userId, "dismissed");
  await log(s, { action: "dismiss_reports", targetId: userId, label: target ? labelOf(target) : undefined });
  refreshAdmin();
  return { ok: true, message: "הדיווחים נסגרו" };
}

// ---------- magazine review ----------
async function reviewArticle(
  id: string,
  status: "published" | "rejected",
  action: "approve_article" | "reject_article" | "unpublish_article",
  note?: string,
): Promise<AdminResult> {
  const s = await adminSession();
  if (!s) return fail("אין הרשאת מנהל");
  if (!uuid.safeParse(id).success) return fail("נתונים לא תקינים");
  if (status === "rejected" && (!note || note.trim().length < 3)) return fail("נא לכתוב לכותב/ת מה לתקן");

  const { data, error } = await s.supabase
    .from("magazine_articles")
    .update({ status, review_note: status === "rejected" ? note!.trim().slice(0, 1000) : null })
    .eq("id", id)
    .select("id, title, slug")
    .maybeSingle();
  if (error || !data) return fail("העדכון נכשל");

  await log(s, { action, targetId: id, label: data.title, reason: note ?? null });
  refreshAdmin();
  revalidatePath("/magazine", "layout");
  revalidatePath("/");
  if (data.slug) revalidatePath(`/magazine/${data.slug}`);
  return { ok: true, message: action === "approve_article" ? "המאמר פורסם" : "המאמר הוחזר לכותב/ת" };
}

export async function approveArticle(id: string) {
  return reviewArticle(id, "published", "approve_article");
}
export async function rejectArticle(id: string, note: string) {
  return reviewArticle(id, "rejected", "reject_article", note);
}
export async function unpublishArticle(id: string, note: string) {
  return reviewArticle(id, "rejected", "unpublish_article", note);
}
