import "server-only";
import { createPublicClient, hasSupabase } from "@/lib/supabase/server";

export async function followCounts(userId: string) {
  if (!hasSupabase()) return { followers: 0, following: 0 };
  const db = createPublicClient();
  const head = { count: "exact" as const, head: true };
  const [a, b] = await Promise.all([
    db.from("follows").select("follower_id", head).eq("followee_id", userId),
    db.from("follows").select("followee_id", head).eq("follower_id", userId),
  ]);
  return { followers: a.count ?? 0, following: b.count ?? 0 };
}

export async function isFollowing(viewerId: string, userId: string) {
  const { data } = await createPublicClient()
    .from("follows")
    .select("follower_id")
    .eq("follower_id", viewerId)
    .eq("followee_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export type PersonRow = { id: string; username: string | null; display_name: string; bio: string | null; avatar_url: string | null };

/** People who follow userId ("followers") or whom userId follows ("following"), newest first. */
export async function followList(userId: string, kind: "followers" | "following") {
  const db = createPublicClient();
  const q =
    kind === "followers"
      ? db
          .from("follows")
          .select("created_at, person:profiles!follows_follower_id_fkey(id, username, display_name, bio, avatar_url)")
          .eq("followee_id", userId)
      : db
          .from("follows")
          .select("created_at, person:profiles!follows_followee_id_fkey(id, username, display_name, bio, avatar_url)")
          .eq("follower_id", userId);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(200).returns<{ person: PersonRow | null }[]>();
  if (error) console.error(JSON.stringify({ at: "follows.list", error: error.message }));
  return (data ?? []).map((r) => r.person).filter(Boolean) as PersonRow[];
}
