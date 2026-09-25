import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import type { JSONContent } from "@tiptap/core";
import { articleExtensions } from "@/lib/magazine/extensions";
import { sanitizeContent } from "@/lib/magazine/content";

/** Renders saved article JSON on the server. Content is sanitized again, in case it was edited outside the app. */
export function ArticleBody({ content }: { content: JSONContent }) {
  return <div className="article-prose">{renderToReactElement({ content: sanitizeContent(content), extensions: articleExtensions })}</div>;
}
