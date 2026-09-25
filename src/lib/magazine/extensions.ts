import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import type { Extensions } from "@tiptap/core";

/**
 * The one list of editor features, shared by the editor (browser) and the article page (server),
 * so what an author sees while writing is exactly what readers get.
 * Anything not listed here is removed by sanitizeContent() before saving.
 */
export const articleExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      protocols: ["http", "https", "mailto"],
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    },
  }),
  Image.configure({ inline: false, allowBase64: false }),
];
