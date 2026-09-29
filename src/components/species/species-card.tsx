import Link from "next/link";
import type { Species } from "@/lib/species/types";
import { DIFFICULTY_HE } from "@/lib/labels";
import { plantTraits } from "@/lib/species/traits";
import { SpeciesVisual } from "./species-visual";
import { DifficultyPill } from "./difficulty-pill";
import { TraitIcons } from "./trait-badges";

export function SpeciesCard({ species: s, headingLevel: Heading = "h3" }: { species: Species; headingLevel?: "h2" | "h3" }) {
  const traits = plantTraits(s).filter((t) => t.key !== "easy"); // difficulty already has its own pill
  return (
    <Link
      href={`/magazine/plants/${s.slug}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative">
        <SpeciesVisual species={s} className="aspect-[16/10] w-full" />
        <span className="absolute start-3 top-3">
          <DifficultyPill value={s.difficulty} label={DIFFICULTY_HE[s.difficulty]} />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="min-w-0">
          <Heading className="truncate text-lg font-bold group-hover:text-primary">{s.common_name_he}</Heading>
          <p className="truncate text-sm italic text-muted">
            <span className="ltr">{s.scientific_name}</span>
          </p>
        </div>
        <p className="line-clamp-2 text-sm text-muted">{s.summary_he}</p>
        <TraitIcons traits={traits} className="mt-auto pt-2" />
      </div>
    </Link>
  );
}
