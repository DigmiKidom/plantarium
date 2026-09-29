"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, CloudSun, Droplets, Leaf, MapPin, Plus, Sprout } from "lucide-react";
import { waterPlan } from "@/lib/plants/care";
import { PLANT_TABS, type MyPlant, type Place, type PlantTab, type SpeciesPick } from "@/lib/plants/types";
import { useWeather } from "./use-weather";
import { PlantsGrid } from "./plants-grid";
import { WaterTable } from "./water-table";
import { ClimateView } from "./climate-view";
import { PlacesView } from "./places-view";
import { CareButton } from "./care-button";
import { cn } from "@/lib/cn";

const TABS = PLANT_TABS;
type Tab = PlantTab;
const SHORT: Record<Tab, string> = { plants: "הצמחים", water: "השקיה", climate: "אקלים", places: "מקומות" };
const TAB_ICON = { plants: Leaf, water: CalendarDays, climate: CloudSun, places: MapPin } as const;

export function PlantsHub({ plants, places, species, initialTab }: { plants: MyPlant[]; places: Place[]; species: SpeciesPick[]; initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const ws = useWeather();
  const { now, weather } = ws;

  const go = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", t === "plants" ? "/plants" : `/plants?tab=${t}`);
  };

  const placeOf = (p: MyPlant) => places.find((x) => x.id === p.placeId) ?? null;
  const due = now
    ? plants.filter((p) => {
        const plan = waterPlan(p, placeOf(p), now, weather);
        return !plan.rainSkip && (plan.status === "overdue" || plan.status === "today");
      })
    : [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">הצמחים שלי</h1>
          <p className="text-muted">
            {plants.length ? `${plants.length} צמחים` : "עוד אין צמחים"}
            {places.length ? ` · ${places.length} מקומות` : ""}
            {weather && ws.city ? ` · ${weather.temp}° ב${ws.city}` : ""}
          </p>
        </div>
        <Link href="/plants/new" className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary hover:bg-primary-strong">
          <Plus className="size-5" aria-hidden />
          הוספת צמח
        </Link>
      </header>

      {due.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-water-soft px-5 py-4">
          <Droplets className="size-6 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
          <p className="min-w-0 flex-1">
            <span className="font-bold">{due.length === 1 ? "צמח אחד צריך השקיה היום" : `${due.length} צמחים צריכים השקיה היום`}</span>
            <span className="block text-sm text-muted">{due.map((p) => p.name).join(", ")}</span>
          </p>
          <CareButton plantIds={due.map((p) => p.id)} variant="solid" label={due.length === 1 ? "השקיתי" : "השקיתי את כולם"} doneLabel="נרשם" />
        </div>
      )}

      <div role="tablist" aria-label="תצוגות" className="grid grid-cols-4 gap-1 rounded-2xl bg-surface-2 p-1 sm:flex sm:w-fit sm:rounded-full">
        {(Object.keys(TABS) as Tab[]).map((t) => {
          const Icon = TAB_ICON[t];
          return (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => go(t)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-xs transition sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:text-sm",
                tab === t ? "bg-surface font-semibold text-primary-strong shadow-sm" : "text-muted hover:text-text",
              )}
            >
              <Icon className="size-4" aria-hidden />
              <span className="sm:hidden">{SHORT[t]}</span>
              <span className="hidden sm:inline">{TABS[t]}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {tab === "places" ? (
          <PlacesView places={places} plants={plants} />
        ) : plants.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border px-6 py-12 text-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-leaf-soft text-primary">
              <Sprout className="size-8" aria-hidden />
            </span>
            <h2 className="text-xl font-bold">בואו נתחיל</h2>
            <p className="max-w-md text-muted">
              {places.length
                ? "הוסיפו את הצמח הראשון – ונבנה לו לוח השקיה ודישון, ונבדוק שהמקום שלו מתאים."
                : "קודם מגדירים את המקומות בבית (סלון, מרפסת…) ולאן הם פונים, ואז מוסיפים צמחים. ככה ההמלצות יהיו מדויקות."}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {!places.length && (
                <button type="button" onClick={() => go("places")} className="rounded-full border border-border px-5 py-2.5 font-medium hover:bg-surface-2">
                  הגדרת המקומות בבית
                </button>
              )}
              <Link href="/plants/new" className="rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary hover:bg-primary-strong">
                הוספת צמח ראשון
              </Link>
            </div>
          </div>
        ) : tab === "plants" ? (
          <PlantsGrid plants={plants} places={places} now={now} weather={weather} />
        ) : !now ? (
          <span className="block h-64 animate-pulse rounded-3xl bg-surface-2" aria-hidden />
        ) : tab === "water" ? (
          <WaterTable plants={plants} places={places} now={now} weather={weather} />
        ) : (
          <ClimateView plants={plants} places={places} species={species} now={now} ws={ws} onGoPlaces={() => go("places")} />
        )}
      </div>
    </div>
  );
}
