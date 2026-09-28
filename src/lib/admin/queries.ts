import "server-only";
import { createUserClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/roles";

export async function adminCounts() {
  const supabase = await createUserClient();
  const head = { count: "exact" as const, head: true };
  const [reports, pending, users, banned, species] = await Promise.all([
    supabase.from("reports").select("id", head).eq("status", "open"),
    supabase.from("magazine_articles").select("id", head).eq("status", "pending"),
    supabase.from("profiles").select("id", head),
    supabase.from("profiles").select("id", head).gt("banned_until", new Date().toISOString()),
    supabase.from("species_suggestions").select("id", head).eq("status", "pending"),
  ]);
  return {
    reports: reports.count ?? 0,
    pending: pending.count ?? 0,
    users: users.count ?? 0,
    banned: banned.count ?? 0,
    species: species.count ?? 0,
  };
}

type ProfileRef = { id: string; username: string | null; display_name: string; role: Role; plan: "free" | "plus"; banned_until: string | null };
export type OpenReport = {
  id: string;
  reason: string;
  details: string | null;
  listing_id: string | null;
  post_id: string | null;
  created_at: string;
  reporter: { username: string | null; display_name: string } | null;
  target: ProfileRef | null;
};

/** Open reports about accounts, grouped by the reported account (most reported first). */
export async function openReportsByUser() {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, reason, details, listing_id, post_id, created_at, reporter:profiles!reports_reporter_id_fkey(username, display_name), target:profiles!reports_user_id_fkey(id, username, display_name, role, plan, banned_until)",
    )
    .eq("status", "open")
    .not("user_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(500)
    .returns<OpenReport[]>();
  if (error) console.error(JSON.stringify({ at: "admin.openReports", code: error.code, error: error.message }));

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
  const run = (columns: string) => {
    let query = supabase.from("profiles").select(columns).order("created_at", { ascending: false }).limit(50);
    const text = q ? cleanQuery(q) : "";
    if (text) query = query.or(`username.ilike.*${text}*,display_name.ilike.*${text}*`);
    if (role) query = query.eq("role", role);
    if (banned) query = query.gt("banned_until", new Date().toISOString());
    return query.returns<AdminUserRow[]>();
  };

  let { data, error } = await run("id, username, display_name, role, plan, banned_until, ban_reason, created_at");
  if (error) {
    // Usually a database update that wasn't applied yet (e.g. the "plan" column) – still show the users.
    console.error(JSON.stringify({ at: "admin.searchUsers", code: error.code, error: error.message }));
    ({ data, error } = await run("id, username, display_name, role, banned_until, created_at"));
    if (error) console.error(JSON.stringify({ at: "admin.searchUsers.fallback", code: error.code, error: error.message }));
    data = (data ?? []).map((u) => ({ ...u, plan: u.plan ?? "free", ban_reason: u.ban_reason ?? null }));
  }
  return data ?? [];
}

/** Which recent database updates are missing (so the admin panel can say "run npm run db:push"). */
export async function missingDbUpdates() {
  const supabase = await createUserClient();
  const checks: [string, PromiseLike<{ error: { code?: string } | null }>][] = [
    ["0009 שוק ומנויים", supabase.from("profiles").select("plan").limit(1)],
    ["0010 החממה", supabase.from("post_media").select("id").limit(1)],
    ["0011 ״אחר״ בשוק", supabase.from("market_listings").select("other_species").limit(1)],
    ["0012 הצעות צמחים", supabase.from("species_suggestions").select("id").limit(1)],
    ["0015 עורך ראשי", supabase.rpc("is_reviewer")],
  ];
  const results = await Promise.all(checks.map(async ([name, p]) => ((await p).error ? name : null)));
  return results.filter(Boolean) as string[];
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
