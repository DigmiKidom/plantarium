"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, Plus, Search, X } from "lucide-react";
import { createPlantImageUpload, savePlant } from "@/lib/plants/actions";
import { matchScore } from "@/lib/search/hebrew";
import { MEDIUM_HE } from "@/lib/labels";
import { OTHER_PLANT, PLANT_MEDIUMS, type Place } from "@/lib/plants/types";
import type { SpeciesOption } from "@/components/market/listing-form";
import { uploadImage } from "@/lib/uploads/client";
import { FormAlert } from "@/components/ui/form";
import { PlaceForm } from "./place-form";
import { placeLabel } from "./bits";
import { cn } from "@/lib/cn";

export type PlantFormValues = {
  id?: string;
  speciesSlug: string;
  otherName: string;
  nickname: string;
  placeId: string;
  potCm: string;
  medium: string;
  acquiredOn: string;
  waterEveryDays: string;
  notes: string;
  photoUrl: string | null;
};

const input = "w-full rounded-xl border border-border bg-bg px-3.5 py-3 outline-none focus:border-primary";
const LAST_WATERED = [
  ["today", "היום"],
  ["yesterday", "אתמול"],
  ["days3", "לפני כמה ימים"],
  ["week", "לפני שבוע ויותר"],
  ["unknown", "לא זוכר/ת"],
] as const;
const POTS = [
  [10, "קטן · 10 ס״מ"],
  [16, "בינוני · 16 ס״מ"],
  [24, "גדול · 24 ס״מ"],
  [35, "ענק · 35+ ס״מ"],
] as const;

function Label({ htmlFor, children, required }: { htmlFor?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {children} {required && <span className="text-accent">*</span>}
    </label>
  );
}

function SpeciesPicker({ species, value, onChange }: { species: SpeciesOption[]; value: string; onChange: (slug: string) => void }) {
  const [q, setQ] = useState("");
  const chosen = species.find((s) => s.slug === value);
  const results = useMemo(() => {
    if (!q.trim()) return [];
    return species
      .map((s) => ({ s, score: matchScore(q, [s.name, s.scientific]) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.s);
  }, [q, species]);

  if (chosen || value === OTHER_PLANT) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-leaf-soft px-4 py-3">
        <Check className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{chosen ? chosen.name : "צמח שלא במאגר"}</span>
          {chosen && <span className="ltr block truncate text-start text-xs italic text-muted">{chosen.scientific}</span>}
        </span>
        <button type="button" onClick={() => onChange("")} className="rounded-full px-3 py-1 text-sm text-primary hover:bg-surface">
          החלפה
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id="species"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש: מונסטרה, פיקוס, בזיליקום…"
          aria-label="חיפוש צמח במאגר"
          autoComplete="off"
          className={cn(input, "ps-11")}
        />
      </div>
      {results.length > 0 && (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {results.map((s) => (
            <li key={s.slug}>
              <button type="button" onClick={() => onChange(s.slug)} className="flex w-full items-baseline gap-2 px-4 py-2.5 text-start hover:bg-surface-2">
                <span className="font-medium">{s.name}</span>
                <span className="ltr truncate text-xs italic text-muted">{s.scientific}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && results.length === 0 && <p className="text-sm text-muted">לא נמצא במאגר.</p>}
      <button type="button" onClick={() => onChange(OTHER_PLANT)} className="w-fit text-sm text-primary underline-offset-2 hover:underline">
        הצמח שלי לא במאגר – להוסיף בשם חופשי
      </button>
    </div>
  );
}

export function PlantForm({ species, places: initialPlaces, initial }: { species: SpeciesOption[]; places: Place[]; initial: PlantFormValues }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [places, setPlaces] = useState(initialPlaces);
  const [addingPlace, setAddingPlace] = useState(false);
  const [lastWatered, setLastWatered] = useState<(typeof LAST_WATERED)[number][0]>("today");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof PlantFormValues>(k: K, value: PlantFormValues[K]) => setV((p) => ({ ...p, [k]: value }));

  const addPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(undefined);
    try {
      set("photoUrl", await uploadImage(file, createPlantImageUpload, { maxSide: 1200 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "ההעלאה נכשלה");
    } finally {
      setUploading(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!v.speciesSlug) return setError("נא לבחור צמח");
    if (v.speciesSlug === OTHER_PLANT && v.otherName.trim().length < 2) return setError("נא לכתוב את שם הצמח");
    const potCm = v.potCm ? Number(v.potCm) : null;
    const every = v.waterEveryDays ? Number(v.waterEveryDays) : null;
    start(async () => {
      const res = await savePlant({
        id: v.id,
        speciesSlug: v.speciesSlug,
        otherName: v.otherName,
        nickname: v.nickname,
        placeId: v.placeId || null,
        potCm: potCm && potCm >= 3 ? potCm : null,
        medium: (PLANT_MEDIUMS as readonly string[]).includes(v.medium) ? (v.medium as (typeof PLANT_MEDIUMS)[number]) : null,
        acquiredOn: v.acquiredOn || null,
        waterEveryDays: every && every >= 1 ? Math.round(every) : null,
        notes: v.notes,
        photoUrl: v.photoUrl,
        lastWatered: v.id ? undefined : lastWatered,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/plants/${res.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {/* 1. which plant */}
      <fieldset className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-5">
        <legend className="px-1 text-lg font-bold">איזה צמח?</legend>
        <SpeciesPicker species={species} value={v.speciesSlug} onChange={(slug) => set("speciesSlug", slug)} />
        {v.speciesSlug === OTHER_PLANT && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="otherName" required>
              שם הצמח
            </Label>
            <input id="otherName" value={v.otherName} onChange={(e) => set("otherName", e.target.value)} maxLength={80} placeholder="למשל: פטוניה כפולה" className={input} />
            <p className="text-xs text-muted">לצמח שלא במאגר נשקה פעם בשבוע כברירת מחדל – ואפשר לקבוע קצב משלך למטה.</p>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nickname">כינוי (לא חובה)</Label>
          <input id="nickname" value={v.nickname} onChange={(e) => set("nickname", e.target.value)} maxLength={60} placeholder="למשל: מוני, הפיקוס של סבתא" className={input} />
        </div>
      </fieldset>

      {/* 2. where */}
      <fieldset className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5">
        <legend className="px-1 text-lg font-bold">איפה הוא גר?</legend>
        {places.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {places.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={v.placeId === p.id}
                  onClick={() => set("placeId", v.placeId === p.id ? "" : p.id)}
                  className={cn(
                    "flex w-full flex-col items-start rounded-2xl border px-4 py-3 text-start transition",
                    v.placeId === p.id ? "border-primary bg-leaf-soft" : "border-border hover:bg-surface-2",
                  )}
                >
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-xs text-muted">{placeLabel(p)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {addingPlace ? (
          <div className="rounded-2xl border border-border p-4">
            <PlaceForm
              compact
              onSaved={(p) => {
                setPlaces((prev) => [...prev, p]);
                set("placeId", p.id);
                setAddingPlace(false);
              }}
              onCancel={() => setAddingPlace(false)}
            />
          </div>
        ) : (
          <button type="button" onClick={() => setAddingPlace(true)} className="flex w-fit items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2">
            <Plus className="size-4" aria-hidden />
            מקום חדש (חדר, חלון, מרפסת…)
          </button>
        )}
        <p className="text-xs text-muted">המקום וכיוון החלון עוזרים לנו לדעת כמה אור וחום הצמח מקבל, ולהתאים את ההשקיה.</p>
      </fieldset>

      {/* 3. photo */}
      <fieldset className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5">
        <legend className="px-1 text-lg font-bold">תמונה (לא חובה)</legend>
        <div className="flex items-center gap-4">
          {v.photoUrl ? (
            <span className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.photoUrl} alt="התמונה של הצמח" className="size-24 rounded-2xl object-cover" />
              <button type="button" aria-label="הסרת התמונה" onClick={() => set("photoUrl", null)} className="absolute end-1 top-1 grid size-7 place-items-center rounded-full bg-black/60 text-white">
                <X className="size-4" aria-hidden />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="grid size-24 place-items-center rounded-2xl border-2 border-dashed border-border text-muted hover:border-primary hover:text-primary"
            >
              {uploading ? <Loader2 className="size-6 animate-spin" aria-label="מעלה" /> : <Camera className="size-6" aria-hidden />}
            </button>
          )}
          <p className="text-sm text-muted">בלי תמונה נציג את התמונה מהמאגר.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            addPhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </fieldset>

      {/* 4. last watering (new plants only) */}
      {!v.id && (
        <fieldset className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5">
          <legend className="px-1 text-lg font-bold">מתי השקית אותו לאחרונה?</legend>
          <div className="flex flex-wrap gap-2">
            {LAST_WATERED.map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={lastWatered === k}
                onClick={() => setLastWatered(k)}
                className={cn("rounded-full border px-4 py-2 text-sm", lastWatered === k ? "border-primary bg-leaf-soft font-semibold text-primary-strong" : "border-border hover:bg-surface-2")}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">מכאן מתחיל לוח ההשקיה.</p>
        </fieldset>
      )}

      {/* 5. more details */}
      <details className="group rounded-3xl border border-border bg-surface p-5" open={Boolean(v.id)}>
        <summary className="cursor-pointer list-none text-lg font-bold">
          עוד פרטים <span className="text-sm font-normal text-muted">(עציץ, מצע, קצב השקיה)</span>
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pot">גודל העציץ (קוטר)</Label>
            <div className="flex flex-wrap gap-2">
              {POTS.map(([cm, label]) => (
                <button
                  key={cm}
                  type="button"
                  aria-pressed={v.potCm === String(cm)}
                  onClick={() => set("potCm", v.potCm === String(cm) ? "" : String(cm))}
                  className={cn("rounded-full border px-3.5 py-1.5 text-sm", v.potCm === String(cm) ? "border-primary bg-leaf-soft font-semibold" : "border-border hover:bg-surface-2")}
                >
                  {label}
                </button>
              ))}
              <input
                id="pot"
                type="number"
                inputMode="numeric"
                min={3}
                max={300}
                value={v.potCm}
                onChange={(e) => set("potCm", e.target.value)}
                placeholder="ס״מ"
                aria-label="קוטר העציץ בס״מ"
                className="w-24 rounded-full border border-border bg-bg px-3.5 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="medium">מצע</Label>
              <select id="medium" value={v.medium} onChange={(e) => set("medium", e.target.value)} className={input}>
                <option value="">לא ידוע</option>
                {PLANT_MEDIUMS.map((m) => (
                  <option key={m} value={m}>
                    {MEDIUM_HE[m] ?? m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acquired">מתי הגיע אליך</Label>
              <input id="acquired" type="date" value={v.acquiredOn} onChange={(e) => set("acquiredOn", e.target.value)} className={input} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="every">קצב השקיה משלך</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm">כל</span>
              <input
                id="every"
                type="number"
                inputMode="numeric"
                min={1}
                max={90}
                value={v.waterEveryDays}
                onChange={(e) => set("waterEveryDays", e.target.value)}
                placeholder="—"
                className="w-20 rounded-xl border border-border bg-bg px-3 py-2 text-center outline-none focus:border-primary"
              />
              <span className="text-sm">ימים</span>
            </div>
            <p className="text-xs text-muted">משאירים ריק – ונחשב לבד לפי הצמח, העונה, המקום ומזג האוויר (מומלץ).</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">הערות</Label>
            <textarea id="notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} rows={3} className={input} />
          </div>
        </div>
      </details>

      <FormAlert error={error} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || uploading}
          className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-on-primary hover:bg-primary-strong disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {v.id ? "שמירת השינויים" : "הוספה לצמחים שלי"}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-full px-5 py-3 text-muted hover:bg-surface-2">
          ביטול
        </button>
      </div>
    </form>
  );
}
