export type PostType = "post" | "question" | "plant_update";
export const POST_TYPE_HE: Record<PostType, string> = { post: "עדכון", question: "שאלה", plant_update: "עדכון צמח" };

export type FeedPost = {
  id: string;
  type: PostType;
  body: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  author_id: string;
  author: { username: string | null; display_name: string } | null;
  species: { slug: string; common_name_he: string } | null;
  photos: string[];
  liked: boolean;
};

export type FeedTab = "all" | "following";
export const FEED_PAGE = 20;
export const MAX_POST_PHOTOS = 4;
export const MAX_POST_CHARS = 2000;

export const POST_COLUMNS =
  "id, type, body, created_at, like_count, comment_count, author_id, author:profiles!posts_author_id_fkey(username, display_name), species:species(slug, common_name_he), media:post_media(storage_path, sort)";

export type PostRow = Omit<FeedPost, "photos" | "liked"> & { media: { storage_path: string; sort: number }[] | null };

export const imagesBase = () => (process.env.NEXT_PUBLIC_IMAGES_URL ?? "").replace(/\/+$/, "");
export const mediaUrl = (path: string) => `${imagesBase()}/${path}`;

/** "לפני 5 דק׳" style times for the feed. */
export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "עכשיו";
  const m = Math.round(s / 60);
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "לפני שעה" : `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? "אתמול" : `לפני ${d} ימים`;
  return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" }).format(new Date(iso));
}
