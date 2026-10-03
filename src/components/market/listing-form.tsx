"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createListingImageUpload, saveListing } from "@/lib/market/actions";
import { CONDITIONS, CONDITION_HE, OTHER_SPECIES, PLANT_MARKET_CATEGORIES, SIZES, SIZE_HE, SUPPLY_CATEGORIES, isSupplyCategory, type Condition, type MarketCategory, type Size } from "@/lib/market/types";
import type { Category } from "@/lib/species/types";
import { uploadImage } from "@/lib/uploads/client";
import { FormAlert } from "@/components/ui/form";
import { cn } from "@/lib/cn";

export type SpeciesOption = { slug: string; name: string; scientific: string; category: Category };
export type ListingFormValues = {
  id?: string;
  category: MarketCategory | "";
  /** A species slug, or OTHER_SPECIES with otherName. */
  speciesSlug: string;
  otherName: string;
  price: string;
  size: Size | "";
  condition?: Condition | "";
  city: string;
  description: string;
  photos: string[];
  phone: string;
  whatsapp: boolean;
};

const input = "w-full rounded-xl border border-border bg-bg px-3.5 py-3 outline-none focus:border-primary";
const MAX_PHOTOS = 6;

function Label({ htmlFor, children, required }: { htmlFor?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {children} {required && <span className="text-accent">*</span>}
    </label>
  );
}

export function ListingForm({
  species,
  initial,
  quota,
}: {
  species: SpeciesOption[];
  initial: ListingFormValues;
  quota?: { used: number; limit: number };
}) {
  const router = useRouter();
  const [category, setCategory] = useState<MarketCategory | "">(
    initial.category || (species.find((s) => s.slug === initial.speciesSlug)?.category ?? ""),
  );
  const [v, setV] = useState(initial);
  const [free, setFree] = useState(initial.price === "0");
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ListingFormValues>(k: K, value: ListingFormValues[K]) => setV((prev) => ({ ...prev, [k]: value }));
  const inCategory = useMemo(
    () => species.filter((s) => s.category === category).sort((a, b) => a.name.localeCompare(b.name, "he")),
    [species, category],
  );
  const chosen = species.find((s) => s.slug === v.speciesSlug);
  const supply = isSupplyCategory(category);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - v.photos.length;
    const list = Array.from(files).slice(0, room);
    setError(undefined);
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        const url = await uploadImage(file, createListingImageUpload);
        setV((prev) => ({ ...prev, photos: [...prev.photos, url].slice(0, MAX_PHOTOS) }));
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
    const price = free ? 0 : Number(v.price);
    if (!category) return setError("נא לבחור קטגוריה");
    if (!supply && !v.speciesSlug) return setError("נא לבחור צמח מהרשימה, או ״אחר – לא ברשימה״");
    if (supply && v.otherName.trim().length < 2) return setError("נא לכתוב מה מוכרים (שם הפריט)");
    if (!free && (v.price.trim() === "" || !Number.isFinite(price))) return setError("נא להזין מחיר, או לסמן ״למסירה בחינם״");
    startTransition(async () => {
      const res = await saveListing({
        id: v.id,
        category,
        speciesSlug: supply ? OTHER_SPECIES : v.speciesSlug,
        otherName: v.otherName,
        price: Math.round(price),
        size: supply ? null : v.size || null,
        condition: v.condition || null,
        city: v.city,
        description: v.description,
        photos: v.photos,
        phone: v.phone,
        whatsapp: v.whatsapp,
      });
      if (!res.ok) {
        setError(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push(`/market/l/${res.id}`);
      router.refresh();
    });
  };

  const atLimit = !v.id && quota && quota.used >= quota.limit;

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {quota && !v.id && (
        <p className={cn("rounded-2xl px-4 py-3 text-sm", atLimit ? "bg-accent-soft text-accent" : "bg-surface-2")}>
          {atLimit
            ? `הגעת למכסה: ${quota.limit} מודעות פעילות. סמנו מודעה כ״נמכר״ או מחקו אחת כדי לפרסם חדשה.`
            : `מודעות פעילות: ${quota.used} מתוך ${quota.limit}`}
        </p>
      )}
      <FormAlert error={error} />

      {/* 1. What's for sale */}
      <fieldset className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-5">
        <legend className="px-1 text-lg font-bold">מה מוכרים?</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category" required>
              קטגוריה
            </Label>
            <select
              id="category"
              value={category}
              onChange={(e) => {
                const c = e.target.value as MarketCategory;
                setCategory(c);
                set("speciesSlug", isSupplyCategory(c) ? OTHER_SPECIES : "");
              }}
              className={input}
            >
              <option value="">בחרו קטגוריה</option>
              <optgroup label="צמחים">
                {PLANT_MARKET_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.he}
                  </option>
                ))}
              </optgroup>
              <optgroup label="ציוד וחומרים">
                {SUPPLY_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.he}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          {!supply && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="species" required>
                זן
              </Label>
              <select id="species" value={v.speciesSlug} onChange={(e) => set("speciesSlug", e.target.value)} disabled={!category} className={input}>
                <option value="">{category ? "בחרו צמח" : "קודם בוחרים קטגוריה"}</option>
                {inCategory.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name} · {s.scientific}
                  </option>
                ))}
                {category && <option value={OTHER_SPECIES}>אחר – לא ברשימה</option>}
              </select>
            </div>
          )}
          {supply && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="otherName" required>
                שם הפריט
              </Label>
              <input
                id="otherName"
                value={v.otherName}
                onChange={(e) => set("otherName", e.target.value)}
                maxLength={80}
                placeholder={SUPPLY_CATEGORIES.find((c) => c.key === category)?.hint.split(",")[0] ?? "למשל: עציץ טרקוטה 30 ס״מ"}
                className={input}
              />
            </div>
          )}
        </div>
        {supply && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">מצב</span>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={v.condition === c}
                  onClick={() => set("condition", v.condition === c ? "" : c)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm",
                    v.condition === c ? "border-primary bg-leaf-soft font-semibold text-primary-strong" : "border-border hover:bg-surface-2",
                  )}
                >
                  {CONDITION_HE[c]}
                </button>
              ))}
            </div>
          </div>
        )}
        {!supply && v.speciesSlug === OTHER_SPECIES && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="otherName" required>
              שם הצמח
            </Label>
            <input
              id="otherName"
              value={v.otherName}
              onChange={(e) => set("otherName", e.target.value)}
              maxLength={80}
              placeholder="למשל: פטוניה כפולה"
              className={input}
            />
            <p className="text-xs text-muted">צמחים שלא במאגר מופיעים בקטגוריה תחת ״אחר״, בלי מדריך גידול.</p>
          </div>
        )}
        {!supply && chosen && v.speciesSlug !== OTHER_SPECIES && (
          <p className="text-sm text-muted">
            המודעה תקושר לדף הצמח <span className="font-medium text-text">{chosen.name}</span> במאגר, עם כל הוראות הגידול.
          </p>
        )}
      </fieldset>

      {/* 2. Photos */}
      <fieldset className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5">
        <legend className="px-1 text-lg font-bold">
          תמונות <span className="text-accent">*</span>
        </legend>
        <p className="text-sm text-muted">1 עד {MAX_PHOTOS} תמונות. הראשונה תופיע בטבלה.</p>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {v.photos.map((url, i) => (
            <li key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`תמונה ${i + 1}`} className="aspect-square w-full rounded-xl object-cover" />
              <button
                type="button"
                aria-label={`הסרת תמונה ${i + 1}`}
                onClick={() => set("photos", v.photos.filter((p) => p !== url))}
                className="absolute end-1 top-1 grid size-7 place-items-center rounded-full bg-black/60 text-white"
              >
                <X className="size-4" aria-hidden />
              </button>
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

      {/* 3. Details */}
      <fieldset className="grid gap-4 rounded-3xl border border-border bg-surface p-5 md:grid-cols-2">
        <legend className="px-1 text-lg font-bold">פרטים</legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="price" required>
            מחיר (₪)
          </Label>
          <input
            id="price"
            type="number"
            inputMode="numeric"
            min={0}
            max={100000}
            value={free ? "" : v.price}
            disabled={free}
            onChange={(e) => set("price", e.target.value)}
            placeholder={free ? "למסירה" : "80"}
            className={cn(input, "ltr text-start")}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} />
            למסירה בחינם
          </label>
        </div>
        <div className={cn("flex flex-col gap-1.5", supply && "hidden")}>
          <Label htmlFor="size">גודל</Label>
          <select id="size" value={v.size} onChange={(e) => set("size", e.target.value as Size | "")} className={input}>
            <option value="">לא צוין</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {SIZE_HE[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="city">עיר / אזור איסוף</Label>
          <input id="city" value={v.city} onChange={(e) => set("city", e.target.value)} maxLength={60} placeholder="למשל חיפה" className={input} />
        </div>
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <Label htmlFor="description">תיאור (לא חובה)</Label>
          <textarea
            id="description"
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder={supply ? "מידות, כמות, מותג, מצב…" : "גיל הצמח, מצב, עציץ כלול, סיבת המכירה…"}
            className={cn(input, "resize-y")}
          />
        </div>
      </fieldset>

      {/* 4. Contact */}
      <fieldset className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5">
        <legend className="px-1 text-lg font-bold">
          יצירת קשר <span className="text-accent">*</span>
        </legend>
        <p className="text-sm text-muted">מספר הטלפון מוצג רק למשתמשים מחוברים.</p>
        <div className="flex max-w-sm flex-col gap-1.5">
          <Label htmlFor="phone" required>
            טלפון
          </Label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={v.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="050-1234567"
            className={cn(input, "ltr text-start")}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.whatsapp} onChange={(e) => set("whatsapp", e.target.checked)} />
            אפשר לפנות גם בוואטסאפ
          </label>
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending || uploading > 0 || Boolean(atLimit)}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-on-primary hover:bg-primary-strong disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {v.id ? "שמירת שינויים" : "פרסום המודעה"}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-full border border-border px-6 py-3 hover:bg-surface-2">
          ביטול
        </button>
      </div>
    </form>
  );
}
