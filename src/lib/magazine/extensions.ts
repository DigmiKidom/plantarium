import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import Youtube from "@tiptap/extension-youtube";
import { Node, mergeAttributes, type Extensions } from "@tiptap/core";

/** Palettes offered in the editor. The sanitizer only accepts these exact values. */
export const HIGHLIGHT_COLORS = {
  yellow: { value: "#fde68a", he: "צהוב" },
  green: { value: "#bbf7d0", he: "ירוק" },
  blue: { value: "#bfdbfe", he: "כחול" },
  pink: { value: "#fbcfe8", he: "ורוד" },
} as const;
export const TEXT_COLORS = {
  green: { value: "#2f6b45", he: "ירוק עלה" },
  terracotta: { value: "#c2663f", he: "טרקוטה" },
  blue: { value: "#2563eb", he: "כחול" },
  amber: { value: "#b45309", he: "ענבר" },
  gray: { value: "#6b7280", he: "אפור" },
} as const;
export const IMAGE_SIZES = { full: "רוחב מלא", half: "חצי (שתיים בשורה)", small: "קטנה" } as const;
export const CALLOUT_VARIANTS = { tip: "טיפ", warning: "שימו לב", info: "מידע" } as const;

/** Image with a size (full / half / small) and an optional caption, rendered as <figure>. */
export const ArticleImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      size: {
        default: "full",
        parseHTML: (el: HTMLElement) => el.closest("figure")?.getAttribute("data-size") ?? "full",
        renderHTML: () => ({}),
      },
      caption: {
        default: null,
        parseHTML: (el: HTMLElement) => el.closest("figure")?.querySelector("figcaption")?.textContent ?? null,
        renderHTML: () => ({}),
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const size = (node.attrs.size as string) in IMAGE_SIZES ? (node.attrs.size as string) : "full";
    const caption = node.attrs.caption as string | null;
    const img = ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { loading: "lazy" })] as const;
    return caption
      ? ["figure", { class: "article-figure", "data-size": size }, img, ["figcaption", {}, caption]]
      : ["figure", { class: "article-figure", "data-size": size }, img];
  },
});

/** A colored box for tips and warnings. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      variant: {
        default: "tip",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-variant") ?? "tip",
        renderHTML: (attrs: { variant?: string }) => ({ "data-variant": attrs.variant ?? "tip" }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "aside.callout" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["aside", mergeAttributes({ class: "callout" }, HTMLAttributes), 0];
  },
});

/**
 * The one list of editor features, shared by the editor (browser) and the article page (server),
 * so what an author sees while writing is exactly what readers get.
 * Anything not listed here is removed by sanitizeContent() before saving.
 */
export const articleExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
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
  ArticleImage.configure({ inline: false, allowBase64: false }),
  TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["right", "center", "left"], defaultAlignment: null }),
  Highlight.configure({ multicolor: true }),
  TextStyle,
  Color,
  Callout,
  Youtube.configure({ nocookie: true, controls: true, width: 640, height: 360, HTMLAttributes: { class: "article-video" } }),
];
