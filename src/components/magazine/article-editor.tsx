"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import type { JSONContent } from "@tiptap/core";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  Heading4,
  Highlighter,
  Lightbulb,
  Palette,
  SquarePlay,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  Send,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { CALLOUT_VARIANTS, HIGHLIGHT_COLORS, IMAGE_SIZES, TEXT_COLORS, articleExtensions } from "@/lib/magazine/extensions";
import { createArticleImageUpload, deleteArticle, saveArticle } from "@/lib/magazine/actions";
import { uploadImage } from "@/lib/uploads/client";
import { STATUS_HE, type ArticleStatus } from "@/lib/magazine/types";
import { FormAlert } from "@/components/ui/form";
import { cn } from "@/lib/cn";

type Initial = {
  id?: string;
  title: string;
  excerpt: string;
  tags: string[];
  coverUrl: string | null;
  content: JSONContent;
  status: ArticleStatus;
  reviewNote: string | null;
  slug?: string;
};

function ToolButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={onClick}
      className={cn(
        "grid size-9 place-items-center rounded-lg transition disabled:opacity-40",
        active ? "bg-leaf-soft text-primary-strong" : "text-text hover:bg-surface-2",
      )}
    >
      <Icon className="size-4.5" aria-hidden />
    </button>
  );
}

type Panel = null | "link" | "highlight" | "color" | "callout" | "video";

function Swatch({ color, label, onClick }: { color: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="size-7 rounded-full border border-border"
      style={{ background: color }}
    />
  );
}

function Toolbar({ editor, onImages, uploading }: { editor: Editor; onImages: () => void; uploading: boolean }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      h4: e.isActive("heading", { level: 4 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      callout: e.isActive("callout"),
      link: e.isActive("link"),
      highlight: e.isActive("highlight"),
      colored: Boolean(e.getAttributes("textStyle").color),
      alignRight: e.isActive({ textAlign: "right" }),
      alignCenter: e.isActive({ textAlign: "center" }),
      alignLeft: e.isActive({ textAlign: "left" }),
      image: e.isActive("image"),
      imageSize: (e.getAttributes("image").size as string | undefined) ?? "full",
      imageCaption: (e.getAttributes("image").caption as string | undefined) ?? "",
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const [panel, setPanel] = useState<Panel>(null);
  const [href, setHref] = useState("");
  const [video, setVideo] = useState("");
  const c = () => editor.chain().focus();
  const open = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  const applyLink = () => {
    const url = href.trim();
    if (!url) c().extendMarkRange("link").unsetLink().run();
    else c().extendMarkRange("link").setLink({ href: /^(https?:|mailto:)/i.test(url) ? url : `https://${url}` }).run();
    setPanel(null);
  };
  const addVideo = () => {
    if (video.trim()) c().setYoutubeVideo({ src: video.trim() }).run();
    setVideo("");
    setPanel(null);
  };
  const sep = <span className="mx-1 h-6 w-px bg-border" aria-hidden />;

  return (
    <div className="sticky top-16 z-10 border-b border-border bg-surface/95 backdrop-blur md:top-0">
      <div role="toolbar" aria-label="עיצוב המאמר" className="flex flex-wrap items-center gap-0.5 p-1.5">
        <ToolButton icon={Heading2} label="כותרת" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} />
        <ToolButton icon={Heading3} label="כותרת משנה" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} />
        <ToolButton icon={Heading4} label="כותרת קטנה" active={s.h4} onClick={() => c().toggleHeading({ level: 4 }).run()} />
        {sep}
        <ToolButton icon={Bold} label="מודגש" active={s.bold} onClick={() => c().toggleBold().run()} />
        <ToolButton icon={Italic} label="נטוי" active={s.italic} onClick={() => c().toggleItalic().run()} />
        <ToolButton icon={Underline} label="קו תחתון" active={s.underline} onClick={() => c().toggleUnderline().run()} />
        <ToolButton icon={Strikethrough} label="קו חוצה" active={s.strike} onClick={() => c().toggleStrike().run()} />
        <ToolButton icon={Highlighter} label="מרקר" active={s.highlight || panel === "highlight"} onClick={() => open("highlight")} />
        <ToolButton icon={Palette} label="צבע טקסט" active={s.colored || panel === "color"} onClick={() => open("color")} />
        {sep}
        <ToolButton icon={AlignRight} label="יישור לימין" active={s.alignRight} onClick={() => c().setTextAlign("right").run()} />
        <ToolButton icon={AlignCenter} label="מרכוז" active={s.alignCenter} onClick={() => c().setTextAlign("center").run()} />
        <ToolButton icon={AlignLeft} label="יישור לשמאל" active={s.alignLeft} onClick={() => c().setTextAlign("left").run()} />
        {sep}
        <ToolButton icon={List} label="רשימה" active={s.bullet} onClick={() => c().toggleBulletList().run()} />
        <ToolButton icon={ListOrdered} label="רשימה ממוספרת" active={s.ordered} onClick={() => c().toggleOrderedList().run()} />
        <ToolButton icon={Quote} label="ציטוט" active={s.quote} onClick={() => c().toggleBlockquote().run()} />
        <ToolButton icon={Lightbulb} label="תיבת טיפ" active={s.callout || panel === "callout"} onClick={() => open("callout")} />
        <ToolButton icon={Minus} label="קו מפריד" onClick={() => c().setHorizontalRule().run()} />
        {sep}
        <ToolButton
          icon={Link2}
          label="קישור"
          active={s.link || panel === "link"}
          onClick={() => {
            setHref(s.href);
            open("link");
          }}
        />
        <ToolButton icon={uploading ? Loader2 : ImagePlus} label="הוספת תמונות" disabled={uploading} onClick={onImages} />
        <ToolButton icon={SquarePlay} label="סרטון יוטיוב" active={panel === "video"} onClick={() => open("video")} />
        <span className="ms-auto flex">
          <ToolButton icon={Undo2} label="ביטול" disabled={!s.canUndo} onClick={() => c().undo().run()} />
          <ToolButton icon={Redo2} label="חזרה" disabled={!s.canRedo} onClick={() => c().redo().run()} />
        </span>
      </div>

      {/* Selected image: size + caption */}
      {s.image && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border p-2 text-sm">
          <span className="font-medium">תמונה:</span>
          {(Object.keys(IMAGE_SIZES) as (keyof typeof IMAGE_SIZES)[]).map((k) => (
            <button
              key={k}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => c().updateAttributes("image", { size: k }).run()}
              className={cn("rounded-full border px-3 py-1", s.imageSize === k ? "border-primary bg-leaf-soft font-medium" : "border-border hover:bg-surface-2")}
            >
              {IMAGE_SIZES[k]}
            </button>
          ))}
          <input
            key={s.imageCaption}
            defaultValue={s.imageCaption}
            onBlur={(e) => editor.chain().updateAttributes("image", { caption: e.target.value.trim() || null }).run()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="כיתוב לתמונה (Enter לשמירה)"
            aria-label="כיתוב לתמונה"
            className="min-w-40 flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 outline-none focus:border-primary"
          />
        </div>
      )}

      {panel === "highlight" && (
        <div className="flex items-center gap-2 border-t border-border p-2 text-sm">
          <span>מרקר:</span>
          {Object.values(HIGHLIGHT_COLORS).map((h) => (
            <Swatch key={h.value} color={h.value} label={h.he} onClick={() => c().setHighlight({ color: h.value }).run()} />
          ))}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => c().unsetHighlight().run()} className="rounded-full px-3 py-1 text-muted hover:bg-surface-2">
            הסרה
          </button>
        </div>
      )}
      {panel === "color" && (
        <div className="flex items-center gap-2 border-t border-border p-2 text-sm">
          <span>צבע:</span>
          {Object.values(TEXT_COLORS).map((t) => (
            <Swatch key={t.value} color={t.value} label={t.he} onClick={() => c().setColor(t.value).run()} />
          ))}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => c().unsetColor().run()} className="rounded-full px-3 py-1 text-muted hover:bg-surface-2">
            רגיל
          </button>
        </div>
      )}
      {panel === "callout" && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border p-2 text-sm">
          <span>תיבה:</span>
          {(Object.keys(CALLOUT_VARIANTS) as (keyof typeof CALLOUT_VARIANTS)[]).map((k) => (
            <button
              key={k}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (s.callout) c().updateAttributes("callout", { variant: k }).run();
                else c().wrapIn("callout", { variant: k }).run();
                setPanel(null);
              }}
              className="rounded-full border border-border px-3 py-1 hover:bg-surface-2"
            >
              {CALLOUT_VARIANTS[k]}
            </button>
          ))}
          {s.callout && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => c().lift("callout").run()} className="rounded-full px-3 py-1 text-muted hover:bg-surface-2">
              הוצאה מהתיבה
            </button>
          )}
        </div>
      )}
      {(panel === "link" || panel === "video") && (
        <div className="flex items-center gap-2 border-t border-border p-2">
          <input
            autoFocus
            dir="ltr"
            value={panel === "link" ? href : video}
            onChange={(e) => (panel === "link" ? setHref(e.target.value) : setVideo(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (panel === "link") applyLink();
                else addVideo();
              }
              if (e.key === "Escape") setPanel(null);
            }}
            placeholder={panel === "link" ? "https://" : "https://www.youtube.com/watch?v=…"}
            aria-label={panel === "link" ? "כתובת הקישור" : "קישור לסרטון ביוטיוב"}
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-start text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={panel === "link" ? applyLink : addVideo}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
          >
            {panel === "link" ? (href.trim() ? "החלה" : "הסרה") : "הוספה"}
          </button>
          <button type="button" aria-label="סגירה" onClick={() => setPanel(null)} className="rounded-full p-2 text-muted hover:bg-surface-2">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

export function ArticleEditor({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [id, setId] = useState(initial.id);
  const [status, setStatus] = useState<ArticleStatus>(initial.status);
  const [title, setTitle] = useState(initial.title);
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [uploading, setUploading] = useState<"body" | "cover" | null>(null);
  const [pending, startTransition] = useTransition();
  const bodyFile = useRef<HTMLInputElement>(null);
  const coverFile = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [...articleExtensions, Placeholder.configure({ placeholder: "כתבו כאן את המאמר…" })],
    content: initial.content,
    immediatelyRender: false,
    editorProps: { attributes: { dir: "rtl", "aria-label": "תוכן המאמר", class: "px-5 py-6 md:px-8" } },
  });

  const upload = async (files: FileList | null, target: "body" | "cover") => {
    const list = Array.from(files ?? []).slice(0, target === "cover" ? 1 : 10);
    if (!list.length) return;
    setError(undefined);
    setUploading(target);
    try {
      for (const file of list) {
        const url = await uploadImage(file, createArticleImageUpload);
        if (target === "cover") setCoverUrl(url);
        // Two or more photos at once → side by side (half width)
        else editor?.chain().focus().insertContent({ type: "image", attrs: { src: url, alt: "", size: list.length > 1 ? "half" : "full" } }).run();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "העלאת התמונה נכשלה");
    } finally {
      setUploading(null);
    }
  };

  const save = (submit: boolean) => {
    if (!editor) return;
    setError(undefined);
    setMessage(undefined);
    startTransition(async () => {
      const res = await saveArticle({
        id,
        title,
        excerpt,
        tags: tags.split(/[,،]/).map((t) => t.trim()).filter(Boolean),
        coverUrl,
        // ProseMirror builds attrs with Object.create(null); React can't send those to a server action,
        // so turn the document into plain JSON first.
        content: JSON.parse(JSON.stringify(editor.getJSON())),
        submit,
      });
      if (!res.ok) return setError(res.error);
      setStatus(res.status as ArticleStatus);
      setMessage(submit ? "המאמר נשלח לאישור. נעדכן כאן כשמנהל יאשר אותו." : "הטיוטה נשמרה");
      if (!id) {
        setId(res.id);
        router.replace(`/magazine/write/${res.id}`);
      } else router.refresh();
    });
  };

  const remove = () => {
    if (!id) return router.push("/magazine/write");
    if (!confirm("למחוק את המאמר? אי אפשר לשחזר.")) return;
    startTransition(async () => {
      const res = await deleteArticle(id);
      if (!res.ok) return setError(res.error);
      router.push("/magazine/write");
    });
  };

  const busy = pending || uploading !== null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-medium">{STATUS_HE[status]}</span>
        {status === "published" && initial.slug && (
          <Link href={`/magazine/${initial.slug}`} className="text-sm text-primary underline">
            לצפייה במאמר
          </Link>
        )}
      </div>

      {status === "rejected" && initial.reviewNote && (
        <div className="rounded-2xl bg-sun-soft px-4 py-3 text-sm">
          <p className="font-semibold">הערת המנהל:</p>
          <p className="whitespace-pre-line">{initial.reviewNote}</p>
        </div>
      )}
      {status === "published" && (
        <p className="rounded-2xl bg-water-soft px-4 py-3 text-sm">
          המאמר מפורסם. שמירת שינויים תוריד אותו מהמגזין עד שמנהל יאשר את הגרסה החדשה.
        </p>
      )}
      {status === "pending" && (
        <p className="rounded-2xl bg-water-soft px-4 py-3 text-sm">המאמר ממתין לאישור מנהל. אפשר להמשיך לערוך.</p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="article-title" className="text-sm font-medium">
          כותרת <span className="text-accent">*</span>
        </label>
        <input
          id="article-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          placeholder="למשל: מונסטרה – הצמח שיהפוך את הבית לירוק יותר"
          className="w-full rounded-xl border border-border bg-bg px-3.5 py-3 text-xl font-bold outline-none placeholder:font-normal placeholder:text-muted focus:border-primary md:text-2xl"
        />
        <p className="text-xs text-muted">{title.trim().length}/140 · לפחות 5 תווים</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="article-excerpt" className="text-sm font-medium">
          תקציר
        </label>
        <textarea
          id="article-excerpt"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="משפט או שניים שיופיעו בכרטיס המאמר ובתחילתו"
          className="w-full resize-none rounded-xl border border-border bg-bg px-3.5 py-3 outline-none focus:border-primary"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tags" className="text-sm font-medium">
            תגיות
          </label>
          <input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="מונסטרה, השקיה, מתחילים"
            className="w-full rounded-xl border border-border bg-bg px-3.5 py-3 outline-none focus:border-primary"
          />
          <p className="text-xs text-muted">מופרדות בפסיקים, עד 8</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">תמונה ראשית</span>
          <div className="flex items-center gap-3">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="h-14 w-24 rounded-lg object-cover" />
            ) : (
              <span className="grid h-14 w-24 place-items-center rounded-lg bg-surface-2 text-xs text-muted">ללא</span>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => coverFile.current?.click()}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-surface-2 disabled:opacity-60"
            >
              {uploading === "cover" && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {coverUrl ? "החלפה" : "העלאה"}
            </button>
            {coverUrl && (
              <button type="button" onClick={() => setCoverUrl(null)} className="text-sm text-muted underline">
                הסרה
              </button>
            )}
          </div>
          <p className="text-xs text-muted">בלי תמונה ראשית – תשמש התמונה הראשונה במאמר</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-surface">
        {editor ? (
          <>
            <Toolbar editor={editor} uploading={uploading === "body"} onImages={() => bodyFile.current?.click()} />
            <div className="article-prose">
              <EditorContent editor={editor} />
            </div>
          </>
        ) : (
          <div className="h-80 animate-pulse bg-surface-2" />
        )}
      </div>

      <input ref={bodyFile} type="file" accept="image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic" multiple hidden onChange={(e) => { upload(e.target.files, "body"); e.target.value = ""; }} />
      <input ref={coverFile} type="file" accept="image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic" hidden onChange={(e) => { upload(e.target.files, "cover"); e.target.value = ""; }} />

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface/95 p-3 backdrop-blur md:bottom-4">
        {(error || message) && (
          <div className="w-full" aria-live="polite">
            <FormAlert error={error} message={message} />
          </div>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => save(true)}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary hover:bg-primary-strong disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4 rtl:-scale-x-100" aria-hidden />}
          שליחה לאישור
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => save(false)}
          className="rounded-full border border-border px-5 py-2.5 font-medium hover:bg-surface-2 disabled:opacity-60"
        >
          שמירת טיוטה
        </button>
        {status !== "published" && (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="ms-auto flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-muted hover:text-accent disabled:opacity-60"
          >
            <Trash2 className="size-4" aria-hidden />
            {id ? "מחיקה" : "ביטול"}
          </button>
        )}
      </div>
    </div>
  );
}
