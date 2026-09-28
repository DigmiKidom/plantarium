"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { loadMorePosts } from "@/lib/feed/actions";
import type { FeedPost, FeedTab } from "@/lib/feed/types";
import { PostCard, type Viewer } from "./post-card";

export function FeedList({
  initial,
  hasMore: initialHasMore,
  tab,
  viewer,
  empty,
}: {
  initial: FeedPost[];
  hasMore: boolean;
  tab: FeedTab;
  viewer: Viewer;
  empty: React.ReactNode;
}) {
  // The server list is the source of truth after router.refresh(); extra pages are appended.
  const [extra, setExtra] = useState<FeedPost[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, startTransition] = useTransition();

  const seen = new Set(initial.map((p) => p.id));
  const posts = [...initial, ...extra.filter((p) => !seen.has(p.id))].filter((p) => !removed.has(p.id));

  const more = () =>
    startTransition(async () => {
      const last = posts[posts.length - 1];
      if (!last) return;
      const res = await loadMorePosts(tab, last.created_at);
      setExtra((e) => [...e, ...res.posts]);
      setHasMore(res.hasMore);
    });

  if (posts.length === 0) return <>{empty}</>;

  return (
    <div className="flex flex-col gap-4">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} viewer={viewer} onDeleted={(id) => setRemoved((s) => new Set(s).add(id))} />
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={more}
          disabled={pending}
          className="mx-auto flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-medium hover:bg-surface-2 disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          פוסטים נוספים
        </button>
      )}
    </div>
  );
}
