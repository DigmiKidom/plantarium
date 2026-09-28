import "server-only";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { FEED_PAGE, POST_COLUMNS, mediaUrl, type FeedPost, type FeedTab, type PostRow } from "./types";

type Db = Awaited<ReturnType<typeof createUserClient>>;

async function withLikes(db: Db, rows: PostRow[], viewerId: string | null): Promise<FeedPost[]> {
  let liked = new Set<string>();
  if (viewerId && rows.length) {
    const { data } = await db
      .from("reactions")
      .select("post_id")
      .eq("user_id", viewerId)
      .in("post_id", rows.map((r) => r.id));
    liked = new Set((data ?? []).map((r) => r.post_id as string));
  }
  return rows.map(({ media, ...p }) => ({
    ...p,
    photos: (media ?? []).sort((a, b) => a.sort - b.sort).map((m) => mediaUrl(m.storage_path)),
    liked: liked.has(p.id),
  }));
}

/**
 * One page of the feed, newest first. "following" = people you follow + yourself.
 * Visibility (public / blocked / deleted) is decided by the database rules.
 */
export async function getFeed({ tab = "all", before }: { tab?: FeedTab; before?: string } = {}) {
  if (!hasSupabase()) return { posts: [] as FeedPost[], viewerId: null as string | null, hasMore: false };
  const db = await createUserClient();
  const { data: auth } = await db.auth.getUser();
  const viewerId = auth.user?.id ?? null;

  let q = db
    .from("posts")
    .select(POST_COLUMNS)
    .is("deleted_at", null)
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE + 1);
  if (before) q = q.lt("created_at", before);

  if (tab === "following") {
    if (!viewerId) return { posts: [], viewerId, hasMore: false };
    const { data: f } = await db.from("follows").select("followee_id").eq("follower_id", viewerId);
    q = q.in("author_id", [viewerId, ...(f ?? []).map((r) => r.followee_id as string)]);
  }

  const { data, error } = await q.returns<PostRow[]>();
  if (error) console.error(JSON.stringify({ at: "feed.get", error: error.message }));
  const rows = data ?? [];
  const hasMore = rows.length > FEED_PAGE;
  return { posts: await withLikes(db, rows.slice(0, FEED_PAGE), viewerId), viewerId, hasMore };
}

export async function getPost(id: string) {
  if (!hasSupabase() || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const db = await createUserClient();
  const { data: auth } = await db.auth.getUser();
  const viewerId = auth.user?.id ?? null;
  const { data } = await db.from("posts").select(POST_COLUMNS).eq("id", id).is("deleted_at", null).maybeSingle<PostRow>();
  if (!data) return null;
  const [post] = await withLikes(db, [data], viewerId);
  return { post, viewerId };
}
