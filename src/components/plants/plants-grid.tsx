"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { waterPlan } from "@/lib/plants/care";
import type { MyPlant, Place } from "@/lib/plants/types";
import type { Weather } from "@/lib/weather/types";
import { CareButton } from "./care-button";
import { PLACE_ICON, PlantThumb, WaterPill, placeLabel } from "./bits";
import { cn } from "@/lib/cn";

function PlantCard({ plant, place, now, weather }: { plant: MyPlant; place: Place | null; now: Date | null; weather: Weather | null }) {
  const plan = now ? waterPlan(plant, place, now, weather) : null;
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm transition hover:shadow-md">
      <Link href={`/plants/${plant.id}`} className="flex flex-col">
        <PlantThumb url={plant.photoUrl} name={plant.name} className="aspect-[4/3] w-full" />
        <span className="flex flex-col gap-1 px-4 pb-14 pt-3">
          <span className="truncate font-bold">{plant.name}</span>
          {plant.name !== plant.speciesName && <span className="truncate text-sm text-muted">{plant.speciesName}</span>}
          {plan && <WaterPill plan={plan} className="mt-1 w-fit" />}
        </span>
      </Link>
      <div className="absolute bottom-3 start-4">
        <CareButton plantIds={[plant.id]} />
      </div>
    </li>
  );
}

export function PlantsGrid({ plants, places, now, weather }: { plants: MyPlant[]; places: Place[]; now: Date | null; weather: Weather | null }) {
  const [byPlace, setByPlace] = useState(places.length > 0);
  const placeOf = (p: MyPlant) => places.find((x) => x.id === p.placeId) ?? null;

  const groups: { place: Place | null; plants: MyPlant[] }[] = byPlace
    ? [
        ...places.map((place) => ({ place, plants: plants.filter((p) => p.placeId === place.id) })),
        { place: null, plants: plants.filter((p) => !placeOf(p)) },
      ].filter((g) => g.plants.length > 0)
    : [{ place: null, plants }];

  return (
    <div className="flex flex-col gap-6">
      {places.length > 0 && (
        <div role="group" aria-label="תצוגה" className="flex w-fit gap-1 rounded-full bg-surface-2 p-1 text-sm">
          {[
            [true, "לפי מקום"],
            [false, "כל הצמחים"],
          ].map(([v, label]) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={byPlace === v}
              onClick={() => setByPlace(v as boolean)}
              className={cn("rounded-full px-4 py-1.5", byPlace === v ? "bg-surface font-semibold shadow-sm" : "text-muted")}
            >
              {label as string}
            </button>
          ))}
        </div>
      )}
      {groups.map((g) => {
        const Icon = g.place ? PLACE_ICON[g.place.kind] : MapPin;
        return (
          <section key={g.place?.id ?? "none"} className="flex flex-col gap-3">
            {byPlace && (
              <h2 className="flex flex-wrap items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-leaf-soft text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="text-lg font-bold">{g.place?.name ?? "בלי מקום"}</span>
                <span className="text-sm text-muted">{g.place ? placeLabel(g.place) : "שייכו מקום כדי לקבל המלצות אור מדויקות"}</span>
              </h2>
            )}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {g.plants.map((p) => (
                <PlantCard key={p.id} plant={p} place={placeOf(p)} now={now} weather={weather} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
