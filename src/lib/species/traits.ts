import {
  Apple,
  CloudSun,
  DropletOff,
  Droplets,
  Flame,
  Flower2,
  Leaf,
  Moon,
  PawPrint,
  Smile,
  Snowflake,
  Sparkles,
  Sun,
  TrendingUp,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { Species } from "./types";

/**
 * A plant's "personality": colorful badges derived from its care data and tags,
 * e.g. a yellow sun for sun lovers, a blue drop for thirsty plants, a green leaf for humidity lovers.
 */
export type Trait = {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Icon circle colors (light + dark). */
  tone: string;
};

const T = {
  sun: "bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
  bright: "bg-orange-100 text-orange-500 dark:bg-orange-400/15 dark:text-orange-300",
  shade: "bg-indigo-100 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300",
  water: "bg-sky-100 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300",
  dry: "bg-stone-200 text-stone-600 dark:bg-stone-400/15 dark:text-stone-300",
  humid: "bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
  heat: "bg-red-100 text-red-500 dark:bg-red-400/15 dark:text-red-300",
  cold: "bg-cyan-100 text-cyan-600 dark:bg-cyan-400/15 dark:text-cyan-300",
  pet: "bg-teal-100 text-teal-600 dark:bg-teal-400/15 dark:text-teal-300",
  toxic: "bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
  easy: "bg-lime-100 text-lime-700 dark:bg-lime-400/15 dark:text-lime-300",
  flower: "bg-pink-100 text-pink-600 dark:bg-pink-400/15 dark:text-pink-300",
  edible: "bg-orange-100 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300",
  scent: "bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
  fast: "bg-green-100 text-green-700 dark:bg-green-400/15 dark:text-green-300",
  statement: "bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-400/15 dark:text-fuchsia-300",
};

export function plantTraits(s: Species): Trait[] {
  const c = s.care;
  const has = (t: string) => s.tags.includes(t);
  const out: Trait[] = [];

  // Light
  if (c.light === "direct") out.push({ key: "sun", label: "אוהב שמש", hint: "שמש ישירה רוב היום", icon: Sun, tone: T.sun });
  else if (c.light === "bright_indirect") out.push({ key: "bright", label: "אור בהיר", hint: "אור בהיר, בלי שמש חזקה", icon: CloudSun, tone: T.bright });
  else if (c.light === "low" || has("low-light")) out.push({ key: "shade", label: "מסתדר בצל", hint: "מתאים לפינות חשוכות", icon: Moon, tone: T.shade });

  // Water
  if (c.water_interval_max_days <= 5) out.push({ key: "water", label: "אוהב מים", hint: `השקיה כל ${c.water_interval_min_days}–${c.water_interval_max_days} ימים`, icon: Droplets, tone: T.water });
  else if (c.water_interval_min_days >= 14 || has("drought-tolerant"))
    out.push({ key: "dry", label: "עמיד ליובש", hint: "סולח על שכחה בהשקיה", icon: DropletOff, tone: T.dry });

  // Air & temperature
  if ((c.humidity_min ?? 0) >= 60 || has("humidity-lover")) out.push({ key: "humid", label: "אוהב לחות", hint: `לחות ${c.humidity_min}–${c.humidity_max}%`, icon: Leaf, tone: T.humid });
  if ((c.temp_max_c ?? 0) >= 38 || has("heat-lover")) out.push({ key: "heat", label: "אוהב חום", hint: "מחזיק בקיץ הישראלי", icon: Flame, tone: T.heat });
  if ((c.temp_min_c ?? 99) <= 3 || has("cool-lover")) out.push({ key: "cold", label: "עמיד לקור", hint: `עד ${c.temp_min_c}°`, icon: Snowflake, tone: T.cold });

  // People & pets
  if (s.difficulty === "easy" || has("beginner")) out.push({ key: "easy", label: "למתחילים", hint: "קל לגידול", icon: Smile, tone: T.easy });
  if (s.is_toxic_pets === false || has("pet-safe")) out.push({ key: "pet", label: "בטוח לחיות", hint: "לא רעיל לכלבים וחתולים", icon: PawPrint, tone: T.pet });
  if (s.is_toxic_pets === true) out.push({ key: "toxic", label: "רעיל לחיות", hint: "להרחיק מחיות מחמד", icon: PawPrint, tone: T.toxic });

  // Character
  if (has("flowering") || has("colorful")) out.push({ key: "flower", label: "פורח", hint: "פריחה צבעונית", icon: Flower2, tone: T.flower });
  if (has("edible") || has("fruit") || has("herb") || has("vegetable") || s.category === "fruit_tree")
    out.push({ key: "edible", label: "אכיל", hint: "יש מה לקטוף", icon: Apple, tone: T.edible });
  if (has("fragrant")) out.push({ key: "scent", label: "ריחני", hint: "ריח נעים", icon: Wind, tone: T.scent });
  if (s.growth_rate === "fast") out.push({ key: "fast", label: "גדל מהר", hint: "רואים התקדמות כל חודש", icon: TrendingUp, tone: T.fast });
  if (has("statement")) out.push({ key: "statement", label: "צמח מרשים", hint: "נקודת מוקד בחדר", icon: Sparkles, tone: T.statement });

  return out;
}

/** 1–4 scale for meters on the plant page. */
export const lightLevel = (s: Species) => ({ low: 1, medium: 2, bright_indirect: 3, direct: 4 })[s.care.light];
export function waterLevel(s: Species) {
  const d = s.care.water_interval_max_days;
  return d <= 5 ? 4 : d <= 9 ? 3 : d <= 16 ? 2 : 1;
}
export const humidityLevel = (s: Species) => {
  const h = s.care.humidity_min ?? 40;
  return h >= 60 ? 4 : h >= 50 ? 3 : h >= 40 ? 2 : 1;
};

