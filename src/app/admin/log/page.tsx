import { requireRole } from "@/lib/auth/session";
import { recentLog } from "@/lib/admin/queries";
import { ROLE_HE, type Role } from "@/lib/auth/roles";
import { BAN_DURATION_HE, type BanDuration } from "@/lib/admin/bans";
import { formatDateTime } from "@/lib/dates";

export const metadata = { title: "יומן ניהול" };

const ACTION_HE: Record<string, string> = {
  ban: "השעיה",
  unban: "ביטול השעיה",
  delete_user: "מחיקת חשבון",
  set_role: "שינוי תפקיד",
  approve_article: "אישור מאמר",
  reject_article: "החזרת מאמר לתיקון",
  unpublish_article: "הורדת מאמר",
  dismiss_reports: "סגירת דיווחים",
  delete_comment: "מחיקת תגובה",
};

function detail(action: string, meta: Record<string, unknown>) {
  if (action === "set_role") return `${ROLE_HE[meta.from as Role] ?? meta.from} ← ${ROLE_HE[meta.to as Role] ?? meta.to}`;
  if (action === "ban") return BAN_DURATION_HE[meta.duration as BanDuration] ?? "";
  return "";
}

export default async function AdminLogPage() {
  await requireRole(["admin"], "/admin/log");
  const rows = await recentLog();
  if (rows.length === 0) return <p className="p-8 text-center text-muted">עוד אין פעולות ביומן</p>;

  return (
    <ul className="flex flex-col divide-y divide-border rounded-3xl border border-border bg-surface text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-col gap-0.5 p-4">
          <p>
            <span className="font-semibold">{ACTION_HE[r.action] ?? r.action}</span>
            {r.target_label && <span> · {r.target_label}</span>}
            {detail(r.action, r.meta) && <span className="text-muted"> · {detail(r.action, r.meta)}</span>}
          </p>
          {r.reason && <p className="whitespace-pre-line text-muted">{r.reason}</p>}
          <p className="text-xs text-muted">
            {r.admin?.username ? `@${r.admin.username}` : r.admin?.display_name ?? "—"} · {formatDateTime(r.created_at)}
          </p>
        </li>
      ))}
    </ul>
  );
}
