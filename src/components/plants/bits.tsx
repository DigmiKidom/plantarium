import { Droplets, Home, Sprout, Sun, Trees } from "lucide-react";
import { cn } from "@/lib/cn";
import { relDay, type WaterPlan } from "@/lib/plants/care";
import { DIRECTION_HE, PLACE_KIND_HE, type Place } from "@/lib/plants/types";

export const WATER_TONE: Record<WaterPlan["status"], string> = {
  overdue: "bg-accent-soft text-accent",
  today: "bg-water-soft text-sky-700 dark:text-sky-300",
  soon: "bg-surface-2 text-text",
  ok: "bg-leaf-soft text-primary-strong",
  unknown: "bg-surface-2 text-muted",
};

export function WaterPill({ plan, className }: { plan: WaterPlan; className?: string }) {
  const label = plan.rainSkip ? "ירד גשם – אפשר לדלג" : plan.status === "unknown" ? "לא תועדה השקיה" : `השקיה ${relDay(plan.daysLeft)}`;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", WATER_TONE[plan.rainSkip ? "ok" : plan.status], className)}>
      <Droplets className="size-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

export const PLACE_ICON = { room: Home, balcony: Sun, garden: Trees } as const;

export function placeLabel(p: Place) {
  return p.direction ? `${PLACE_KIND_HE[p.kind]} · פונה ל${DIRECTION_HE[p.direction]}` : p.kind === "room" ? `${PLACE_KIND_HE[p.kind]} · בלי חלון` : PLACE_KIND_HE[p.kind];
}

export function PlantThumb({ url, name, className }: { url: string | null; name: string; className?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} className={cn("object-cover", className)} loading="lazy" />
  ) : (
    <span className={cn("grid place-items-center bg-leaf-soft text-primary", className)} aria-hidden>
      <Sprout className="size-1/2 max-h-10 max-w-10" />
    </span>
  );
}
