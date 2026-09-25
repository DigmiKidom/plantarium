import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getArticleForUser } from "@/lib/magazine/queries";
import { STATUS_HE } from "@/lib/magazine/types";
import { ArticleBody } from "@/components/magazine/article-body";
import { ReviewActions } from "@/components/admin/review-actions";

export const metadata = { title: "בדיקת מאמר" };

export default async function AdminArticlePage({ params }: PageProps<"/admin/articles/[id]">) {
  const { id } = await params;
  await requireRole(["admin"], `/admin/articles/${id}`);
  const article = await getArticleForUser(id);
  if (!article) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/articles" className="flex w-fit items-center gap-1 text-sm text-muted hover:text-primary">
        <ArrowRight className="size-4" aria-hidden />
        לרשימת המאמרים
      </Link>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full bg-surface-2 px-3 py-1 font-medium">{STATUS_HE[article.status]}</span>
        <span className="text-muted">
          מאת{" "}
          {article.author?.username ? (
            <Link href={`/u/${article.author.username}`} className="text-primary underline">
              {article.author.display_name}
            </Link>
          ) : (
            article.author?.display_name
          )}
        </span>
      </div>
      {(article.status === "pending" || article.status === "published") && (
        <ReviewActions id={article.id} published={article.status === "published"} />
      )}
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl border border-border bg-surface p-6 md:p-10">
        <h2 className="text-3xl font-bold leading-tight">{article.title || "ללא כותרת"}</h2>
        {article.excerpt && <p className="text-lg text-muted">{article.excerpt}</p>}
        {article.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.cover_url} alt="" className="aspect-[16/9] w-full rounded-2xl object-cover" />
        )}
        <ArticleBody content={article.content} />
      </article>
    </div>
  );
}
