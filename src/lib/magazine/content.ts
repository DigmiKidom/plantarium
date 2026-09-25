import type { JSONContent } from "@tiptap/core";

/** Allowed nodes and the attributes each may keep. Everything else is dropped. */
const NODES: Record<string, string[]> = {
  doc: [],
  paragraph: [],
  text: [],
  heading: ["level"],
  bulletList: [],
  orderedList: ["start"],
  listItem: [],
  blockquote: [],
  horizontalRule: [],
  hardBreak: [],
  image: ["src", "alt", "title"],
};
const MARKS: Record<string, string[]> = {
  bold: [],
  italic: [],
  underline: [],
  strike: [],
  link: ["href"],
};

export const MAX_CONTENT_BYTES = 200_000;
export const EMPTY_DOC: JSONContent = { type: "doc", content: [] };

const imagesBase = () => (process.env.NEXT_PUBLIC_IMAGES_URL ?? "").replace(/\/+$/, "");

/** Images must come from our own photo storage (R2), never from other sites. */
export function isOwnImageUrl(src: unknown): src is string {
  const base = imagesBase();
  return typeof src === "string" && base !== "" && src.startsWith(base + "/") && !src.includes("..");
}

function safeHref(href: unknown): string | null {
  if (typeof href !== "string" || href.length > 2000) return null;
  try {
    const u = new URL(href);
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

function cleanAttrs(type: string, allowed: string[], attrs: Record<string, unknown> | undefined) {
  if (!attrs || allowed.length === 0) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of allowed) {
    const v = attrs[k];
    if (v === undefined || v === null) continue;
    if (k === "level") out.level = v === 3 ? 3 : 2;
    else if (k === "start") out.start = Number.isInteger(v) && (v as number) > 0 && (v as number) < 10000 ? v : 1;
    else if (k === "href") {
      const h = safeHref(v);
      if (!h) return null; // bad link → drop the mark
      out.href = h;
    } else if (typeof v === "string") out[k] = v.slice(0, 300);
  }
  if (type === "image" && !isOwnImageUrl(out.src)) return null;
  return out;
}

function cleanNode(node: JSONContent, depth: number): JSONContent | null {
  if (!node || typeof node !== "object" || depth > 20) return null;
  const type = String(node.type ?? "");
  if (!(type in NODES)) return null;

  const attrs = cleanAttrs(type, NODES[type], node.attrs);
  if (attrs === null) return null;
  const out: JSONContent = { type };
  if (attrs && Object.keys(attrs).length) out.attrs = attrs;

  if (type === "text") {
    if (typeof node.text !== "string" || node.text === "") return null;
    out.text = node.text.slice(0, 20_000);
    const marks = (Array.isArray(node.marks) ? node.marks : [])
      .map((m) => {
        const mt = String(m?.type ?? "");
        if (!(mt in MARKS)) return null;
        const ma = cleanAttrs(mt, MARKS[mt], m.attrs);
        if (ma === null) return null;
        return ma && Object.keys(ma).length ? { type: mt, attrs: ma } : { type: mt };
      })
      .filter(Boolean) as JSONContent["marks"];
    if (marks?.length) out.marks = marks;
    return out;
  }

  if (Array.isArray(node.content)) {
    const children = node.content.map((c) => cleanNode(c, depth + 1)).filter(Boolean) as JSONContent[];
    if (children.length) out.content = children;
  }
  return out;
}

/** Returns a safe copy of the editor JSON with only allowed nodes, marks, links and our own images. */
export function sanitizeContent(input: unknown): JSONContent {
  const cleaned = cleanNode(input as JSONContent, 0);
  return cleaned && cleaned.type === "doc" ? cleaned : EMPTY_DOC;
}

export function plainText(node: JSONContent | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  const inner = (node.content ?? []).map(plainText).join(node.type === "doc" ? "\n" : " ");
  return inner;
}

/** Hebrew prose: about 200 words a minute. */
export function readingMinutes(doc: JSONContent): number {
  const words = plainText(doc).split(/\s+/).filter(Boolean).length;
  return Math.min(600, Math.max(1, Math.round(words / 200)));
}

export function firstImage(node: JSONContent | undefined): string | null {
  if (!node) return null;
  if (node.type === "image" && isOwnImageUrl(node.attrs?.src)) return node.attrs!.src as string;
  for (const c of node.content ?? []) {
    const found = firstImage(c);
    if (found) return found;
  }
  return null;
}
