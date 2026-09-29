import "server-only";
import { createUserClient } from "@/lib/supabase/server";
import { listSpecies } from "@/lib/species/repo";
import type { Category, LightLevel } from "@/lib/species/types";
import type { CareEvent, CareEventType, CareInfo, Direction, MyPlant, Place, PlaceKind, SpeciesPick } from "./types";

type Supa = Awaited<ReturnType<typeof createUserClient>>;

type CareRow = {
  light: LightLevel;
  water_interval_min_days: number;
  water_interval_max_days: number;
  humidity_min: number | null;
  humidity_max: number | null;
  temp_min_c: number | string | null;
  temp_max_c: number | string | null;
  fertilize_interval_days: number | null;
  fertilize_season: string | null;
  seasonal: CareInfo["seasonal"] | null;
};
type PlantRow = {
  id: string;
  nickname: string | null;
  species_name: string | null;
  photo_url: string | null;
  location_id: string | null;
  pot_diameter_cm: number | string | null;
  medium: string | null;
  water_every_days: number | null;
  acquired_on: string | null;
  notes: string | null;
  created_at: string;
  species: {
    slug: string;
    common_name_he: string;
    scientific_name: string;
    category: Category;
    species_care: CareRow | null;
    species_images: { storage_path: string; sort: number }[] | null;
  } | null;
};

const PLANT_COLUMNS =
  "id, nickname, species_name, photo_url, location_id, pot_diameter_cm, medium, water_every_days, acquired_on, notes, created_at, " +
  "species(slug, common_name_he, scientific_name, category, species_care(light, water_interval_min_days, water_interval_max_days, humidity_min, humidity_max, temp_min_c, temp_max_c, fertilize_interval_days, fertilize_season, seasonal), species_images(storage_path, sort))";

const num = (v: number | string | null | undefined) => (v == null || v === "" ? null : Number(v));

function toCare(c: CareRow | null | undefined): CareInfo | null {
  if (!c) return null;
  return {
    light: c.light,
    waterMin: c.water_interval_min_days,
    waterMax: c.water_interval_max_days,
    humidityMin: c.humidity_min,
    humidityMax: c.humidity_max,
    tempMin: num(c.temp_min_c),
    tempMax: num(c.temp_max_c),
    fertilizeDays: c.fertilize_interval_days,
    fertilizeSeason: c.fertilize_season,
    seasonal: c.seasonal ?? {},
  };
}

function toPlant(r: PlantRow, last?: { last_water_at: string | null; last_fertilize_at: string | null }): MyPlant {
  const sp = r.species;
  const speciesName = sp?.common_name_he ?? r.species_name ?? "צמח";
  const firstImage = [...(sp?.species_images ?? [])].sort((a, b) => a.sort - b.sort)[0]?.storage_path ?? null;
  return {
    id: r.id,
    name: r.nickname?.trim() || speciesName,
    speciesName,
    speciesSlug: sp?.slug ?? null,
    scientificName: sp?.scientific_name ?? null,
    category: sp?.category ?? null,
    photoUrl: r.photo_url ?? firstImage,
    ownPhotoUrl: r.photo_url,
    placeId: r.location_id,
    potCm: num(r.pot_diameter_cm),
    medium: r.medium,
    waterEveryDays: r.water_every_days,
    acquiredOn: r.acquired_on,
    notes: r.notes,
    createdAt: r.created_at,
    lastWaterAt: last?.last_water_at ?? null,
    lastFertilizeAt: last?.last_fertilize_at ?? null,
    care: toCare(sp?.species_care),
  };
}

/** Thrown when migration 0016 isn't in the database yet. */
export class NeedsDbUpdate extends Error {}
const check = (error: { code?: string; message?: string } | null) => {
  if (!error) return;
  if (error.code === "42703" || error.code === "PGRST200" || error.code === "PGRST205" || error.code === "42P01") throw new NeedsDbUpdate(error.message);
  throw new Error(error.message);
};

export async function myPlaces(supabase: Supa, userId: string): Promise<Place[]> {
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, kind, direction")
    .eq("user_id", userId)
    .order("sort")
    .order("created_at")
    .returns<{ id: string; name: string; kind: PlaceKind; direction: Direction | null }[]>();
  check(error);
  return data ?? [];
}

async function lastCare(supabase: Supa, ids: string[]) {
  if (!ids.length) return new Map<string, { last_water_at: string | null; last_fertilize_at: string | null }>();
  const { data, error } = await supabase
    .from("user_plant_last_care")
    .select("user_plant_id, last_water_at, last_fertilize_at")
    .in("user_plant_id", ids)
    .returns<{ user_plant_id: string; last_water_at: string | null; last_fertilize_at: string | null }[]>();
  check(error);
  return new Map((data ?? []).map((r) => [r.user_plant_id, r]));
}

export async function myPlants(supabase: Supa, userId: string): Promise<MyPlant[]> {
  const { data, error } = await supabase
    .from("user_plants")
    .select(PLANT_COLUMNS)
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at")
    .returns<PlantRow[]>();
  check(error);
  const rows = data ?? [];
  const last = await lastCare(supabase, rows.map((r) => r.id));
  return rows.map((r) => toPlant(r, last.get(r.id)));
}

export async function myPlant(supabase: Supa, userId: string, id: string) {
  const { data, error } = await supabase
    .from("user_plants")
    .select(PLANT_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle<PlantRow>();
  check(error);
  if (!data) return null;
  const [last, events] = await Promise.all([
    lastCare(supabase, [id]),
    supabase
      .from("care_events")
      .select("id, type, occurred_at, note")
      .eq("user_plant_id", id)
      .order("occurred_at", { ascending: false })
      .limit(100)
      .returns<{ id: string; type: CareEventType; occurred_at: string; note: string | null }[]>(),
  ]);
  const history: CareEvent[] = (events.data ?? []).map((e) => ({ id: e.id, type: e.type, occurredAt: e.occurred_at, note: e.note }));
  return { plant: toPlant(data, last.get(id)), history };
}

export async function speciesPicks(): Promise<SpeciesPick[]> {
  return (await listSpecies({}))
    .filter((s) => s.care)
    .map((s) => ({
      slug: s.slug,
      name: s.common_name_he,
      category: s.category,
      difficulty: s.difficulty,
      light: s.care.light,
      image: s.images[0]?.url ?? null,
    }));
}
