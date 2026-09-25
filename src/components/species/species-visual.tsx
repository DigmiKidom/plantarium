import { Apple, Carrot, Flower2, Leaf, Sprout, TreeDeciduous, type LucideIcon } from "lucide-react";
import type { Category, Species } from "@/lib/species/types";
import { cn } from "@/lib/cn";

const ICON: Record<Category, LucideIcon> = {
  houseplant: Leaf,
  succulent: Sprout,
  herb: Sprout,
  vegetable: Carrot,
  fruit_tree: Apple,
  garden: Flower2,
};

const TONE: Record<Category, string> = {
  houseplant: "bg-leaf-soft text-primary",
  succulent: "bg-sun-soft text-[#8a6d1f] dark:text-[#e3c56b]",
  herb: "bg-leaf-soft text-primary",
  vegetable: "bg-accent-soft text-accent",
  fruit_tree: "bg-accent-soft text-accent",
  garden: "bg-water-soft text-[#2f6a8a] dark:text-[#8cc4e3]",
};

/** Species image, or a category placeholder until real photos are added. */
export function SpeciesVisual({ species, className }: { species: Species; className?: string }) {
  const img = species.images[0];
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element -- remote hosts configured later
    return <img src={img.url} alt={img.alt} className={cn("object-cover", className)} />;
  }
  const Icon = species.category === "fruit_tree" ? TreeDeciduous : ICON[species.category];
  return (
    <div className={cn("grid place-items-center", TONE[species.category], className)} aria-hidden>
      <Icon className="size-1/3 opacity-80" strokeWidth={1.4} />
    </div>
  );
}
