"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Droplets, Loader2, Undo2, type LucideIcon } from "lucide-react";
import { deleteCareEvents, logCare } from "@/lib/plants/actions";
import type { CareEventType } from "@/lib/plants/types";
import { cn } from "@/lib/cn";

/** "Watered!" – logs a care action for one or many plants, with a short undo. */
export function CareButton({
  plantIds,
  type = "water",
  label = "השקיתי",
  doneLabel = "נרשם",
  icon: Icon = Droplets,
  variant = "soft",
  className,
}: {
  plantIds: string[];
  type?: CareEventType;
  label?: string;
  doneLabel?: string;
  icon?: LucideIcon;
  variant?: "soft" | "solid" | "icon";
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string[] | null>(null);
  const [error, setError] = useState<string>();

  const run = () =>
    start(async () => {
      setError(undefined);
      const res = await logCare({ plantIds, type });
      if (!res.ok) return setError(res.error);
      setDone(res.ids);
      router.refresh();
      setTimeout(() => setDone(null), 6000);
    });

  const undo = () =>
    start(async () => {
      if (!done) return;
      await deleteCareEvents(done);
      setDone(null);
      router.refresh();
    });

  if (done) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
        <span className="inline-flex items-center gap-1 font-medium text-primary">
          <Check className="size-4" aria-hidden />
          {doneLabel}
        </span>
        <button type="button" onClick={undo} disabled={pending} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted hover:bg-surface-2">
          <Undo2 className="size-3.5" aria-hidden />
          ביטול
        </button>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex flex-col items-start", className)}>
      <button
        type="button"
        onClick={run}
        disabled={pending || plantIds.length === 0}
        aria-label={variant === "icon" ? label : undefined}
        title={variant === "icon" ? label : undefined}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition disabled:opacity-60",
          variant === "solid" && "bg-primary px-4 py-2 text-sm text-on-primary hover:bg-primary-strong",
          variant === "soft" &&
            (type === "fertilize"
              ? "bg-sun-soft px-3.5 py-1.5 text-sm text-amber-700 hover:brightness-95 dark:text-amber-300"
              : "bg-water-soft px-3.5 py-1.5 text-sm text-sky-700 hover:brightness-95 dark:text-sky-300"),
          variant === "icon" && "size-9 bg-water-soft text-sky-700 hover:brightness-95 dark:text-sky-300",
        )}
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />}
        {variant !== "icon" && label}
      </button>
      {error && <span className="mt-1 text-xs text-accent">{error}</span>}
    </span>
  );
}
