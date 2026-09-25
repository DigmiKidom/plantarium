import Link from "next/link";
import { Clock, Newspaper } from "lucide-react";
import type { ArticleSummary } from "@/lib/magazine/types";
import { formatDate } from "@/lib/dates";

export function ArticleCard({ article, href }: { article: ArticleSummary; href?: string }) {
  return (
    <Link
      href={href ?? `/magazine/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm transition hover:shadow-md"
    >
      {article.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.cover_url} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
      ) : (
        <span className="grid aspect-[16/9] w-full place-items-center bg-leaf-soft text-primary">
          <Newspaper className="size-10" aria-hidden />
        </span>
      )}
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="text-lg font-bold leading-snug group-hover:text-primary">{article.title || "ללא כותרת"}</h3>
        {article.excerpt && <p className="line-clamp-3 text-sm text-muted">{article.excerpt}</p>}
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted">
          {article.author && <span>{article.author.display_name}</span>}
          {article.published_at && <span>{formatDate(article.published_at)}</span>}
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {article.reading_minutes} דק׳ קריאה
          </span>
        </p>
      </div>
    </Link>
  );
}
