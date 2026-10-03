"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { createSpeciesImageUpload } from "@/lib/species/actions";
import {
  CATEGORY_KEYS,
  DIFFICULTY_KEYS,
  FERTILIZE_SEASONS,
  GROWTH_KEYS,
  LIGHT_KEYS,
  MEDIUM_KEYS,
  type SpeciesFormValues,
} from "@/lib/species/form-schema";
import { CATEGORY_HE, DIFFICULTY_HE, GROWTH_HE, LIGHT_HE, MEDIUM_HE, TAG_HE } from "@/lib/labels";
import { uploadImage } from "@/lib/uploads/client";
import { FormAlert } from "@/components/ui/form";
import { cn } from "@/lib/cn";

type SubmitResult = { ok: true; slug?: string; id?: string } | { ok: false; error: string };
const MAX_PHOTOS = 8;
const box = "w-full rounded-xl border border-border bg-bg px-3 py-2.5 outline-none focus:border-primary";

function F({ label, children, hint, wide }: { label: string; children: React.ReactNode; hint?: string; wide?: boolean }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm", wide && "md:col-span-2")}>
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-3xl border border-border bg-surface p-5 md:grid-cols-2">
      <legend className="px-1 text-lg font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

/**
 * The plant form: admins edit plants and approve suggestions with it; authors suggest new plants.
 * `onSubmit` is a server action; after success we go to the plant page (slug) or to `doneHref`.
 */
export function SpeciesForm({
  initial,
  onSubmit,
  submitLabel,
  doneHref,
  intro,
}: {
  initial: SpeciesFormValues;
  onSubmit: (v: SpeciesFormValues) => Promise<SubmitResult>;
  submitLabel: string;
  doneHref?: string;
  intro?: React.ReactNode;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [otherNames, setOtherNames] = useState(initial.other_names_he.join(", "));
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof SpeciesFormValues>(k: K, value: SpeciesFormValues[K]) => setV((p) => ({ ...p, [k]: value }));
  const num = (k: keyof SpeciesFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, (e.target.value === "" ? 0 : Number(e.target.value)) as never);
  const toggle = <K extends "tags" | "medium">(k: K, item: SpeciesFormValues[K][number]) =>
    setV((p) => {
      const list = p[k] as string[];
      return { ...p, [k]: list.includes(item) ? list.filter((x) => x !== item) : [...list, item] };
    });

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, MAX_PHOTOS - v.photos.length);
    setUploading((n) => n + list.length);
    for (const f of list) {
      try {
        const url = await uploadImage(f, createSpeciesImageUpload);
        setV((p) => ({ ...p, photos: [...p.photos, url].slice(0, MAX_PHOTOS) }));
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
    const values = {
      ...v,
      other_names_he: otherNames.split(/[,،]/).map((x) => x.trim()).filter(Boolean),
    };
    startTransition(async () => {
      const res = await onSubmit(values);
      if (!res.ok) {
        setError(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push(res.slug ? `/magazine/plants/${res.slug}` : (doneHref ?? "/magazine/plants"));
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {intro}
      <FormAlert error={error} />

      <Section title="שמות וסיווג">
        <F label="שם בעברית *">
          <input value={v.common_name_he} onChange={(e) => set("common_name_he", e.target.value)} maxLength={80} className={box} />
        </F>
        <F label="שם מדעי *" hint="באותיות לטיניות, למשל Monstera deliciosa">
          <input dir="ltr" value={v.scientific_name} onChange={(e) => set("scientific_name", e.target.value)} maxLength={120} className={cn(box, "text-start")} />
        </F>
        <F label="שמות נוספים" hint="מופרדים בפסיקים">
          <input value={otherNames} onChange={(e) => setOtherNames(e.target.value)} className={box} />
        </F>
        <F label="שם באנגלית">
          <input dir="ltr" value={v.common_name_en} onChange={(e) => set("common_name_en", e.target.value)} className={cn(box, "text-start")} />
        </F>
        <F label="משפחה">
          <input dir="ltr" value={v.family} onChange={(e) => set("family", e.target.value)} className={cn(box, "text-start")} />
        </F>
        <F label="קטגוריה *">
          <select value={v.category} onChange={(e) => set("category", e.target.value as SpeciesFormValues["category"])} className={box}>
            {CATEGORY_KEYS.map((k) => (
              <option key={k} value={k}>
                {CATEGORY_HE[k]}
              </option>
            ))}
          </select>
        </F>
        <F label="רמת קושי">
          <select value={v.difficulty} onChange={(e) => set("difficulty", e.target.value as SpeciesFormValues["difficulty"])} className={box}>
            {DIFFICULTY_KEYS.map((k) => (
              <option key={k} value={k}>
                {DIFFICULTY_HE[k]}
              </option>
            ))}
          </select>
        </F>
        <F label="קצב גדילה">
          <select value={v.growth_rate} onChange={(e) => set("growth_rate", e.target.value as SpeciesFormValues["growth_rate"])} className={box}>
            {GROWTH_KEYS.map((k) => (
              <option key={k} value={k}>
                {GROWTH_HE[k]}
              </option>
            ))}
          </select>
        </F>
      </Section>

      <Section title="תיאור">
        <F label="תקציר *" hint="משפט או שניים שמופיעים בכרטיס הצמח" wide>
          <textarea value={v.summary_he} onChange={(e) => set("summary_he", e.target.value)} maxLength={400} rows={3} className={cn(box, "resize-y")} />
        </F>
        <F label="אזור מוצא">
          <input value={v.native_region_he} onChange={(e) => set("native_region_he", e.target.value)} className={box} />
        </F>
        <F label="גובה מרבי (ס״מ)">
          <input type="number" dir="ltr" value={v.max_height_cm} onChange={num("max_height_cm")} className={cn(box, "text-start")} />
        </F>
        <F label="בטיחות לחיות מחמד">
          <select value={v.is_toxic_pets} onChange={(e) => set("is_toxic_pets", e.target.value as SpeciesFormValues["is_toxic_pets"])} className={box}>
            <option value="unknown">לא ידוע</option>
            <option value="no">בטוח</option>
            <option value="yes">רעיל</option>
          </select>
        </F>
      </Section>

      <Section title="אור ומים">
        <F label="אור">
          <select value={v.light} onChange={(e) => set("light", e.target.value as SpeciesFormValues["light"])} className={box}>
            {LIGHT_KEYS.map((k) => (
              <option key={k} value={k}>
                {LIGHT_HE[k]}
              </option>
            ))}
          </select>
        </F>
        <F label="הערות לאור">
          <input value={v.light_notes_he} onChange={(e) => set("light_notes_he", e.target.value)} className={box} />
        </F>
        <F label="השקיה כל (ימים, מינימום–מקסימום)">
          <span className="flex items-center gap-2">
            <input type="number" dir="ltr" value={v.water_min} onChange={num("water_min")} className={cn(box, "text-start")} aria-label="מינימום ימים" />
            <span>–</span>
            <input type="number" dir="ltr" value={v.water_max} onChange={num("water_max")} className={cn(box, "text-start")} aria-label="מקסימום ימים" />
          </span>
        </F>
        <F label="הערות להשקיה">
          <input value={v.water_notes_he} onChange={(e) => set("water_notes_he", e.target.value)} className={box} />
        </F>
      </Section>

      <Section title="אקלים">
        <F label="לחות (%)">
          <span className="flex items-center gap-2">
            <input type="number" dir="ltr" value={v.humidity_min} onChange={num("humidity_min")} className={cn(box, "text-start")} aria-label="לחות מינימלית" />
            <span>–</span>
            <input type="number" dir="ltr" value={v.humidity_max} onChange={num("humidity_max")} className={cn(box, "text-start")} aria-label="לחות מרבית" />
          </span>
        </F>
        <F label="טמפרטורה (°C)">
          <span className="flex items-center gap-2">
            <input type="number" dir="ltr" value={v.temp_min} onChange={num("temp_min")} className={cn(box, "text-start")} aria-label="טמפרטורה מינימלית" />
            <span>–</span>
            <input type="number" dir="ltr" value={v.temp_max} onChange={num("temp_max")} className={cn(box, "text-start")} aria-label="טמפרטורה מרבית" />
          </span>
        </F>
      </Section>

      <Section title="דישון ומצע">
        <F label="דישון כל (ימים)" hint="0 = לא צריך">
          <input type="number" dir="ltr" value={v.fertilize_days} onChange={num("fertilize_days")} className={cn(box, "text-start")} />
        </F>
        <F label="עונת דישון">
          <select value={v.fertilize_season} onChange={(e) => set("fertilize_season", e.target.value as SpeciesFormValues["fertilize_season"])} className={box}>
            {Object.entries(FERTILIZE_SEASONS).map(([k, he]) => (
              <option key={k} value={k}>
                {he}
              </option>
            ))}
          </select>
        </F>
        <div className="flex flex-col gap-1.5 text-sm md:col-span-2">
          <span className="font-medium">מצע *</span>
          <div className="flex flex-wrap gap-2">
            {MEDIUM_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={v.medium.includes(k)}
                onClick={() => toggle("medium", k)}
                className={cn("rounded-full border px-3 py-1.5", v.medium.includes(k) ? "border-primary bg-leaf-soft font-medium text-primary-strong" : "border-border hover:bg-surface-2")}
              >
                {MEDIUM_HE[k]}
              </button>
            ))}
          </div>
        </div>
        <F label="הערות למצע" wide>
          <input value={v.medium_notes_he} onChange={(e) => set("medium_notes_he", e.target.value)} className={box} />
        </F>
      </Section>

      <Section title="גיזום וריבוי">
        <F label="גיזום">
          <textarea value={v.pruning_he} onChange={(e) => set("pruning_he", e.target.value)} rows={3} maxLength={500} className={cn(box, "resize-y")} />
        </F>
        <F label="ריבוי">
          <textarea value={v.propagation_he} onChange={(e) => set("propagation_he", e.target.value)} rows={3} maxLength={500} className={cn(box, "resize-y")} />
        </F>
      </Section>

      <fieldset className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5">
        <legend className="px-1 text-lg font-bold">תגיות</legend>
        <p className="text-sm text-muted">התגיות קובעות חלק מהסמלים הצבעוניים בכרטיס (פורח, ריחני, אוהב לחות…)</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(TAG_HE).map(([k, he]) => (
            <button
              key={k}
              type="button"
              aria-pressed={v.tags.includes(k)}
              onClick={() => toggle("tags", k)}
              className={cn("rounded-full border px-3 py-1 text-sm", v.tags.includes(k) ? "border-primary bg-leaf-soft font-medium text-primary-strong" : "border-border hover:bg-surface-2")}
            >
              {he}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5">
        <legend className="px-1 text-lg font-bold">תמונות</legend>
        <p className="text-sm text-muted">עד {MAX_PHOTOS} תמונות. הראשונה (מסומנת בכוכב) היא התמונה הראשית.</p>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {v.photos.map((url, i) => (
            <li key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`תמונה ${i + 1}`} className={cn("aspect-square w-full rounded-xl object-cover", i === 0 && "ring-2 ring-primary")} />
              <span className="absolute inset-x-1 top-1 flex justify-between">
                <button
                  type="button"
                  title="תמונה ראשית"
                  aria-label={`הפיכת תמונה ${i + 1} לראשית`}
                  onClick={() => set("photos", [url, ...v.photos.filter((p) => p !== url)])}
                  className={cn("grid size-7 place-items-center rounded-full", i === 0 ? "bg-primary text-on-primary" : "bg-black/60 text-white")}
                >
                  <Star className="size-4" fill={i === 0 ? "currentColor" : "none"} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`הסרת תמונה ${i + 1}`}
                  onClick={() => set("photos", v.photos.filter((p) => p !== url))}
                  className="grid size-7 place-items-center rounded-full bg-black/60 text-white"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </span>
            </li>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <li key={`u${i}`} className="grid aspect-square place-items-center rounded-xl bg-surface-2">
              <Loader2 className="size-6 animate-spin text-muted" aria-label="מעלה" />
            </li>
          ))}
          {v.photos.length + uploading < MAX_PHOTOS && (
            <li>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid aspect-square w-full place-items-center rounded-xl border-2 border-dashed border-border text-muted hover:border-primary hover:text-primary"
              >
                <span className="flex flex-col items-center gap-1 text-xs">
                  <ImagePlus className="size-6" aria-hidden />
                  הוספה
                </span>
              </button>
            </li>
          )}
        </ul>
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
      </fieldset>

      <div className="sticky bottom-20 z-10 flex gap-3 rounded-2xl border border-border bg-surface/95 p-3 backdrop-blur md:bottom-4">
        <button
          type="submit"
          disabled={pending || uploading > 0}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-semibold text-on-primary hover:bg-primary-strong disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {submitLabel}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-full border border-border px-6 py-2.5 hover:bg-surface-2">
          ביטול
        </button>
      </div>
    </form>
  );
}
