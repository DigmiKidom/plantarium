import Link from "next/link";
import { Droplets, PawPrint, Sun } from "lucide-react";
import type { Species } from "@/lib/species/types";
import { DIFFICULTY_HE, LIGHT_HE } from "@/lib/labels";
import { SpeciesVisual } from "./species-visual";
import { DifficultyPill } from "./difficulty-pill";

export function SpeciesCard({ species: s }: { species: Species }) {
  return (
    <Link
      href={`/knowledge/${s.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <SpeciesVisual species={s} className="aspect-[16/9] w-full sm:aspect-[4/3]" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold group-hover:text-primary">{s.common_name_he}</h3>
            <p className="truncate text-sm italic text-muted"><span className="ltr">{s.scientific_name}</span></p>
          </div>
          <DifficultyPill value={s.difficulty} label={DIFFICULTY_HE[s.difficulty]} />
        </div>
        <p className="line-clamp-2 text-sm text-muted">{s.summary_he}</p>
        <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-muted">
          <li className="flex items-center gap-1">
            <Sun className="size-3.5" aria-hidden />
            {LIGHT_HE[s.care.light]}
          </li>
          <li className="flex items-center gap-1">
            <Droplets className="size-3.5" aria-hidden />
            כל {s.care.water_interval_min_days}–{s.care.water_interval_max_days} ימים
          </li>
          {s.is_toxic_pets === false && (
            <li className="flex items-center gap-1 text-primary">
              <PawPrint className="size-3.5" aria-hidden />
              בטוח לחיות
            </li>
          )}
        </ul>
      </div>
    </Link>
  );
}
