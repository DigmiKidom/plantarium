import { z } from "zod";
// No eval probe: the site's Content-Security-Policy forbids it (zod falls back anyway, this just keeps the console clean).
z.config({ jitless: true });
import type { Species } from "./types";

export const CATEGORY_KEYS = ["houseplant", "succulent", "herb", "vegetable", "fruit_tree", "garden"] as const;
export const DIFFICULTY_KEYS = ["easy", "moderate", "hard"] as const;
export const LIGHT_KEYS = ["low", "medium", "bright_indirect", "direct"] as const;
export const GROWTH_KEYS = ["slow", "moderate", "fast"] as const;
export const MEDIUM_KEYS = [
  "soil", "aroid_mix", "cactus_mix", "orchid_bark", "leca", "coco_coir", "perlite_mix", "sphagnum", "water", "hydroponic", "none", "other",
] as const;
export const FERTILIZE_SEASONS = { spring_summer: "אביב וקיץ", all_year: "כל השנה" } as const;

const text = (max: number) => z.string().trim().max(max, { error: `עד ${max} תווים` });
const int = (min: number, max: number, label: string) =>
  z.number({ error: `${label}: מספר` }).int({ error: `${label}: מספר שלם` }).min(min, { error: `${label}: לפחות ${min}` }).max(max, { error: `${label}: עד ${max}` });

/** One plant in the database, as edited by admins or suggested by authors. */
export const speciesFormSchema = z
  .object({
    common_name_he: text(80).min(2, { error: "שם בעברית: לפחות 2 תווים" }),
    scientific_name: text(120).min(3, { error: "שם מדעי: לפחות 3 תווים" }),
    other_names_he: z.array(text(60).min(1)).max(10),
    common_name_en: text(80),
    family: text(60),
    category: z.enum(CATEGORY_KEYS, { error: "נא לבחור קטגוריה" }),
    difficulty: z.enum(DIFFICULTY_KEYS),
    summary_he: text(400).min(10, { error: "תקציר: לפחות 10 תווים" }),
    native_region_he: text(80),
    growth_rate: z.enum(GROWTH_KEYS),
    max_height_cm: int(1, 5000, "גובה מרבי"),
    is_toxic_pets: z.enum(["yes", "no", "unknown"]),
    tags: z.array(z.string().regex(/^[a-z-]{2,30}$/)).max(15),
    light: z.enum(LIGHT_KEYS),
    light_notes_he: text(300),
    water_min: int(1, 120, "השקיה (מינימום ימים)"),
    water_max: int(1, 180, "השקיה (מקסימום ימים)"),
    water_notes_he: text(300),
    humidity_min: int(0, 100, "לחות מינימלית"),
    humidity_max: int(0, 100, "לחות מרבית"),
    temp_min: int(-20, 50, "טמפרטורה מינימלית"),
    temp_max: int(-10, 60, "טמפרטורה מרבית"),
    fertilize_days: int(0, 365, "דישון (ימים)"),
    fertilize_season: z.enum(["spring_summer", "all_year"]),
    medium: z.array(z.enum(MEDIUM_KEYS)).min(1, { error: "נא לבחור לפחות מצע אחד" }),
    medium_notes_he: text(300),
    pruning_he: text(500),
    propagation_he: text(500),
    photos: z.array(z.string().url()).max(8, { error: "עד 8 תמונות" }),
  })
  .refine((v) => v.water_max >= v.water_min, { path: ["water_max"], error: "השקיה: המקסימום קטן מהמינימום" })
  .refine((v) => v.humidity_max >= v.humidity_min, { path: ["humidity_max"], error: "לחות: המקסימום קטן מהמינימום" })
  .refine((v) => v.temp_max >= v.temp_min, { path: ["temp_max"], error: "טמפרטורה: המקסימום קטן מהמינימום" });

export type SpeciesFormValues = z.infer<typeof speciesFormSchema>;

export const EMPTY_SPECIES: SpeciesFormValues = {
  common_name_he: "",
  scientific_name: "",
  other_names_he: [],
  common_name_en: "",
  family: "",
  category: "houseplant",
  difficulty: "easy",
  summary_he: "",
  native_region_he: "",
  growth_rate: "moderate",
  max_height_cm: 50,
  is_toxic_pets: "unknown",
  tags: [],
  light: "bright_indirect",
  light_notes_he: "",
  water_min: 7,
  water_max: 10,
  water_notes_he: "",
  humidity_min: 40,
  humidity_max: 60,
  temp_min: 15,
  temp_max: 30,
  fertilize_days: 30,
  fertilize_season: "spring_summer",
  medium: ["soil"],
  medium_notes_he: "",
  pruning_he: "",
  propagation_he: "",
  photos: [],
};

export function speciesToForm(s: Species): SpeciesFormValues {
  const c = s.care;
  return {
    common_name_he: s.common_name_he,
    scientific_name: s.scientific_name,
    other_names_he: s.other_names_he ?? [],
    common_name_en: s.common_name_en ?? "",
    family: s.family ?? "",
    category: s.category,
    difficulty: s.difficulty,
    summary_he: s.summary_he ?? "",
    native_region_he: s.native_region_he ?? "",
    growth_rate: s.growth_rate ?? "moderate",
    max_height_cm: s.max_height_cm ?? 50,
    is_toxic_pets: s.is_toxic_pets === true ? "yes" : s.is_toxic_pets === false ? "no" : "unknown",
    tags: s.tags ?? [],
    light: c.light,
    light_notes_he: c.light_notes_he ?? "",
    water_min: c.water_interval_min_days,
    water_max: c.water_interval_max_days,
    water_notes_he: c.water_notes_he ?? "",
    humidity_min: c.humidity_min ?? 40,
    humidity_max: c.humidity_max ?? 60,
    temp_min: Math.round(Number(c.temp_min_c ?? 15)),
    temp_max: Math.round(Number(c.temp_max_c ?? 30)),
    fertilize_days: c.fertilize_interval_days ?? 30,
    fertilize_season: c.fertilize_season === "all_year" ? "all_year" : "spring_summer",
    medium: (c.medium ?? ["soil"]).filter((m): m is (typeof MEDIUM_KEYS)[number] => (MEDIUM_KEYS as readonly string[]).includes(m)),
    medium_notes_he: c.medium_notes_he ?? "",
    pruning_he: c.pruning_he ?? "",
    propagation_he: c.propagation_he ?? "",
    photos: s.images.map((i) => i.url),
  };
}

/** "Monstera deliciosa" → "monstera-deliciosa" */
export const slugFromScientific = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
