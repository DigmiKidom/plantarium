"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Heart, HelpCircle, MessageCircle, Trash2 } from "lucide-react";
import { deletePost, setPostLike } from "@/lib/feed/actions";
import { POST_TYPE_HE, timeAgo, type FeedPost } from "@/lib/feed/types";
import { Avatar } from "@/components/auth/me";
import { ReportButton } from "@/components/reports/report-button";
import { PostComments } from "./post-comments";
import { cn } from "@/lib/cn";

export type Viewer = { id: string; isAdmin: boolean } | null;

function Photos({ photos }: { photos: string[] }) {
  if (!photos.length) return null;
  return (
    <div className={cn("grid gap-1 overflow-hidden rounded-2xl", photos.length > 1 && "grid-cols-2")}>
      {photos.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          className={cn(
            "w-full bg-surface-2 object-cover",
            photos.length === 1 ? "max-h-[32rem]" : "aspect-square",
            photos.length === 3 && i === 0 && "col-span-2 aspect-[2/1]",
          )}
        />
      ))}
    </div>
  );
}

export function PostCard({
  post,
  viewer,
  openComments = false,
  onDeleted,
}: {
  post: FeedPost;
  viewer: Viewer;
  openComments?: boolean;
  onDeleted?: (id: string) => void;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.like_count);
  const [comments, setComments] = useState(post.comment_count);
  const [showComments, setShowComments] = useState(openComments);
  const [, startTransition] = useTransition();
  const name = post.author?.display_name ?? "משתמש";
  const isOwn = viewer?.id === post.author_id;

  const toggleLike = () => {
    if (!viewer) return router.push("/login");
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    startTransition(async () => {
      const res = await setPostLike(post.id, next);
      if (!res.ok) {
        setLiked(!next);
        setLikes((n) => n + (next ? -1 : 1));
      }
    });
  };

  const remove = () => {
    if (!confirm("למחוק את הפוסט?")) return;
    startTransition(async () => {
      const res = await deletePost(post.id);
      if (res.ok) {
        if (onDeleted) onDeleted(post.id);
        else router.push("/");
      }
      else alert(res.error);
    });
  };

  return (
    <article className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 md:p-5">
      <header className="flex items-center gap-3">
        <Avatar name={name} url={post.author?.avatar_url} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2">
            {post.author?.username ? (
              <Link href={`/u/${post.author.username}`} className="font-semibold hover:text-primary">
                {name}
              </Link>
            ) : (
              <span className="font-semibold">{name}</span>
            )}
            {post.type === "question" && (
              <span className="flex items-center gap-1 rounded-full bg-water-soft px-2 py-0.5 text-xs font-medium">
                <HelpCircle className="size-3.5" aria-hidden />
                {POST_TYPE_HE.question}
              </span>
            )}
          </p>
          <Link href={`/p/${post.id}`} className="text-xs text-muted hover:underline">
            <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
          </Link>
        </div>
        {viewer && (isOwn || viewer.isAdmin) && (
          <button type="button" onClick={remove} aria-label="מחיקת הפוסט" title="מחיקה" className="rounded-full p-2 text-muted hover:bg-accent-soft hover:text-accent">
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
        {viewer && !isOwn && <ReportButton userId={post.author_id} postId={post.id} name={name} compact />}
      </header>

      {post.body && <p className="whitespace-pre-line break-words leading-relaxed">{post.body}</p>}
      <Photos photos={post.photos} />

      {post.species && (
        <Link
          href={`/magazine/plants/${post.species.slug}`}
          className="flex w-fit items-center gap-1.5 rounded-full bg-leaf-soft px-3 py-1 text-sm text-primary-strong hover:underline"
        >
          <BookOpen className="size-4" aria-hidden />
          {post.species.common_name_he}
        </Link>
      )}

      <footer className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition", liked ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2")}
        >
          <Heart className={cn("size-5", liked && "fill-current")} aria-hidden />
          <span className="tabular-nums">{likes}</span>
          <span className="sr-only">לייקים</span>
        </button>
        <button
          type="button"
          onClick={() => setShowComments((s) => !s)}
          aria-expanded={showComments}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2"
        >
          <MessageCircle className="size-5" aria-hidden />
          <span className="tabular-nums">{comments}</span>
          <span className="sr-only">תגובות</span>
        </button>
      </footer>

      {showComments && <PostComments postId={post.id} viewer={viewer} onCountChange={(d) => setComments((n) => n + d)} />}
    </article>
  );
}
