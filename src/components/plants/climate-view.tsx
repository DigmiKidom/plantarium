"use client";

import Link from "next/link";
import { CloudRain, Droplets, Flame, LocateFixed, MoveLeft, Snowflake, Sun, SunDim, ThermometerSun, Umbrella, type LucideIcon } from "lucide-react";
import { betterPlace, climateAlerts, lightFit, placeLight, suggestFor, type Alert } from "@/lib/plants/care";
import { LIGHT_HE, DIFFICULTY_HE } from "@/lib/labels";
import type { MyPlant, Place, SpeciesPick } from "@/lib/plants/types";
import type { Weather } from "@/lib/weather/types";
import { PLACE_ICON, PlantThumb, placeLabel } from "./bits";
import type { WeatherState } from "./use-weather";
import { cn } from "@/lib/cn";

const ALERT_ICON: Record<Alert["kind"], LucideIcon> = { cold: Snowflake, heat: Flame, dry: Droplets, sun: Sun, rain: Umbrella, light: SunDim };
const ALERT_TONE: Record<Alert["kind"], string> = {
  cold: "bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300",
  heat: "bg-red-100 text-red-600 dark:bg-red-400/15 dark:text-red-300",
  dry: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  sun: "bg-orange-100 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300",
  rain: "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  light: "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
};
const dayName = (i: number, date: string) =>
  i === 0 ? "היום" : i === 1 ? "מחר" : new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(new Date(`${date}T12:00:00`));

function WeatherCard({ ws }: { ws: WeatherState }) {
  const w = ws.weather;
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ThermometerSun className="size-5 text-primary" aria-hidden />
          מזג האוויר אצלך{ws.city ? ` · ${ws.city}` : ""}
        </h2>
        <button type="button" onClick={ws.locate} disabled={ws.locating} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-primary disabled:animate-pulse">
          <LocateFixed className="size-4" aria-hidden />
          לפי המיקום שלי
        </button>
      </div>
      {w ? (
        <>
          <p className="text-sm text-muted">
            עכשיו <span className="ltr font-semibold text-text">{w.temp}°</span> · לחות <span className="ltr font-semibold text-text">{w.humidity}%</span> · UV{" "}
            <span className="ltr font-semibold text-text">{w.uv}</span>
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {(w.days.length ? w.days : [{ date: "", max: w.max, min: w.min, rain: 0, rainChance: 0 }]).map((d, i) => (
              <li key={i} className="flex flex-col items-center gap-1 rounded-2xl bg-surface-2 p-3 text-center">
                <span className="text-xs font-medium">{dayName(i, d.date)}</span>
                <span className="ltr text-lg font-bold tabular-nums">
                  {d.max}° <span className="text-sm font-normal text-muted">/ {d.min}°</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <CloudRain className="size-3.5" aria-hidden />
                  <span className="ltr">{d.rainChance}%</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : ws.failed ? (
        <p className="text-sm text-muted">מזג האוויר לא זמין כרגע – ההמלצות מבוססות רק על המקום והעונה.</p>
      ) : (
        <span className="h-24 animate-pulse rounded-2xl bg-surface-2" aria-hidden />
      )}
    </section>
  );
}

export function ClimateView({
  plants,
  places,
  species,
  now,
  ws,
  onGoPlaces,
}: {
  plants: MyPlant[];
  places: Place[];
  species: SpeciesPick[];
  now: Date;
  ws: WeatherState;
  onGoPlaces: () => void;
}) {
  const weather: Weather | null = ws.weather;
  const placeOf = (p: MyPlant) => places.find((x) => x.id === p.placeId) ?? null;
  const alerts = plants.map((p) => ({ p, alerts: climateAlerts(p, placeOf(p), weather, now).filter((a) => a.kind !== "light") })).filter((x) => x.alerts.length);
  const owned = new Set(plants.map((p) => p.speciesSlug).filter(Boolean) as string[]);

  return (
    <div className="flex flex-col gap-8">
      <WeatherCard ws={ws} />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">התראות מזג אוויר</h2>
        {alerts.length === 0 ? (
          <p className="rounded-3xl bg-leaf-soft p-5 text-sm text-primary-strong">
            {weather ? "הכל בסדר – מזג האוויר בימים הקרובים מתאים לכל הצמחים שלך." : "ההתראות יופיעו כשמזג האוויר ייטען."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {alerts.flatMap(({ p, alerts }) =>
              alerts.map((a, i) => {
                const Icon = ALERT_ICON[a.kind];
                return (
                  <li key={`${p.id}${i}`} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", ALERT_TONE[a.kind])}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <Link href={`/plants/${p.id}`} className="font-semibold hover:underline">
                        {p.name}
                      </Link>
                      {placeOf(p) && <span className="text-muted"> · {placeOf(p)!.name}</span>}
                      <span className="block">{a.he}</span>
                    </span>
                  </li>
                );
              }),
            )}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-bold">האם כל צמח במקום הנכון?</h2>
          <p className="text-sm text-muted">לפי כמות האור שהצמח צריך, מול הכיוון של החלון או המרפסת שלו.</p>
        </div>
        {places.length === 0 ? (
          <button type="button" onClick={onGoPlaces} className="rounded-3xl border border-dashed border-border p-6 text-center text-sm text-muted hover:border-primary hover:text-primary">
            הוסיפו את המקומות בבית (סלון, מרפסת…) ולאן הם פונים – ונבדוק לכל צמח אם הוא מקבל מספיק אור
          </button>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {plants.map((p) => {
              const place = placeOf(p);
              const fit = lightFit(p.care?.light, place);
              const better = fit.fit === "good" ? null : betterPlace(p.care?.light, place, places);
              return (
                <li key={p.id} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3">
                  <PlantThumb url={p.photoUrl} name={p.name} className="size-12 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/plants/${p.id}`} className="font-semibold hover:underline">
                        {p.name}
                      </Link>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          fit.fit === "good" ? "bg-leaf-soft text-primary-strong" : fit.fit === "unknown" ? "bg-surface-2 text-muted" : "bg-accent-soft text-accent",
                        )}
                      >
                        {fit.fit === "good" ? "מתאים" : fit.fit === "dark" ? "חסר אור" : fit.fit === "bright" ? "יותר מדי שמש" : "לא ידוע"}
                      </span>
                    </div>
                    <p className="text-muted">
                      {p.care ? `צריך ${LIGHT_HE[p.care.light]}` : "אין נתוני אור"} · {place ? `${place.name} (${placeLabel(place)})` : "בלי מקום"}
                    </p>
                    {fit.fit !== "good" && fit.tip && <p className="mt-1">{fit.tip}</p>}
                    {fit.fit === "good" && fit.tip && <p className="mt-1 text-muted">{fit.tip}</p>}
                    {better && (
                      <p className="mt-1 flex items-center gap-1 font-medium text-primary">
                        <MoveLeft className="size-4" aria-hidden />
                        הצעה: להעביר ל{better.name}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {places.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-xl font-bold">מה עוד יגדל טוב אצלך?</h2>
            <p className="text-sm text-muted">צמחים מהמאגר שמתאימים לאור בכל אחד מהמקומות שלך.</p>
          </div>
          <div className="flex flex-col gap-4">
            {places.map((pl) => {
              const picks = suggestFor(pl, species, owned);
              if (!picks.length) return null;
              const Icon = PLACE_ICON[pl.kind];
              return (
                <div key={pl.id} className="flex flex-col gap-2 rounded-3xl border border-border bg-surface p-4">
                  <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                    <Icon className="size-4 text-primary" aria-hidden />
                    {pl.name}
                    <span className="text-xs font-normal text-muted">
                      {placeLabel(pl)} · אור {placeLight(pl) >= 3.5 ? "חזק" : placeLight(pl) >= 3 ? "בהיר" : placeLight(pl) >= 2 ? "בינוני" : "נמוך"}
                    </span>
                  </h3>
                  <ul className="flex gap-3 overflow-x-auto pb-1">
                    {picks.map((s) => (
                      <li key={s.slug} className="w-28 shrink-0">
                        <Link href={`/magazine/plants/${s.slug}`} className="flex flex-col gap-1 text-sm hover:text-primary">
                          <PlantThumb url={s.image} name={s.name} className="aspect-square w-full rounded-2xl" />
                          <span className="truncate font-medium">{s.name}</span>
                          <span className="text-xs text-muted">{DIFFICULTY_HE[s.difficulty]}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
