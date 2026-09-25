import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { getPublishedBySlug } from "@/lib/magazine/queries";
import { ArticleBody } from "@/components/magazine/article-body";
import { formatDate } from "@/lib/dates";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/magazine/[slug]">): Promise<Metadata> {
  const article = await getPublishedBySlug((await params).slug);
  if (!article) return { title: "לא נמצא" };
  return {
    title: article.title,
    description: article.excerpt || undefined,
    openGraph: { type: "article", images: article.cover_url ? [article.cover_url] : undefined },
  };
}

export default async function MagazineArticlePage({ params }: PageProps<"/magazine/[slug]">) {
  const article = await getPublishedBySlug((await params).slug);
  if (!article) notFound();

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/magazine" className="flex w-fit items-center gap-1 text-sm text-muted hover:text-primary">
        <ArrowRight className="size-4" aria-hidden />
        למגזין
      </Link>
      <header className="flex flex-col gap-3">
        {article.tags.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {article.tags.map((t) => (
              <li key={t} className="rounded-full bg-leaf-soft px-3 py-0.5 text-xs font-medium text-primary-strong">
                {t}
              </li>
            ))}
          </ul>
        )}
        <h1 className="text-3xl font-bold leading-tight md:text-5xl">{article.title}</h1>
        {article.excerpt && <p className="text-lg text-muted">{article.excerpt}</p>}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {article.author &&
            (article.author.username ? (
              <Link href={`/u/${article.author.username}`} className="font-semibold text-text hover:text-primary">
                {article.author.display_name}
              </Link>
            ) : (
              <span className="font-semibold text-text">{article.author.display_name}</span>
            ))}
          <span>{formatDate(article.published_at)}</span>
          <span className="flex items-center gap-1">
            <Clock className="size-4" aria-hidden />
            {article.reading_minutes} דק׳ קריאה
          </span>
        </p>
      </header>
      {article.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.cover_url} alt="" className="aspect-[16/9] w-full rounded-3xl object-cover" />
      )}
      <ArticleBody content={article.content} />
    </article>
  );
}
