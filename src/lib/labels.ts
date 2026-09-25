import type { Category, Difficulty, GrowthRate, LightLevel, Season } from "@/lib/species/types";

/** All UI strings for species data live here, so a future English locale is one file. */
export const CATEGORY_HE: Record<Category, string> = {
  houseplant: "צמחי בית",
  succulent: "סוקולנטים וקקטוסים",
  herb: "תבלינים",
  vegetable: "ירקות",
  fruit_tree: "עצי פרי",
  garden: "צמחי גינה",
};

export const DIFFICULTY_HE: Record<Difficulty, string> = {
  easy: "קל",
  moderate: "בינוני",
  hard: "מאתגר",
};

export const LIGHT_HE: Record<LightLevel, string> = {
  low: "אור נמוך",
  medium: "אור בינוני",
  bright_indirect: "אור בהיר עקיף",
  direct: "שמש ישירה",
};

export const GROWTH_HE: Record<GrowthRate, string> = {
  slow: "איטי",
  moderate: "בינוני",
  fast: "מהיר",
};

export const SEASON_HE: Record<Season, string> = {
  spring: "אביב",
  summer: "קיץ",
  autumn: "סתיו",
  winter: "חורף",
};

export const TAG_HE: Record<string, string> = {
  aroid: "אראואידים",
  climber: "מטפס",
  hanging: "משתלשל",
  beginner: "למתחילים",
  "low-light": "סובל אור נמוך",
  "pet-safe": "בטוח לחיות מחמד",
  "drought-tolerant": "עמיד ליובש",
  "humidity-lover": "אוהב לחות",
  statement: "צמח מרשים",
  tree: "עץ",
  palm: "דקל",
  fern: "שרך",
  flowering: "פורח",
  succulent: "סוקולנט",
  compact: "קומפקטי",
  epiphyte: "אפיפיט",
  edible: "אכיל",
  herb: "תבלין",
  vegetable: "ירק",
  fruit: "פרי",
  "fruit-tree": "עץ פרי",
  outdoor: "לגינה",
  "native-israel": "צמח ארץ-ישראלי",
  colorful: "צבעוני",
  fragrant: "ריחני",
  pollinator: "מושך מאביקים",
  annual: "חד-שנתי",
  biennial: "דו-שנתי",
  perennial: "רב-שנתי",
  "cool-season": "עונה קרירה",
  summer: "קיצי",
  "cool-lover": "אוהב קרירות",
  "heat-lover": "אוהב חום",
  "toxic-sap": "מוהל מגרה",
  "water-grown": "גדל במים",
  "no-soil": "ללא אדמה",
  terrarium: "טרריום",
  medicinal: "מרפא",
  tea: "לחליטה",
  spreading: "מתפשט",
  groundcover: "כיסוי קרקע",
  balcony: "למרפסת",
  hedge: "גדר חיה",
  "salt-tolerant": "עמיד למליחות",
  "acid-lover": "אוהב חומציות",
  "companion-plant": "צמח מלווה",
  bonsai: "בונסאי",
  "outdoor-shade": "לצל בגינה",
};

export const tagLabel = (t: string) => TAG_HE[t] ?? t;

export const MEDIUM_HE: Record<string, string> = {
  soil: "אדמת שתילה",
  aroid_mix: "תערובת אראואידים",
  cactus_mix: "מצע לסוקולנטים",
  sphagnum: "ספגנום",
  orchid_bark: "קליפות לסחלבים",
  water: "מים",
  none: "ללא מצע",
  leca: "לקה",
  coco_coir: "קוקוס",
  perlite_mix: "פרלייט",
  hydroponic: "הידרופוניקה",
  other: "אחר",
};
