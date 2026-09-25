import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { canWrite } from "@/lib/auth/roles";
import { EMPTY_DOC } from "@/lib/magazine/content";
import { ArticleEditor } from "@/components/magazine/article-editor";

export const metadata: Metadata = { title: "מאמר חדש", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const { profile } = await requireUser("/magazine/write/new");
  if (!canWrite(profile?.role)) redirect("/magazine/write");

  return (
    <div className="mx-auto max-w-3xl">
      <ArticleEditor
        initial={{ title: "", excerpt: "", tags: [], coverUrl: null, content: EMPTY_DOC, status: "draft", reviewNote: null }}
      />
    </div>
  );
}
