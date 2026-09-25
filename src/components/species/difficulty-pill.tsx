import type { Difficulty } from "@/lib/species/types";
import { cn } from "@/lib/cn";

const STYLE: Record<Difficulty, string> = {
  easy: "bg-leaf-soft text-primary-strong",
  moderate: "bg-sun-soft text-[#7a5f14] dark:text-[#e3c56b]",
  hard: "bg-accent-soft text-accent",
};

export function DifficultyPill({ value, label }: { value: Difficulty; label: string }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", STYLE[value])}>
      {label}
    </span>
  );
}
