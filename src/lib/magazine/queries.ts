import "server-only";
import { createPublicClient, createUserClient, hasSupabase } from "@/lib/supabase/server";
import { SUMMARY_COLUMNS, type Article, type ArticleStatus, type ArticleSummary } from "./types";

/** Published articles, newest first. Public data, no session needed. */
export async function listPublished({ limit = 24, authorId }: { limit?: number; authorId?: string } = {}) {
  if (!hasSupabase()) return [] as ArticleSummary[];
  let query = createPublicClient()
    .from("magazine_articles")
    .select(SUMMARY_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (authorId) query = query.eq("author_id", authorId);
  const { data, error } = await query.returns<ArticleSummary[]>();
  if (error) console.error(JSON.stringify({ at: "magazine.listPublished", error: error.message }));
  return data ?? [];
}

export async function getPublishedBySlug(slug: string) {
  if (!hasSupabase() || !/^[a-z0-9-]{4,80}$/.test(slug)) return null;
  const { data } = await createPublicClient()
    .from("magazine_articles")
    .select(`${SUMMARY_COLUMNS}, content`)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<Article>();
  return data;
}

/** Any article the signed-in user may see (own, or all for admins – RLS decides). */
export async function getArticleForUser(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("magazine_articles")
    .select(`${SUMMARY_COLUMNS}, content, author_id`)
    .eq("id", id)
    .maybeSingle<Article & { author_id: string }>();
  if (error) console.error(JSON.stringify({ at: "magazine.getArticleForUser", error: error.message }));
  return data;
}

export async function listMine(userId: string) {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("magazine_articles")
    .select(SUMMARY_COLUMNS)
    .eq("author_id", userId)
    .order("updated_at", { ascending: false })
    .returns<ArticleSummary[]>();
  if (error) console.error(JSON.stringify({ at: "magazine.listMine", error: error.message }));
  return data ?? [];
}

/** Admin lists (RLS: only admins get rows that aren't theirs). */
export async function listByStatus(status: ArticleStatus, limit = 50) {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("magazine_articles")
    .select(SUMMARY_COLUMNS)
    .eq("status", status)
    .order(status === "published" ? "published_at" : "submitted_at", { ascending: status !== "pending" ? false : true })
    .limit(limit)
    .returns<ArticleSummary[]>();
  if (error) console.error(JSON.stringify({ at: "magazine.listByStatus", status, error: error.message }));
  return data ?? [];
}
