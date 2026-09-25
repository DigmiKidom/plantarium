import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { listByStatus } from "@/lib/magazine/queries";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/cn";

export const metadata = { title: "מאמרים" };

export default async function AdminArticlesPage({ searchParams }: PageProps<"/admin/articles">) {
  await requireRole(["admin"], "/admin/articles");
  const tab = (await searchParams).tab === "published" ? "published" : "pending";
  const articles = await listByStatus(tab);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(["pending", "published"] as const).map((t) => (
          <Link
            key={t}
            href={t === "pending" ? "/admin/articles" : "/admin/articles?tab=published"}
            className={cn(
              "rounded-full px-4 py-2 text-sm",
              tab === t ? "bg-primary font-semibold text-on-primary" : "border border-border hover:bg-surface-2",
            )}
          >
            {t === "pending" ? "ממתינים לאישור" : "פורסמו"}
          </Link>
        ))}
      </div>
      {articles.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">
          {tab === "pending" ? "אין מאמרים שממתינים לאישור" : "עוד לא פורסמו מאמרים"}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-3xl border border-border bg-surface">
          {articles.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/articles/${a.id}`} className="flex items-center gap-4 p-4 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{a.title || "ללא כותרת"}</span>
                  <span className="text-xs text-muted">
                    {a.author?.display_name} · {tab === "pending" ? `נשלח ${formatDateTime(a.submitted_at)}` : `פורסם ${formatDateTime(a.published_at)}`}
                  </span>
                </span>
                <span className="text-sm text-primary">{tab === "pending" ? "לבדיקה" : "צפייה"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
