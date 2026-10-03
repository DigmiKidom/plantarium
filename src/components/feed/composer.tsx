"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, ImagePlus, Leaf, Loader2, Send, X } from "lucide-react";
import { createFeedImageUpload, createPost } from "@/lib/feed/actions";
import { MAX_POST_CHARS, MAX_POST_PHOTOS } from "@/lib/feed/types";
import { uploadImage } from "@/lib/uploads/client";
import { CATEGORY_HE } from "@/lib/labels";
import type { Category } from "@/lib/species/types";
import type { SpeciesOption } from "@/components/market/listing-form";
import { Avatar } from "@/components/auth/me";
import { cn } from "@/lib/cn";

export function Composer({ name, avatarUrl, species }: { name: string; avatarUrl?: string | null; species: SpeciesOption[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [type, setType] = useState<"post" | "question">("post");
  const [speciesSlug, setSpeciesSlug] = useState("");
  const [showSpecies, setShowSpecies] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const byCategory = (Object.keys(CATEGORY_HE) as Category[]).map((c) => ({
    c,
    items: species.filter((s) => s.category === c).sort((a, b) => a.name.localeCompare(b.name, "he")),
  }));

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, MAX_POST_PHOTOS - photos.length);
    setError(undefined);
    setUploading((n) => n + list.length);
    for (const f of list) {
      try {
        const url = await uploadImage(f, createFeedImageUpload);
        setPhotos((p) => [...p, url].slice(0, MAX_POST_PHOTOS));
      } catch (e) {
        setError(e instanceof Error ? e.message : "העלאת התמונה נכשלה");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const res = await createPost({ body, type, speciesSlug, photos });
      if (!res.ok) return setError(res.error);
      setBody("");
      setPhotos([]);
      setSpeciesSlug("");
      setShowSpecies(false);
      setType("post");
      router.refresh();
    });
  };

  const canPost = (body.trim() || photos.length) && uploading === 0 && !pending;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 md:p-5">
      <div className="flex gap-3">
        <Avatar name={name} url={avatarUrl} />
        <label htmlFor="new-post" className="sr-only">
          פוסט חדש
        </label>
        <textarea
          id="new-post"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_POST_CHARS}
          rows={body ? 3 : 2}
          placeholder={type === "question" ? "מה תרצו לשאול את הקהילה?" : "מה חדש אצל הצמחים שלך?"}
          className="min-w-0 flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-muted"
        />
      </div>

      {(photos.length > 0 || uploading > 0) && (
        <ul className="grid grid-cols-4 gap-2">
          {photos.map((url, i) => (
            <li key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`תמונה ${i + 1}`} className="aspect-square w-full rounded-xl object-cover" />
              <button
                type="button"
                aria-label={`הסרת תמונה ${i + 1}`}
                onClick={() => setPhotos((p) => p.filter((x) => x !== url))}
                className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <li key={`u${i}`} className="grid aspect-square place-items-center rounded-xl bg-surface-2">
              <Loader2 className="size-5 animate-spin text-muted" aria-label="מעלה" />
            </li>
          ))}
        </ul>
      )}

      {showSpecies && (
        <label className="flex flex-col gap-1 text-sm">
          על איזה צמח?
          <select
            value={speciesSlug}
            onChange={(e) => setSpeciesSlug(e.target.value)}
            className="rounded-xl border border-border bg-bg px-3 py-2.5 outline-none focus:border-primary"
          >
            <option value="">בלי תיוג</option>
            {byCategory.map(({ c, items }) => (
              <optgroup key={c} label={CATEGORY_HE[c]}>
                {items.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}

      {error && <p className="text-sm text-accent">{error}</p>}

      <div className="flex flex-wrap items-center gap-1 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={photos.length + uploading >= MAX_POST_PHOTOS}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-primary disabled:opacity-40"
        >
          <ImagePlus className="size-5" aria-hidden />
          תמונה
        </button>
        <button
          type="button"
          onClick={() => setShowSpecies((s) => !s)}
          aria-pressed={showSpecies || Boolean(speciesSlug)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm hover:bg-surface-2",
            speciesSlug ? "text-primary" : "text-muted hover:text-primary",
          )}
        >
          <Leaf className="size-5" aria-hidden />
          צמח
        </button>
        <button
          type="button"
          onClick={() => setType((t) => (t === "question" ? "post" : "question"))}
          aria-pressed={type === "question"}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm hover:bg-surface-2",
            type === "question" ? "bg-water-soft text-text" : "text-muted hover:text-primary",
          )}
        >
          <HelpCircle className="size-5" aria-hidden />
          שאלה
        </button>
        <button
          type="submit"
          disabled={!canPost}
          className="ms-auto flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-semibold text-on-primary hover:bg-primary-strong disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4 rtl:-scale-x-100" aria-hidden />}
          פרסום
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic"
        multiple
        hidden
        onChange={(e) => {
          addPhotos(e.target.files);
          e.target.value = "";
        }}
      />
    </form>
  );
}
