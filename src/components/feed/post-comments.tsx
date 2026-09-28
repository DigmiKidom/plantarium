"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { addPostComment, deletePostComment } from "@/lib/feed/actions";
import { timeAgo } from "@/lib/feed/types";
import { Avatar } from "@/components/auth/me";

type Comment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: { username: string | null; display_name: string } | null;
};

async function fetchComments(postId: string) {
  const { data } = await createBrowserSupabase()
    .from("comments")
    .select("id, body, created_at, author_id, author:profiles!comments_author_id_fkey(username, display_name)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(200)
    .returns<Comment[]>();
  return data ?? [];
}

export function PostComments({
  postId,
  viewer,
  onCountChange,
}: {
  postId: string;
  viewer: { id: string; isAdmin: boolean } | null;
  onCountChange: (delta: number) => void;
}) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    fetchComments(postId).then((c) => active && setComments(c));
    return () => {
      active = false;
    };
  }, [postId]);
  const reload = useCallback(() => fetchComments(postId).then(setComments), [postId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const res = await addPostComment({ postId, body });
      if (!res.ok) return setError(res.error);
      setBody("");
      onCountChange(1);
      await reload();
    });
  };
  const remove = (id: string) =>
    startTransition(async () => {
      const res = await deletePostComment(id);
      if (!res.ok) return setError(res.error);
      setComments((c) => c?.filter((x) => x.id !== id) ?? null);
      onCountChange(-1);
    });

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {comments === null ? (
        <div className="h-10 animate-pulse rounded-xl bg-surface-2" />
      ) : (
        comments.map((c) => (
          <div key={c.id} className="flex gap-2">
            <Avatar name={c.author?.display_name ?? "?"} className="size-8 text-xs" />
            <div className="min-w-0 flex-1 rounded-2xl bg-surface-2 px-3 py-2 text-sm">
              <p className="flex items-center gap-2">
                {c.author?.username ? (
                  <Link href={`/u/${c.author.username}`} className="font-semibold hover:text-primary">
                    {c.author.display_name}
                  </Link>
                ) : (
                  <span className="font-semibold">{c.author?.display_name}</span>
                )}
                <span className="text-xs text-muted">{timeAgo(c.created_at)}</span>
                {viewer && (viewer.id === c.author_id || viewer.isAdmin) && (
                  <button type="button" onClick={() => remove(c.id)} aria-label="מחיקת תגובה" className="ms-auto text-muted hover:text-accent">
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                )}
              </p>
              <p className="whitespace-pre-line break-words">{c.body}</p>
            </div>
          </div>
        ))
      )}
      {error && <p className="text-sm text-accent">{error}</p>}
      {viewer ? (
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor={`c-${postId}`} className="sr-only">
            תגובה
          </label>
          <textarea
            id={`c-${postId}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={1}
            maxLength={2000}
            placeholder="כתבו תגובה…"
            className="min-h-10 flex-1 resize-none rounded-2xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={pending || !body.trim()}
            className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            שליחה
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted">
          <Link href="/login" className="font-semibold text-primary underline">
            התחברו
          </Link>{" "}
          כדי להגיב.
        </p>
      )}
    </div>
  );
}
