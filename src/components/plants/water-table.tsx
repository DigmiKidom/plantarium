"use client";

import Link from "next/link";
import { Droplets, FlaskConical, Info } from "lucide-react";
import { addDays, agoHe, dueOnDay, fertilizePlan, relDay, waterPlan } from "@/lib/plants/care";
import type { MyPlant, Place } from "@/lib/plants/types";
import type { Weather } from "@/lib/weather/types";
import { CareButton } from "./care-button";
import { PlantThumb, WaterPill } from "./bits";
import { cn } from "@/lib/cn";

const weekday = new Intl.DateTimeFormat("he-IL", { weekday: "short" });
const dayNum = new Intl.DateTimeFormat("he-IL", { day: "numeric" });

export function WaterTable({ plants, places, now, weather }: { plants: MyPlant[]; places: Place[]; now: Date; weather: Weather | null }) {
  const placeOf = (p: MyPlant) => places.find((x) => x.id === p.placeId) ?? null;
  const rows = plants
    .map((p) => ({ p, plan: waterPlan(p, placeOf(p), now, weather) }))
    .sort((a, b) => (a.plan.daysLeft ?? -99) - (b.plan.daysLeft ?? -99) || a.p.name.localeCompare(b.p.name, "he"));
  const days = Array.from({ length: 7 }, (_, i) => addDays(now, i));
  const dueNow = rows.filter((r) => !r.plan.rainSkip && (r.plan.status === "overdue" || r.plan.status === "today")).map((r) => r.p.id);

  const fert = plants
    .map((p) => ({ p, f: fertilizePlan(p, now) }))
    .filter((x) => x.f.active)
    .sort((a, b) => (a.f.daysLeft ?? 0) - (b.f.daysLeft ?? 0));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">לוח השקיה לשבוע</h2>
            <p className="text-sm text-muted">מחושב לפי סוג הצמח, העונה, המקום בבית, גודל העציץ ומזג האוויר – ומתעדכן בכל פעם שמסמנים ״השקיתי״.</p>
          </div>
          {dueNow.length > 1 && <CareButton plantIds={dueNow} variant="solid" label={`השקיתי את כל ה-${dueNow.length} של היום`} doneLabel="כולם סומנו" />}
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-surface">
          {/* Day header (desktop) */}
          <div className="hidden grid-cols-[minmax(0,1fr)_repeat(7,2.5rem)_7.5rem] items-end gap-1 border-b border-border px-4 py-2 text-center text-xs text-muted md:grid">
            <span className="text-start">צמח</span>
            {days.map((d, i) => (
              <span key={i} className={cn("flex flex-col", i === 0 && "font-bold text-primary")}>
                <span>{i === 0 ? "היום" : weekday.format(d)}</span>
                <span className="tabular-nums">{dayNum.format(d)}</span>
              </span>
            ))}
            <span />
          </div>
          <ul className="divide-y divide-border">
            {rows.map(({ p, plan }) => (
              <li key={p.id} className="flex flex-col gap-2 px-4 py-3 md:grid md:grid-cols-[minmax(0,1fr)_repeat(7,2.5rem)_7.5rem] md:items-center md:gap-1">
                <div className="flex min-w-0 items-center gap-3">
                  <Link href={`/plants/${p.id}`} className="shrink-0">
                    <PlantThumb url={p.photoUrl} name={p.name} className="size-11 rounded-xl" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/plants/${p.id}`} className="block truncate font-semibold hover:underline">
                      {p.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span>הושקה {agoHe(plan.lastAt, now)}</span>
                      <span aria-hidden>·</span>
                      <details className="group relative">
                        <summary className="flex cursor-pointer list-none items-center gap-0.5 hover:text-primary">
                          כל ~{plan.every} ימים
                          <Info className="size-3.5" aria-hidden />
                        </summary>
                        <ul className="absolute start-0 top-5 z-10 w-64 list-disc rounded-2xl border border-border bg-surface p-3 ps-6 text-xs text-text shadow-lg">
                          {plan.reasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  </div>
                  <div className="md:hidden">
                    <CareButton plantIds={[p.id]} variant="icon" />
                  </div>
                </div>
                {/* 7-day strip: a full row on phones, grid cells on desktop */}
                <div className="grid grid-cols-7 gap-1 md:contents">
                  {days.map((d, i) => {
                    const due = dueOnDay(plan, i);
                    const late = i === 0 && plan.status === "overdue";
                    return (
                      <span
                        key={i}
                        title={`${i === 0 ? "היום" : weekday.format(d)}${due ? " – השקיה" : ""}`}
                        className={cn(
                          "flex h-10 flex-col items-center justify-center rounded-xl text-[10px] md:h-9",
                          i === 0 ? "bg-surface-2" : "",
                          due && (late ? "bg-accent-soft text-accent" : plan.rainSkip && i === 0 ? "bg-leaf-soft text-primary" : "bg-water-soft text-sky-700 dark:text-sky-300"),
                        )}
                      >
                        <span className="text-muted md:hidden">{i === 0 ? "היום" : weekday.format(d)}</span>
                        {due ? <Droplets className="size-4" aria-label="השקיה" /> : <span className="text-muted md:hidden">·</span>}
                      </span>
                    );
                  })}
                </div>
                <div className="hidden flex-col items-end gap-1 md:flex">
                  <CareButton plantIds={[p.id]} />
                </div>
                <WaterPill plan={plan} className="w-fit md:hidden" />
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted">
          זו הערכה. לפני השקיה כדאי לגעת במצע: אם 2–3 הס״מ העליונים עדיין לחים – מחכים עוד יום-יומיים. מעדיפים קצב משלכם? אפשר לקבוע אותו בעריכת הצמח.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <FlaskConical className="size-5 text-primary" aria-hidden />
          דישון
        </h2>
        {fert.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border p-6 text-center text-sm text-muted">
            {plants.some((p) => p.care?.fertilizeDays) ? "עכשיו עונת מנוחה – לא מדשנים עד האביב." : "אין המלצות דישון לצמחים שלך."}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {fert.map(({ p, f }) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <PlantThumb url={p.photoUrl} name={p.name} className="size-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className={cn("text-xs", (f.daysLeft ?? 0) <= 0 ? "font-medium text-accent" : "text-muted")}>
                    {p.lastFertilizeAt ? `דישון ${relDay(f.daysLeft)}` : "עוד לא תועד דישון"} · {f.he}
                  </div>
                </div>
                <CareButton plantIds={[p.id]} type="fertilize" label="דישנתי" icon={FlaskConical} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
