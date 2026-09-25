import "server-only";
import { createUserClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/roles";

export async function adminCounts() {
  const supabase = await createUserClient();
  const head = { count: "exact" as const, head: true };
  const [reports, pending, users, banned] = await Promise.all([
    supabase.from("reports").select("id", head).eq("status", "open"),
    supabase.from("magazine_articles").select("id", head).eq("status", "pending"),
    supabase.from("profiles").select("id", head),
    supabase.from("profiles").select("id", head).gt("banned_until", new Date().toISOString()),
  ]);
  return {
    reports: reports.count ?? 0,
    pending: pending.count ?? 0,
    users: users.count ?? 0,
    banned: banned.count ?? 0,
  };
}

type ProfileRef = { id: string; username: string | null; display_name: string; role: Role; banned_until: string | null };
export type OpenReport = {
  id: string;
  reason: string;
  details: string | null;
  created_at: string;
  reporter: { username: string | null; display_name: string } | null;
  target: ProfileRef | null;
};

/** Open reports about accounts, grouped by the reported account (most reported first). */
export async function openReportsByUser() {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from("reports")
    .select(
      "id, reason, details, created_at, reporter:profiles!reports_reporter_id_fkey(username, display_name), target:profiles!reports_user_id_fkey(id, username, display_name, role, banned_until)",
    )
    .eq("status", "open")
    .not("user_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(500)
    .returns<OpenReport[]>();

  const groups = new Map<string, { target: ProfileRef; reports: OpenReport[] }>();
  for (const r of data ?? []) {
    if (!r.target) continue;
    const g = groups.get(r.target.id) ?? { target: r.target, reports: [] };
    g.reports.push(r);
    groups.set(r.target.id, g);
  }
  return [...groups.values()].sort((a, b) => b.reports.length - a.reports.length);
}

export type AdminUserRow = ProfileRef & { ban_reason: string | null; created_at: string };

/** Characters that have meaning in PostgREST filters are removed from the search text. */
const cleanQuery = (q: string) => q.replace(/[,()*%\\:."']/g, " ").trim().slice(0, 40);

export async function searchUsers({ q, role, banned }: { q?: string; role?: Role; banned?: boolean }) {
  const supabase = await createUserClient();
  let query = supabase
    .from("profiles")
    .select("id, username, display_name, role, banned_until, ban_reason, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const text = q ? cleanQuery(q) : "";
  if (text) query = query.or(`username.ilike.*${text}*,display_name.ilike.*${text}*`);
  if (role) query = query.eq("role", role);
  if (banned) query = query.gt("banned_until", new Date().toISOString());
  const { data } = await query.returns<AdminUserRow[]>();
  return data ?? [];
}

export type LogRow = {
  id: number;
  action: string;
  target_label: string | null;
  reason: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  admin: { username: string | null; display_name: string } | null;
};

export async function recentLog(limit = 100) {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from("admin_actions")
    .select("id, action, target_label, reason, meta, created_at, admin:profiles!admin_actions_admin_id_fkey(username, display_name)")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<LogRow[]>();
  return data ?? [];
}
