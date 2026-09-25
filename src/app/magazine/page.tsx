import type { Metadata } from "next";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { listPublished } from "@/lib/magazine/queries";
import { ArticleCard, ArticleStats } from "@/components/magazine/article-card";

export const metadata: Metadata = {
  title: "מגזין",
  description: "כתבות, מדריכים וסיפורים מעולם הצמחים – נכתבים על ידי כותבי פלנטריום.",
};
export const revalidate = 300; // new approvals also refresh it right away

export default async function MagazinePage() {
  const articles = await listPublished({ limit: 48 });
  const [lead, ...rest] = articles;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">מגזין</h1>
          <p className="mt-1 text-muted">כתבות, מדריכים וסיפורים מעולם הצמחים</p>
        </div>
        <Link href="/magazine/write" className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2">
          <PenLine className="size-4" aria-hidden />
          אזור הכותבים
        </Link>
      </header>

      {!lead ? (
        <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">עוד אין כתבות במגזין. בקרוב!</p>
      ) : (
        <>
          <Link
            href={`/magazine/${lead.slug}`}
            className="group grid overflow-hidden rounded-3xl border border-border bg-surface shadow-sm md:grid-cols-2"
          >
            {lead.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lead.cover_url} alt="" className="aspect-[16/10] h-full w-full object-cover" />
            ) : (
              <span className="aspect-[16/10] bg-leaf-soft" aria-hidden />
            )}
            <div className="flex flex-col justify-center gap-3 p-6 md:p-10">
              <span className="text-sm font-semibold text-primary">הכתבה האחרונה</span>
              <h2 className="text-2xl font-bold leading-tight group-hover:text-primary md:text-3xl">{lead.title}</h2>
              {lead.excerpt && <p className="text-muted">{lead.excerpt}</p>}
              <p className="text-sm text-muted">
                {lead.author?.display_name} · {lead.reading_minutes} דק׳ קריאה
              </p>
              <ArticleStats article={lead} />
            </div>
          </Link>
          {rest.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
