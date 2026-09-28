import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getPost } from "@/lib/feed/queries";
import { createUserClient } from "@/lib/supabase/server";
import { PostCard } from "@/components/feed/post-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const res = await getPost((await params).id);
  if (!res) return { title: "לא נמצא" };
  const { post } = res;
  return {
    title: `${post.author?.display_name ?? "פוסט"} בחממה`,
    description: post.body?.slice(0, 160) ?? undefined,
    openGraph: { images: post.photos.slice(0, 1) },
  };
}

export default async function PostPage({ params }: PageProps<"/p/[id]">) {
  const res = await getPost((await params).id);
  if (!res) notFound();
  const { post, viewerId } = res;
  let isAdmin = false;
  if (viewerId) {
    const { data } = await (await createUserClient()).from("profiles").select("role").eq("id", viewerId).maybeSingle();
    isAdmin = data?.role === "admin";
  }
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link href="/" className="flex w-fit items-center gap-1 text-sm text-muted hover:text-primary">
        <ArrowRight className="size-4" aria-hidden />
        לחממה
      </Link>
      <PostCard post={post} viewer={viewerId ? { id: viewerId, isAdmin } : null} openComments />
    </div>
  );
}
