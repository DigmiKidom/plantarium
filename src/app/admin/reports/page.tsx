import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { openReportsByUser } from "@/lib/admin/queries";
import { REPORT_REASON_HE, type ReportReason } from "@/lib/reports/reasons";
import { ROLE_HE, isBannedNow } from "@/lib/auth/roles";
import { UserManage } from "@/components/admin/user-manage";
import { formatDateTime } from "@/lib/dates";

export const metadata = { title: "דיווחים" };

export default async function AdminReportsPage() {
  const { user } = await requireRole(["admin"], "/admin/reports");
  const groups = await openReportsByUser();

  if (groups.length === 0) {
    return <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">אין דיווחים פתוחים</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {groups.map(({ target, reports }) => {
        const banned = isBannedNow(target.banned_until);
        return (
          <li key={target.id} className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-5">
            <header className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1">
                {target.username ? (
                  <Link href={`/u/${target.username}`} className="text-lg font-bold hover:text-primary">
                    {target.display_name}
                  </Link>
                ) : (
                  <span className="text-lg font-bold">{target.display_name}</span>
                )}
                {target.username && <span className="ltr ms-2 text-sm text-muted">@{target.username}</span>}
              </span>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs">{ROLE_HE[target.role]}</span>
              {banned && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent">מושעה</span>}
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">{reports.length} דיווחים</span>
            </header>
            <ul className="flex flex-col gap-2 text-sm">
              {reports.map((r) => (
                <li key={r.id} className="rounded-2xl bg-surface-2 px-4 py-3">
                  <p>
                    <span className="font-semibold">{REPORT_REASON_HE[r.reason as ReportReason] ?? r.reason}</span>
                    <span className="text-muted">
                      {" "}
                      · {r.reporter?.username ? `@${r.reporter.username}` : r.reporter?.display_name} · {formatDateTime(r.created_at)}
                    </span>
                  </p>
                  {r.details && <p className="mt-1 whitespace-pre-line">{r.details}</p>}
                </li>
              ))}
            </ul>
            <UserManage
              isSelf={target.id === user.id}
              withDismiss
              user={{ id: target.id, username: target.username, display_name: target.display_name, role: target.role, banned }}
            />
          </li>
        );
      })}
    </ul>
  );
}
