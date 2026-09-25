import type { Metadata } from "next";
import Link from "next/link";
import { PenLine, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { canWrite } from "@/lib/auth/roles";
import { listMine } from "@/lib/magazine/queries";
import { STATUS_HE, type ArticleStatus } from "@/lib/magazine/types";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "אזור הכותבים", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<ArticleStatus, string> = {
  draft: "bg-surface-2 text-muted",
  pending: "bg-water-soft text-text",
  published: "bg-leaf-soft text-primary-strong",
  rejected: "bg-sun-soft text-text",
};

export default async function WriterHome() {
  const { user, profile } = await requireUser("/magazine/write");

  if (!canWrite(profile?.role)) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-leaf-soft text-primary">
          <PenLine className="size-8" aria-hidden />
        </span>
        <h1 className="text-2xl font-bold">רוצים לכתוב במגזין?</h1>
        <p className="text-muted">
          כתיבה במגזין פתוחה לכותבים שקיבלו הרשאה מצוות האתר. אם יש לכם ידע ורצון לשתף – פנו אלינו ונשמח להוסיף אתכם.
        </p>
        <Link href="/magazine" className="text-primary underline">
          חזרה למגזין
        </Link>
      </div>
    );
  }

  const articles = await listMine(user.id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">המאמרים שלי</h1>
          <p className="text-muted">כל מאמר עובר אישור מנהל לפני שהוא מתפרסם.</p>
        </div>
        <Link
          href="/magazine/write/new"
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary hover:bg-primary-strong"
        >
          <Plus className="size-5" aria-hidden />
          מאמר חדש
        </Link>
      </header>

      {articles.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">עוד לא כתבת מאמרים.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-3xl border border-border bg-surface">
          {articles.map((a) => (
            <li key={a.id}>
              <Link href={`/magazine/write/${a.id}`} className="flex items-center gap-4 p-4 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{a.title || "ללא כותרת"}</span>
                  <span className="text-xs text-muted">עודכן {formatDateTime(a.updated_at)}</span>
                </span>
                <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-medium", STATUS_STYLE[a.status])}>
                  {STATUS_HE[a.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
