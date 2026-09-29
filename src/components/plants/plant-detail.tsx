"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Droplets,
  FlaskConical,
  Loader2,
  MapPin,
  MoveLeft,
  Pencil,
  RotateCw,
  Scissors,
  SprayCan,
  Bug,
  Shovel,
  StickyNote,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { betterPlace, climateAlerts, fertilizePlan, lightFit, relDay, waterPlan, agoHe } from "@/lib/plants/care";
import { deleteCareEvents, deletePlant, logCare } from "@/lib/plants/actions";
import { CARE_HE, type CareEvent, type CareEventType, type MyPlant, type Place } from "@/lib/plants/types";
import { LIGHT_HE, MEDIUM_HE } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/dates";
import { useWeather } from "./use-weather";
import { CareButton } from "./care-button";
import { PlantThumb, WATER_TONE, placeLabel } from "./bits";
import { cn } from "@/lib/cn";

const CARE_ICON: Record<CareEventType, LucideIcon> = {
  water: Droplets,
  fertilize: FlaskConical,
  mist: SprayCan,
  prune: Scissors,
  repot: Shovel,
  rotate: RotateCw,
  treat: Bug,
  note: StickyNote,
};
const QUICK: CareEventType[] = ["mist", "prune", "repot", "rotate", "treat"];

function NoteBox({ plantId }: { plantId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const save = () =>
    start(async () => {
      const res = await logCare({ plantIds: [plantId], type: "note", note: text });
      if (!res.ok) return setError(res.error);
      setText("");
      setError(undefined);
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="הערה ליומן: עלה חדש, כתם צהוב, פריחה…"
          className="min-w-0 flex-1 rounded-full border border-border bg-bg px-4 py-2 text-sm outline-none focus:border-primary"
          onKeyDown={(e) => e.key === "Enter" && text.trim() && (e.preventDefault(), save())}
        />
        <button type="button" onClick={save} disabled={pending || !text.trim()} className="rounded-full bg-surface-2 px-4 py-2 text-sm font-medium hover:text-primary disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "הוספה"}
        </button>
      </div>
      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  );
}

function History({ events }: { events: CareEvent[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!events.length) return <p className="text-sm text-muted">עוד אין פעולות ביומן.</p>;
  return (
    <ol className="relative flex flex-col gap-3 border-s-2 border-border ps-5">
      {events.map((e) => {
        const Icon = CARE_ICON[e.type] ?? StickyNote;
        return (
          <li key={e.id} className="group relative flex items-start gap-3">
            <span className="absolute -start-[1.95rem] grid size-7 place-items-center rounded-full border-2 border-bg bg-leaf-soft text-primary">
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <span className="font-medium">{CARE_HE[e.type] ?? e.type}</span>
              <span className="text-muted"> · {formatDateTime(e.occurredAt)}</span>
              {e.note && <p className="whitespace-pre-line">{e.note}</p>}
            </div>
            <button
              type="button"
              disabled={pending}
              aria-label="מחיקה מהיומן"
              onClick={() =>
                start(async () => {
                  await deleteCareEvents([e.id]);
                  router.refresh();
                })
              }
              className="grid size-7 place-items-center rounded-full text-muted opacity-60 hover:bg-accent-soft hover:text-accent group-hover:opacity-100"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function PlantDetail({ plant, place, places, history }: { plant: MyPlant; place: Place | null; places: Place[]; history: CareEvent[] }) {
  const router = useRouter();
  const { now, weather } = useWeather();
  const [deleting, startDelete] = useTransition();
  const plan = now ? waterPlan(plant, place, now, weather) : null;
  const fert = now ? fertilizePlan(plant, now) : null;
  const fit = lightFit(plant.care?.light, place);
  const better = fit.fit === "good" ? null : betterPlace(plant.care?.light, place, places);
  const alerts = now ? climateAlerts(plant, place, weather, now).filter((a) => a.kind !== "light") : [];

  const remove = () => {
    if (!confirm(`למחוק את ${plant.name} וכל היומן שלו?`)) return;
    startDelete(async () => {
      const res = await deletePlant(plant.id);
      if (res.ok) {
        router.push("/plants");
        router.refresh();
      }
    });
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link href="/plants" className="flex w-fit items-center gap-1 text-sm text-muted hover:text-primary">
        <MoveLeft className="size-4 rotate-180" aria-hidden />
        הצמחים שלי
      </Link>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <PlantThumb url={plant.photoUrl} name={plant.name} className="aspect-square w-full rounded-3xl sm:w-44" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="text-3xl font-bold">{plant.name}</h1>
          {plant.name !== plant.speciesName && <p className="text-lg text-muted">{plant.speciesName}</p>}
          {plant.scientificName && (
            <p className="text-sm italic text-muted">
              <span className="ltr">{plant.scientificName}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1">
              <MapPin className="size-4 text-primary" aria-hidden />
              {place ? `${place.name} · ${placeLabel(place)}` : "בלי מקום"}
            </span>
            {plant.potCm && <span className="rounded-full bg-surface-2 px-3 py-1">עציץ {plant.potCm} ס״מ</span>}
            {plant.medium && <span className="rounded-full bg-surface-2 px-3 py-1">{MEDIUM_HE[plant.medium] ?? plant.medium}</span>}
            {plant.acquiredOn && <span className="rounded-full bg-surface-2 px-3 py-1">איתך מ־{formatDate(plant.acquiredOn)}</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {plant.speciesSlug && (
              <Link href={`/magazine/plants/${plant.speciesSlug}`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm hover:bg-surface-2">
                <BookOpen className="size-4" aria-hidden />
                מדריך הגידול
              </Link>
            )}
            <Link href={`/plants/${plant.id}/edit`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm hover:bg-surface-2">
              <Pencil className="size-4" aria-hidden />
              עריכה
            </Link>
            <button type="button" onClick={remove} disabled={deleting} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm text-muted hover:bg-accent-soft hover:text-accent">
              <Trash2 className="size-4" aria-hidden />
              מחיקה
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Water */}
        <section className={cn("flex flex-col gap-2 rounded-3xl p-5", plan ? WATER_TONE[plan.rainSkip ? "ok" : plan.status] : "bg-surface-2")}>
          <h2 className="flex items-center gap-2 font-bold">
            <Droplets className="size-5" aria-hidden />
            השקיה
          </h2>
          {plan ? (
            <>
              <p className="text-2xl font-bold">{plan.rainSkip ? "אפשר לדלג – ירד גשם" : plan.status === "unknown" ? "עוד לא תועד" : relDay(plan.daysLeft)}</p>
              <p className="text-sm opacity-80">
                הושקה {agoHe(plan.lastAt, now!)} · כל ~{plan.every} ימים
              </p>
              <CareButton plantIds={[plant.id]} variant="solid" className="mt-1" />
            </>
          ) : (
            <span className="h-16 animate-pulse rounded-xl bg-surface/60" aria-hidden />
          )}
        </section>

        {/* Fertilize */}
        <section className="flex flex-col gap-2 rounded-3xl bg-sun-soft p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <FlaskConical className="size-5" aria-hidden />
            דישון
          </h2>
          {fert && (
            <>
              <p className="text-2xl font-bold">{fert.active ? (plant.lastFertilizeAt ? relDay(fert.daysLeft) : "אפשר לדשן") : "מנוחה"}</p>
              <p className="text-sm opacity-80">{fert.he}</p>
              {fert.active && <CareButton plantIds={[plant.id]} type="fertilize" label="דישנתי" icon={FlaskConical} className="mt-1" />}
            </>
          )}
        </section>

        {/* Light */}
        <section className={cn("flex flex-col gap-2 rounded-3xl p-5", fit.fit === "good" ? "bg-leaf-soft" : fit.fit === "unknown" ? "bg-surface-2" : "bg-accent-soft")}>
          <h2 className="font-bold">אור ומיקום</h2>
          <p className="text-lg font-bold">{fit.fit === "good" ? "מקום מתאים" : fit.fit === "dark" ? "חסר אור" : fit.fit === "bright" ? "יותר מדי שמש" : plant.care ? LIGHT_HE[plant.care.light] : "לא ידוע"}</p>
          <p className="text-sm">{fit.fit === "unknown" ? fit.he : plant.care ? `הצמח צריך ${LIGHT_HE[plant.care.light]}` : ""}</p>
          {fit.tip && <p className="text-sm">{fit.tip}</p>}
          {better && <p className="text-sm font-semibold">הצעה: להעביר ל{better.name}</p>}
        </section>
      </div>

      {plan && plan.reasons.length > 0 && (
        <details className="rounded-3xl border border-border bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-medium">איך חישבנו את קצב ההשקיה?</summary>
          <ul className="mt-2 list-disc ps-5 text-muted">
            {plan.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      )}

      {alerts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">שימו לב בימים הקרובים</h2>
          <ul className="flex flex-col gap-2">
            {alerts.map((a, i) => (
              <li key={i} className={cn("rounded-2xl px-4 py-3 text-sm", a.level === "warn" ? "bg-accent-soft text-accent" : "bg-surface-2")}>
                {a.he}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-5">
        <h2 className="text-lg font-bold">יומן הטיפול</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((t) => (
            <CareButton key={t} plantIds={[plant.id]} type={t} label={CARE_HE[t]} icon={CARE_ICON[t]} className="[&>button]:!bg-surface-2 [&>button]:!text-text" />
          ))}
        </div>
        <NoteBox plantId={plant.id} />
        <History events={history} />
      </section>

      {plant.notes && (
        <section className="rounded-3xl border border-border bg-surface p-5">
          <h2 className="mb-1 font-bold">הערות</h2>
          <p className="whitespace-pre-line text-sm">{plant.notes}</p>
        </section>
      )}
    </div>
  );
}
