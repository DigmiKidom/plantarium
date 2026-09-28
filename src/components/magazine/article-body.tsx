import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import type { JSONContent } from "@tiptap/core";
import { articleExtensions } from "@/lib/magazine/extensions";
import { sanitizeContent, youtubeUrl } from "@/lib/magazine/content";

/** Clean, privacy-friendly YouTube embed (youtube-nocookie, lazy). */
function Video({ src }: { src: string }) {
  const id = new URL(youtubeUrl(src) ?? "https://www.youtube.com/watch?v=").searchParams.get("v");
  if (!id) return null;
  return (
    <div className="article-video-wrap">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title="סרטון"
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

/** Renders saved article JSON on the server. Content is sanitized again, in case it was edited outside the app. */
export function ArticleBody({ content }: { content: JSONContent }) {
  return (
    <div className="article-prose">
      {renderToReactElement({
        content: sanitizeContent(content),
        extensions: articleExtensions,
        options: {
          nodeMapping: {
            youtube: ({ node }) => <Video src={String(node.attrs.src)} />,
          },
        },
      })}
    </div>
  );
}
