import type { LightLevel, Season } from "@/lib/species/types";
import type { Weather } from "@/lib/weather/types";
import { LIGHT_HE } from "@/lib/labels";
import { DIRECTION_HE, type MyPlant, type Place, type SpeciesPick } from "./types";

/**
 * The care planner: pure functions, run in the browser with the day's weather.
 * Rules of thumb for Israel (northern hemisphere, ~31–33°N):
 * south / west windows get the strongest sun, north gets none, balconies and gardens are brighter,
 * hotter and dry out faster than rooms.
 */

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const daysBetween = (from: Date, to: Date) => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY);
export const addDays = (d: Date, n: number) => new Date(startOfDay(d).getTime() + n * DAY);

export function seasonOf(d: Date): Season {
  const m = d.getMonth() + 1;
  if (m === 12 || m <= 2) return "winter";
  if (m <= 5) return "spring";
  if (m <= 8) return "summer";
  return "autumn";
}

const DEFAULT_SEASON_FACTOR: Record<Season, number> = { spring: 1, summer: 0.8, autumn: 1.1, winter: 1.4 };
const NEED: Record<LightLevel, number> = { low: 1, medium: 2, bright_indirect: 3, direct: 4 };

// ---------- light ----------
const ROOM_LIGHT: Record<string, number> = { none: 1, n: 2, ne: 2.5, nw: 2.5, e: 3, se: 3.5, s: 3.5, sw: 3.5, w: 3.5 };
const BALCONY_LIGHT: Record<string, number> = { none: 3.5, n: 3, ne: 3, nw: 3, e: 3.5, se: 4, s: 4, sw: 4, w: 4 };

/** How much light a place gets, on the species scale: 1 low … 4 direct sun. */
export function placeLight(p: Pick<Place, "kind" | "direction">): number {
  const d = p.direction ?? "none";
  if (p.kind === "garden") return d === "n" ? 3 : 4;
  return (p.kind === "balcony" ? BALCONY_LIGHT : ROOM_LIGHT)[d];
}

export function placeLightHe(p: Pick<Place, "kind" | "direction">): string {
  const v = placeLight(p);
  if (v <= 1) return "מעט אור (אין חלון)";
  if (v <= 2) return "אור רך, בלי שמש ישירה";
  if (v <= 2.5) return "אור בינוני, קצת שמש בבוקר או אחה״צ";
  if (v <= 3) return "אור בהיר, שמש בוקר נעימה";
  if (v < 4) return "הרבה אור, שמש חזקה בחלק מהיום";
  return "שמש ישירה רוב היום";
}

export type Fit = "good" | "dark" | "bright" | "unknown";
export type LightFit = { fit: Fit; he: string; tip?: string };

export function lightFit(light: LightLevel | undefined, place: Place | null | undefined): LightFit {
  if (!light) return { fit: "unknown", he: "אין נתוני אור לצמח הזה" };
  if (!place) return { fit: "unknown", he: `צריך ${LIGHT_HE[light]} – בחרו מקום לצמח כדי לבדוק התאמה` };
  const need = NEED[light];
  const have = placeLight(place);
  const dir = place.direction ? `פונה ל${DIRECTION_HE[place.direction]}` : place.kind === "room" ? "בלי חלון" : "";
  if (have < need - 0.5) {
    return {
      fit: "dark",
      he: `חסר אור: הצמח צריך ${LIGHT_HE[light]}, וה${place.name}${dir ? ` (${dir})` : ""} חשוך מדי בשבילו`,
      tip: need >= 4 ? "הכי טוב במרפסת או בחלון דרומי/מערבי" : "קרבו לחלון מזרחי או דרומי, או הוסיפו מנורת גידול",
    };
  }
  if ((have >= 4 && need <= 3) || (have >= 3.5 && need <= 2)) {
    return {
      fit: "bright",
      he: `יותר מדי שמש: הצמח אוהב ${LIGHT_HE[light]}, וה${place.name}${dir ? ` (${dir})` : ""} חשוף לשמש חזקה`,
      tip: "הרחיקו מטר-שניים מהחלון, או וילון שקוף בשעות הצהריים – אחרת העלים עלולים להישרף",
    };
  }
  return {
    fit: "good",
    he: `מקום מתאים: ${LIGHT_HE[light]}`,
    tip: need === 3 && have >= 3.5 ? "בקיץ, וילון שקוף בצהריים ישמור על העלים" : undefined,
  };
}

/** Among the user's places, the one whose light suits the plant best (only if it's better than now). */
export function betterPlace(light: LightLevel | undefined, current: Place | null, places: Place[]): Place | null {
  if (!light) return null;
  const need = NEED[light];
  const score = (p: Place) => {
    const f = lightFit(light, p).fit;
    return (f === "good" ? 0 : 10) + Math.abs(placeLight(p) - need);
  };
  const best = [...places].sort((a, b) => score(a) - score(b))[0];
  if (!best || best.id === current?.id) return null;
  if (current && score(best) >= score(current)) return null;
  return lightFit(light, best).fit === "good" ? best : null;
}

// ---------- watering ----------
export type WaterStatus = "overdue" | "today" | "soon" | "ok" | "unknown";
export type WaterPlan = {
  /** Days between waterings, after all adjustments. */
  every: number;
  reasons: string[];
  lastAt: Date | null;
  nextAt: Date | null;
  /** Negative = late by that many days. */
  daysLeft: number | null;
  status: WaterStatus;
  /** It rained today on an outdoor plant: watering can wait. */
  rainSkip: boolean;
};

const outdoor = (p: Place | null | undefined) => p?.kind === "garden" || p?.kind === "balcony";

export function waterPlan(plant: MyPlant, place: Place | null | undefined, now: Date, weather?: Weather | null): WaterPlan {
  const reasons: string[] = [];
  let every: number;

  if (plant.waterEveryDays) {
    every = plant.waterEveryDays;
    reasons.push(`הקצב שקבעת: כל ${every} ימים`);
  } else if (plant.care) {
    const base = (plant.care.waterMin + plant.care.waterMax) / 2;
    reasons.push(`לפי מאגר הצמחים: כל ${plant.care.waterMin}–${plant.care.waterMax} ימים`);
    let f = 1;
    const season = seasonOf(now);
    const sf = plant.care.seasonal?.[season]?.water_factor ?? DEFAULT_SEASON_FACTOR[season];
    if (sf !== 1) {
      f *= sf;
      reasons.push(sf < 1 ? "קיץ – משקים יותר" : season === "winter" ? "חורף – הצמח שותה פחות" : "סתיו – משקים קצת פחות");
    }
    if (place) {
      if (place.kind === "garden") {
        f *= 0.7;
        reasons.push("בגינה המצע מתייבש מהר");
      } else if (place.kind === "balcony") {
        const hot = place.direction === "s" || place.direction === "sw" || place.direction === "w";
        f *= hot ? 0.7 : 0.85;
        reasons.push(hot ? "מרפסת שמשית וחמה" : "במרפסת המצע מתייבש מהר יותר");
      } else {
        const l = placeLight(place);
        if (l >= 3.5) {
          f *= 0.9;
          reasons.push("חלון שמשי");
        } else if (l <= 2) {
          f *= 1.15;
          reasons.push("מקום מוצל – מתייבש לאט");
        }
      }
    }
    if (plant.potCm) {
      if (plant.potCm < 12) {
        f *= 0.8;
        reasons.push("עציץ קטן מתייבש מהר");
      } else if (plant.potCm > 30) {
        f *= 1.2;
        reasons.push("עציץ גדול שומר לחות");
      }
    }
    if (weather) {
      const hot = weather.max >= 32 ? (outdoor(place) ? 0.75 : 0.9) : weather.max >= 28 && outdoor(place) ? 0.9 : 1;
      if (hot < 1) {
        f *= hot;
        reasons.push(`חם היום (${weather.max}°)`);
      }
      if (weather.humidity < 35 && outdoor(place)) {
        f *= 0.9;
        reasons.push(`אוויר יבש (${weather.humidity}%)`);
      }
    }
    // Never more than halve or double the database range, whatever stacks up.
    every = Math.round(base * Math.min(2, Math.max(0.5, f)));
  } else {
    every = 7;
    reasons.push("אין נתונים על הצמח – ברירת מחדל: פעם בשבוע. אפשר לקבוע קצב משלך בעריכה");
  }
  every = Math.min(60, Math.max(1, every));

  const lastAt = plant.lastWaterAt ? new Date(plant.lastWaterAt) : null;
  const rainToday = (weather?.days?.[0]?.rain ?? 0) >= 3;
  const rainSkip = rainToday && plant.care != null && place?.kind === "garden";
  if (!lastAt) return { every, reasons, lastAt, nextAt: null, daysLeft: null, status: "unknown", rainSkip };

  const nextAt = addDays(lastAt, every);
  const daysLeft = daysBetween(now, nextAt);
  const status: WaterStatus = daysLeft < 0 ? "overdue" : daysLeft === 0 ? "today" : daysLeft === 1 ? "soon" : "ok";
  return { every, reasons, lastAt, nextAt, daysLeft, status, rainSkip };
}

/** For the weekly table: is watering due on `day` (0 = today … 6)? Repeats every `every` days. */
export function dueOnDay(plan: WaterPlan, day: number): boolean {
  if (plan.daysLeft == null) return day === 0;
  const first = Math.max(0, plan.daysLeft);
  return day >= first && (day - first) % plan.every === 0;
}

export function relDay(n: number | null): string {
  if (n == null) return "לא תועד";
  if (n < -1) return `באיחור של ${-n} ימים`;
  if (n === -1) return "באיחור של יום";
  if (n === 0) return "היום";
  if (n === 1) return "מחר";
  if (n === 2) return "מחרתיים";
  return `בעוד ${n} ימים`;
}

export function agoHe(d: Date | null, now: Date): string {
  if (!d) return "לא תועד";
  const n = daysBetween(d, now);
  if (n <= 0) return "היום";
  if (n === 1) return "אתמול";
  if (n === 2) return "שלשום";
  return `לפני ${n} ימים`;
}

// ---------- fertilizing ----------
export type FertilizePlan = { active: boolean; every: number | null; daysLeft: number | null; he: string };

export function fertilizePlan(plant: MyPlant, now: Date): FertilizePlan {
  const c = plant.care;
  if (!c?.fertilizeDays) return { active: false, every: null, daysLeft: null, he: "אין המלצת דישון" };
  const m = now.getMonth() + 1;
  const inSeason = c.fertilizeSeason === "growing_season" ? m >= 3 && m <= 10 : m >= 3 && m <= 8;
  if (!inSeason) return { active: false, every: c.fertilizeDays, daysLeft: null, he: "מנוחה מדישון – חוזרים באביב" };
  if (!plant.lastFertilizeAt) return { active: true, every: c.fertilizeDays, daysLeft: 0, he: `כל ${c.fertilizeDays} ימים בעונת הגידול` };
  const daysLeft = daysBetween(now, addDays(new Date(plant.lastFertilizeAt), c.fertilizeDays));
  return { active: true, every: c.fertilizeDays, daysLeft, he: `כל ${c.fertilizeDays} ימים בעונת הגידול` };
}

// ---------- climate ----------
export type Alert = { kind: "cold" | "heat" | "dry" | "sun" | "rain" | "light"; level: "warn" | "info"; he: string };

export function climateAlerts(plant: MyPlant, place: Place | null | undefined, weather: Weather | null | undefined, now: Date): Alert[] {
  const out: Alert[] = [];
  const c = plant.care;
  const fit = lightFit(c?.light, place);
  if (fit.fit === "dark" || fit.fit === "bright") out.push({ kind: "light", level: "warn", he: `${fit.he}. ${fit.tip ?? ""}`.trim() });
  if (!c || !weather) return out;

  const days = weather.days?.length ? weather.days : [{ date: "", max: weather.max, min: weather.min, rain: 0, rainChance: 0 }];
  const coldest = Math.min(...days.map((d) => d.min));
  const hottest = Math.max(...days.map((d) => d.max));

  if (outdoor(place)) {
    if (c.tempMin != null && coldest < c.tempMin) {
      out.push({ kind: "cold", level: "warn", he: `צפוי לילה של ${coldest}° והצמח מעדיף מעל ${c.tempMin}° – כדאי להכניס פנימה או לכסות בלילה` });
    }
    if (c.tempMax != null && hottest > c.tempMax) {
      out.push({ kind: "heat", level: "warn", he: `צפוי חום של ${hottest}° (הצמח מעדיף עד ${c.tempMax}°) – צל בשעות הצהריים והשקיה בבוקר` });
    }
    if (weather.uv >= 8 && NEED[c.light] <= 3) {
      out.push({ kind: "sun", level: "warn", he: `קרינה חזקה היום (UV ${weather.uv}) – הצמח רגיש לשמש ישירה, רשת צל או מקום מוגן` });
    }
    if (place?.kind === "garden" && (days[0]?.rain ?? 0) >= 3) {
      out.push({ kind: "rain", level: "info", he: "ירד גשם היום – אפשר לדלג על השקיה" });
    }
  } else if (seasonOf(now) === "winter" && c.tempMin != null && c.tempMin >= 15 && coldest < 10 && place?.direction) {
    out.push({ kind: "cold", level: "info", he: `לילות קרים (${coldest}°) – הרחיקו מזגוגית החלון בלילה` });
  }

  if (c.humidityMin != null && c.humidityMin >= 55 && weather.humidity < c.humidityMin - 10) {
    out.push({
      kind: "dry",
      level: "info",
      he: `האוויר יבש (${weather.humidity}%) והצמח אוהב ${c.humidityMin}%+ – ריסוס בבוקר, מגש חלוקים עם מים או קיבוץ צמחים יחד${seasonOf(now) === "summer" && !outdoor(place) ? ". מזגן מייבש עוד יותר" : ""}`,
    });
  }
  return out;
}

// ---------- what grows well here ----------
const OUTDOOR_CATS = new Set(["herb", "vegetable", "fruit_tree", "garden", "succulent"]);
const INDOOR_CATS = new Set(["houseplant", "succulent", "herb"]);
const DIFF_RANK = { easy: 0, moderate: 1, hard: 2 } as const;

export function suggestFor(place: Place, species: SpeciesPick[], ownedSlugs: Set<string>, limit = 6): SpeciesPick[] {
  const cats = place.kind === "room" ? INDOOR_CATS : OUTDOOR_CATS;
  const have = placeLight(place);
  const near = (s: SpeciesPick) => Math.abs(NEED[s.light] - have);
  return species
    .filter((s) => cats.has(s.category) && !ownedSlugs.has(s.slug) && lightFit(s.light, place).fit === "good")
    .sort((a, b) => near(a) - near(b) || DIFF_RANK[a.difficulty] - DIFF_RANK[b.difficulty] || a.name.localeCompare(b.name, "he"))
    .slice(0, limit);
}
