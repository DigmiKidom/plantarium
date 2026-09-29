import { describe, expect, it } from "vitest";
import { betterPlace, climateAlerts, dueOnDay, fertilizePlan, lightFit, placeLight, seasonOf, waterPlan } from "./care";
import type { CareInfo, MyPlant, Place } from "./types";
import type { Weather } from "@/lib/weather/types";

const care: CareInfo = {
  light: "bright_indirect",
  waterMin: 7,
  waterMax: 9,
  humidityMin: 60,
  humidityMax: 80,
  tempMin: 15,
  tempMax: 30,
  fertilizeDays: 30,
  fertilizeSeason: "spring_summer",
  seasonal: { spring: { water_factor: 1 }, summer: { water_factor: 0.8 }, autumn: { water_factor: 1.1 }, winter: { water_factor: 1.6 } },
};
const plant = (over: Partial<MyPlant> = {}): MyPlant => ({
  id: "p1",
  name: "מוני",
  speciesName: "מונסטרה",
  speciesSlug: "monstera-deliciosa",
  scientificName: "Monstera deliciosa",
  category: "houseplant",
  photoUrl: null,
  ownPhotoUrl: null,
  placeId: null,
  potCm: 16,
  medium: null,
  waterEveryDays: null,
  acquiredOn: null,
  notes: null,
  createdAt: "2026-01-01T00:00:00Z",
  lastWaterAt: null,
  lastFertilizeAt: null,
  care,
  ...over,
});
const room = (direction: Place["direction"], name = "סלון"): Place => ({ id: name, name, kind: "room", direction });
const balcony: Place = { id: "b", name: "מרפסת", kind: "balcony", direction: "sw" };
const weather = (over: Partial<Weather> = {}): Weather => ({
  temp: 25, feelsLike: 25, humidity: 55, wind: 5, code: 0, isDay: true, max: 27, min: 18, uv: 5,
  days: [{ date: "2026-04-15", max: 27, min: 18, rain: 0, rainChance: 0 }],
  ...over,
});
const APRIL = new Date(2026, 3, 15, 10);
const daysAgo = (n: number) => new Date(APRIL.getTime() - n * 86_400_000).toISOString();

describe("seasons (Israel)", () => {
  it("maps months to seasons", () => {
    expect(seasonOf(new Date(2026, 0, 10))).toBe("winter");
    expect(seasonOf(new Date(2026, 3, 10))).toBe("spring");
    expect(seasonOf(new Date(2026, 6, 10))).toBe("summer");
    expect(seasonOf(new Date(2026, 9, 10))).toBe("autumn");
  });
});

describe("light", () => {
  it("south windows are brighter than north, balconies brighter than rooms", () => {
    expect(placeLight(room("s"))).toBeGreaterThan(placeLight(room("n")));
    expect(placeLight(balcony)).toBeGreaterThan(placeLight(room("sw")));
    expect(placeLight(room(null))).toBe(1);
  });
  it("flags too dark and too bright places", () => {
    expect(lightFit("direct", room("n")).fit).toBe("dark");
    expect(lightFit("low", balcony).fit).toBe("bright");
    expect(lightFit("bright_indirect", room("e")).fit).toBe("good");
    expect(lightFit("bright_indirect", null).fit).toBe("unknown");
  });
  it("suggests a better place only when one fits", () => {
    const places = [room("n", "סלון"), room("e", "מטבח")];
    expect(betterPlace("bright_indirect", places[0], places)?.name).toBe("מטבח");
    expect(betterPlace("bright_indirect", places[1], places)).toBeNull();
  });
});

describe("water plan", () => {
  it("uses the species range in spring", () => {
    const p = waterPlan(plant({ lastWaterAt: daysAgo(3) }), room("e"), APRIL);
    expect(p.every).toBe(8);
    expect(p.daysLeft).toBe(5);
    expect(p.status).toBe("ok");
  });
  it("marks overdue, today and unknown", () => {
    expect(waterPlan(plant({ lastWaterAt: daysAgo(12) }), room("e"), APRIL).status).toBe("overdue");
    expect(waterPlan(plant({ lastWaterAt: daysAgo(8) }), room("e"), APRIL).status).toBe("today");
    expect(waterPlan(plant(), room("e"), APRIL).status).toBe("unknown");
  });
  it("waters more often in summer, on a hot balcony and in heat", () => {
    const spring = waterPlan(plant(), room("e"), APRIL).every;
    const summer = waterPlan(plant(), room("e"), new Date(2026, 6, 15)).every;
    const hotBalcony = waterPlan(plant(), balcony, new Date(2026, 6, 15), weather({ max: 35 })).every;
    expect(summer).toBeLessThan(spring);
    expect(hotBalcony).toBeLessThan(summer);
  });
  it("never goes below half or above double the species rhythm", () => {
    const extreme = waterPlan(plant({ potCm: 8 }), { ...balcony, kind: "garden" }, new Date(2026, 6, 15), weather({ max: 40, humidity: 10 })).every;
    expect(extreme).toBeGreaterThanOrEqual(4);
    const winter = waterPlan(plant({ potCm: 50 }), room(null), new Date(2026, 0, 15)).every;
    expect(winter).toBeLessThanOrEqual(16);
  });
  it("respects the user's own rhythm", () => {
    expect(waterPlan(plant({ waterEveryDays: 3 }), balcony, new Date(2026, 6, 15), weather({ max: 40 })).every).toBe(3);
  });
  it("falls back to weekly for plants without data", () => {
    expect(waterPlan(plant({ care: null }), null, APRIL).every).toBe(7);
  });
  it("repeats in the weekly table", () => {
    const p = waterPlan(plant({ waterEveryDays: 3, lastWaterAt: daysAgo(2) }), null, APRIL);
    expect([0, 1, 2, 3, 4, 5, 6].filter((d) => dueOnDay(p, d))).toEqual([1, 4]);
  });
});

describe("fertilizing", () => {
  it("rests outside the growing season", () => {
    expect(fertilizePlan(plant(), new Date(2026, 11, 1)).active).toBe(false);
    expect(fertilizePlan(plant(), APRIL).active).toBe(true);
  });
});

describe("climate alerts", () => {
  it("warns about a cold night on the balcony", () => {
    const alerts = climateAlerts(plant(), balcony, weather({ days: [{ date: "d", max: 20, min: 8, rain: 0, rainChance: 0 }] }), APRIL);
    expect(alerts.some((a) => a.kind === "cold")).toBe(true);
  });
  it("warns about dry air for humidity lovers", () => {
    expect(climateAlerts(plant(), room("e"), weather({ humidity: 30 }), APRIL).some((a) => a.kind === "dry")).toBe(true);
  });
  it("is quiet when everything fits", () => {
    expect(climateAlerts(plant(), room("e"), weather({ humidity: 65 }), APRIL)).toEqual([]);
  });
});
