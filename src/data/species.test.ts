import { describe, expect, it } from "vitest";
import seed from "./species.json";
import type { Species } from "@/lib/species/types";

// The plant database seed: ~1,100 entries written partly by hand, partly generated – guard its shape.
const species = (seed as unknown as { species: Species[] }).species;
const CATEGORIES = ["houseplant", "succulent", "herb", "vegetable", "fruit_tree", "garden"];
const LIGHT = ["low", "medium", "bright_indirect", "direct"];
const MEDIUM = ["soil", "aroid_mix", "cactus_mix", "orchid_bark", "leca", "coco_coir", "perlite_mix", "sphagnum", "water", "hydroponic", "none", "other"];
const HEBREW = /[֐-׿]/;

describe("species.json", () => {
  it("has unique slugs and scientific names", () => {
    expect(new Set(species.map((s) => s.slug)).size).toBe(species.length);
    expect(new Set(species.map((s) => s.scientific_name.toLowerCase())).size).toBe(species.length);
  });
  it.each(species.map((s) => [s.slug, s] as const))("%s is valid", (_, s) => {
    expect(s.slug).toMatch(/^[a-z0-9-]+$/);
    expect(s.common_name_he).toMatch(HEBREW);
    expect(CATEGORIES).toContain(s.category);
    expect(LIGHT).toContain(s.care.light);
    expect(s.care.water_interval_min_days).toBeGreaterThanOrEqual(1);
    expect(s.care.water_interval_max_days).toBeGreaterThanOrEqual(s.care.water_interval_min_days);
    expect(s.care.medium.every((m) => MEDIUM.includes(m))).toBe(true);
    for (const season of ["spring", "summer", "autumn", "winter"] as const) {
      expect(s.care.seasonal[season].water_factor).toBeGreaterThan(0);
    }
  });
});
