import type { Category, Difficulty, LightLevel, Season } from "@/lib/species/types";

// ---------- places ----------
export const PLACE_KINDS = ["room", "balcony", "garden"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];
export const PLACE_KIND_HE: Record<PlaceKind, string> = { room: "חדר בבית", balcony: "מרפסת", garden: "גינה / חצר" };

export const DIRECTIONS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const DIRECTION_HE: Record<Direction, string> = {
  n: "צפון",
  ne: "צפון-מזרח",
  e: "מזרח",
  se: "דרום-מזרח",
  s: "דרום",
  sw: "דרום-מערב",
  w: "מערב",
  nw: "צפון-מערב",
};
export const DIRECTION_SHORT_HE: Record<Direction, string> = { n: "צ׳", ne: "צ״מ", e: "מז׳", se: "ד״מ", s: "ד׳", sw: "ד״מע", w: "מע׳", nw: "צ״מע" };

export type Place = { id: string; name: string; kind: PlaceKind; direction: Direction | null };

// ---------- plants ----------
/** The species care numbers the planner needs (a subset of species_care). */
export type CareInfo = {
  light: LightLevel;
  waterMin: number;
  waterMax: number;
  humidityMin: number | null;
  humidityMax: number | null;
  tempMin: number | null;
  tempMax: number | null;
  fertilizeDays: number | null;
  fertilizeSeason: string | null;
  seasonal: Partial<Record<Season, { water_factor?: number }>>;
};

export type MyPlant = {
  id: string;
  /** Nickname, or the species name. */
  name: string;
  /** Hebrew species name (database or free text). */
  speciesName: string;
  speciesSlug: string | null;
  scientificName: string | null;
  category: Category | null;
  /** The user's photo, or the species photo. */
  photoUrl: string | null;
  /** Only the user's own photo. */
  ownPhotoUrl: string | null;
  placeId: string | null;
  potCm: number | null;
  medium: string | null;
  waterEveryDays: number | null;
  acquiredOn: string | null;
  notes: string | null;
  createdAt: string;
  lastWaterAt: string | null;
  lastFertilizeAt: string | null;
  care: CareInfo | null;
};

export type CareEventType = "water" | "fertilize" | "mist" | "prune" | "repot" | "rotate" | "treat" | "note";
export const CARE_HE: Record<CareEventType, string> = {
  water: "השקיה",
  fertilize: "דישון",
  mist: "ריסוס",
  prune: "גיזום",
  repot: "העברת עציץ",
  rotate: "סיבוב לאור",
  treat: "טיפול במזיקים",
  note: "הערה",
};
export type CareEvent = { id: string; type: CareEventType; occurredAt: string; note: string | null };

/** Small species record for "what grows well in this place". */
export type SpeciesPick = {
  slug: string;
  name: string;
  category: Category;
  difficulty: Difficulty;
  light: LightLevel;
  image: string | null;
};

export const PLANT_MEDIUMS = ["soil", "aroid_mix", "cactus_mix", "orchid_bark", "leca", "coco_coir", "perlite_mix", "sphagnum", "water", "hydroponic", "other"] as const;
export const OTHER_PLANT = "other";

/** Tabs of the "my plants" page (?tab=). */
export const PLANT_TABS = { plants: "הצמחים", water: "לוח השקיה", climate: "אקלים והמלצות", places: "מקומות" } as const;
export type PlantTab = keyof typeof PLANT_TABS;
