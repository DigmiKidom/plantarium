import type { LucideIcon } from "lucide-react";
import type { Trait } from "@/lib/species/traits";
import { cn } from "@/lib/cn";

/** Small colored icon circles (cards). */
export function TraitIcons({ traits, max = 5, className }: { traits: Trait[]; max?: number; className?: string }) {
  const shown = traits.slice(0, max);
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="תכונות">
      {shown.map(({ key, label, icon: Icon, tone }) => (
        <li key={key} title={label} className={cn("grid size-8 place-items-center rounded-full", tone)}>
          <Icon className="size-4" aria-hidden />
          <span className="sr-only">{label}</span>
        </li>
      ))}
      {traits.length > max && (
        <li className="grid size-8 place-items-center rounded-full bg-surface-2 text-xs font-medium text-muted">+{traits.length - max}</li>
      )}
    </ul>
  );
}

/** Large labelled badges (plant page). */
export function TraitBadges({ traits }: { traits: Trait[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="אופי הצמח">
      {traits.map(({ key, label, hint, icon: Icon, tone }) => (
        <li key={key} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", tone)}>
            <Icon className="size-6" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold leading-tight">{label}</span>
            <span className="block truncate text-xs text-muted">{hint}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** "●●●○" style meter with icons, e.g. four suns for full sun. */
export function Meter({ icon: Icon, level, tone, label }: { icon: LucideIcon; level: number; tone: string; label: string }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`${label}: ${level} מתוך 4`}>
      {[1, 2, 3, 4].map((n) => (
        <Icon key={n} className={cn("size-5", n <= level ? tone : "text-border")} fill={n <= level ? "currentColor" : "none"} aria-hidden />
      ))}
    </span>
  );
}
