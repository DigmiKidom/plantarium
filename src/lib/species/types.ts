export type LightLevel = "low" | "medium" | "bright_indirect" | "direct";
export type Difficulty = "easy" | "moderate" | "hard";
export type Category =
  | "houseplant"
  | "succulent"
  | "herb"
  | "vegetable"
  | "fruit_tree"
  | "garden";
export type GrowthRate = "slow" | "moderate" | "fast";
export type Season = "spring" | "summer" | "autumn" | "winter";

export interface SpeciesCare {
  light: LightLevel;
  light_notes_he: string;
  water_interval_min_days: number;
  water_interval_max_days: number;
  water_notes_he: string;
  humidity_min: number;
  humidity_max: number;
  temp_min_c: number;
  temp_max_c: number;
  fertilize_interval_days: number;
  fertilize_season: string;
  medium: string[];
  medium_notes_he: string;
  seasonal: Record<Season, { water_factor: number }>;
}

export interface Species {
  slug: string;
  scientific_name: string;
  common_name_he: string;
  other_names_he: string[];
  common_name_en: string;
  family: string;
  category: Category;
  difficulty: Difficulty;
  summary_he: string;
  native_region_he: string;
  growth_rate: GrowthRate;
  max_height_cm: number;
  /** null = not verified */
  is_toxic_pets: boolean | null;
  tags: string[];
  care: SpeciesCare;
  images: { url: string; alt: string; credit?: string }[];
}

export interface SpeciesFilters {
  q?: string;
  category?: Category;
  light?: LightLevel;
  difficulty?: Difficulty;
  petSafe?: boolean;
}
