import type { JSONContent } from "@tiptap/core";

export type ArticleStatus = "draft" | "pending" | "published" | "rejected";

export const STATUS_HE: Record<ArticleStatus, string> = {
  draft: "טיוטה",
  pending: "ממתין לאישור",
  published: "פורסם",
  rejected: "הוחזר לתיקון",
};

export type AuthorRef = { id: string; username: string | null; display_name: string };

export type ArticleSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_url: string | null;
  reading_minutes: number;
  tags: string[];
  status: ArticleStatus;
  published_at: string | null;
  submitted_at: string | null;
  updated_at: string;
  review_note: string | null;
  author: AuthorRef | null;
};

export type Article = ArticleSummary & { content: JSONContent };

export const SUMMARY_COLUMNS =
  "id, slug, title, excerpt, cover_url, reading_minutes, tags, status, published_at, submitted_at, updated_at, review_note, author:profiles!magazine_articles_author_id_fkey(id, username, display_name)";
