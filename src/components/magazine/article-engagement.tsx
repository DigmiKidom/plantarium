"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Heart, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { addComment, deleteComment, setLike } from "@/lib/magazine/engagement-actions";
import type { Role } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/cn";

type Comment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  author: { username: string | null; display_name: string } | null;
};
type Viewer = { id: string; role: Role } | null;

const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

type Engagement = { likes: number; liked: boolean; comments: Comment[]; viewer: Viewer };

async function fetchEngagement(articleId: string): Promise<Engagement> {
  const supabase = createBrowserSupabase();
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;

  const [count, mine, list, me] = await Promise.all([
    supabase.from("magazine_likes").select("article_id", { count: "exact", head: true }).eq("article_id", articleId),
    uid
      ? supabase.from("magazine_likes").select("article_id").eq("article_id", articleId).eq("user_id", uid).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("magazine_comments")
      .select("id, body, created_at, user_id, author:profiles!magazine_comments_user_id_fkey(username, display_name)")
      .eq("article_id", articleId)
      .order("created_at", { ascending: true })
      .limit(300)
      .returns<Comment[]>(),
    uid ? supabase.from("profiles").select("role").eq("id", uid).maybeSingle<{ role: Role }>() : Promise.resolve({ data: null }),
  ]);
  return {
    likes: count.count ?? 0,
    liked: Boolean(mine.data),
    comments: list.data ?? [],
    viewer: uid ? { id: uid, role: me.data?.role ?? "user" } : null,
  };
}

/**
 * Likes and comments under an article. Loaded in the browser, so the article itself stays a fast
 * cached page. Reads go straight to Supabase (public data, RLS), writes go through server actions.
 */
export function ArticleEngagement({ articleId, slug }: { articleId: string; slug: string }) {
  const [viewer, setViewer] = useState<Viewer | undefined>(configured ? undefined : null);
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(configured ? null : []);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const apply = useCallback((d: Engagement) => {
    setLikes(d.likes);
    setLiked(d.liked);
    setComments(d.comments);
    setViewer(d.viewer);
  }, []);
  const load = useCallback(() => fetchEngagement(articleId).then(apply), [articleId, apply]);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    fetchEngagement(articleId).then((d) => active && apply(d));
    return () => {
      active = false;
    };
  }, [articleId, apply]);

  const loginHref = `/login?next=${encodeURIComponent(`/magazine/${slug}`)}`;

  const toggleLike = () => {
    if (!viewer) return;
    const next = !liked;
    setLiked(next); // optimistic
    setLikes((n) => n + (next ? 1 : -1));
    startTransition(async () => {
      const res = await setLike(articleId, next);
      if (!res.ok) {
        setLiked(!next);
        setLikes((n) => n + (next ? -1 : 1));
        setError(res.error);
      }
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const res = await addComment({ articleId, body });
      if (!res.ok) return setError(res.error);
      setBody("");
      await load();
    });
  };

  const remove = (id: string) => {
    if (!confirm("למחוק את התגובה?")) return;
    startTransition(async () => {
      const res = await deleteComment(id);
      if (!res.ok) return setError(res.error);
      setComments((list) => list?.filter((c) => c.id !== id) ?? null);
    });
  };

  const count = comments?.length ?? 0;

  return (
    <section aria-labelledby="comments" className="flex flex-col gap-6 border-t border-border pt-6">
      <div className="flex flex-wrap items-center gap-3">
        {viewer ? (
          <button
            type="button"
            onClick={toggleLike}
            aria-pressed={liked}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 font-medium transition",
              liked ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-surface-2",
            )}
          >
            <Heart className={cn("size-5", liked && "fill-current")} aria-hidden />
            {liked ? "אהבתי" : "לייק"}
            <span className="tabular-nums">{likes}</span>
          </button>
        ) : (
          <Link href={loginHref} className="flex items-center gap-2 rounded-full border border-border px-4 py-2 font-medium hover:bg-surface-2">
            <Heart className="size-5" aria-hidden />
            לייק
            <span className="tabular-nums">{likes}</span>
          </Link>
        )}
        <span className="flex items-center gap-2 text-muted">
          <MessageCircle className="size-5" aria-hidden />
          {count} תגובות
        </span>
      </div>

      <h2 id="comments" className="text-xl font-bold">
        תגובות
      </h2>

      {error && (
        <p role="alert" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
          {error}
        </p>
      )}

      {viewer === undefined ? (
        <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
      ) : viewer ? (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="comment-body" className="sr-only">
            תגובה
          </label>
          <textarea
            id="comment-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="מה דעתך על הכתבה?"
            className="w-full rounded-2xl border border-border bg-bg px-4 py-3 outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={pending || !body.trim()}
            className="flex items-center gap-2 self-start rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            פרסום תגובה
          </button>
        </form>
      ) : (
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm">
          <Link href={loginHref} className="font-semibold text-primary underline">
            התחברו
          </Link>{" "}
          כדי להגיב ולעשות לייק.
        </p>
      )}

      {comments === null ? null : comments.length === 0 ? (
        <p className="text-sm text-muted">עוד אין תגובות. אפשר להיות הראשונים.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => {
            const canDelete = viewer && (viewer.id === c.user_id || viewer.role === "admin");
            return (
              <li key={c.id} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-on-primary" aria-hidden>
                  {c.author?.display_name.charAt(0) ?? "?"}
                </span>
                <div className="min-w-0 flex-1 rounded-2xl bg-surface-2 px-4 py-3">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm">
                    {c.author?.username ? (
                      <Link href={`/u/${c.author.username}`} className="font-semibold hover:text-primary">
                        {c.author.display_name}
                      </Link>
                    ) : (
                      <span className="font-semibold">{c.author?.display_name ?? "משתמש"}</span>
                    )}
                    <span className="text-xs text-muted">{formatDateTime(c.created_at)}</span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        aria-label="מחיקת תגובה"
                        title="מחיקה"
                        className="ms-auto rounded-full p-1 text-muted hover:text-accent"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </p>
                  <p className="mt-1 whitespace-pre-line break-words">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
