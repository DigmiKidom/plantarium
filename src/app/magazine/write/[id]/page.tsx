import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { canWrite } from "@/lib/auth/roles";
import { getArticleForUser } from "@/lib/magazine/queries";
import { ArticleEditor } from "@/components/magazine/article-editor";

export const metadata: Metadata = { title: "עריכת מאמר", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditArticlePage({ params }: PageProps<"/magazine/write/[id]">) {
  const { id } = await params;
  const { user, profile } = await requireUser(`/magazine/write/${id}`);
  if (!canWrite(profile?.role)) redirect("/magazine/write");

  const article = await getArticleForUser(id);
  if (!article || article.author_id !== user.id) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <ArticleEditor
        key={article.id}
        initial={{
          id: article.id,
          slug: article.slug,
          title: article.title,
          excerpt: article.excerpt,
          tags: article.tags,
          coverUrl: article.cover_url,
          content: article.content,
          status: article.status,
          reviewNote: article.review_note,
        }}
      />
    </div>
  );
}
