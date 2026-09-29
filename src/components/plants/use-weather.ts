"use client";

import { useEffect, useState } from "react";
import type { Weather } from "@/lib/weather/types";

/** Same place the home "today bar" uses (saved in this browser), default Tel Aviv. */
const PLACE_KEY = "plantarium:weather-place";
type City = { lat: number; lon: number; name: string };
const DEFAULT_CITY: City = { lat: 32.08, lon: 34.78, name: "תל אביב" };

function readCity(): City {
  try {
    const saved = JSON.parse(localStorage.getItem(PLACE_KEY) ?? "null");
    if (saved && typeof saved.lat === "number" && typeof saved.lon === "number") return saved;
  } catch {}
  return DEFAULT_CITY;
}

export type WeatherState = { weather: Weather | null; city: string | null; failed: boolean; locate: () => void; locating: boolean };

/** Today's weather + 3-day forecast for the user's city, and "now" (set after mount to avoid hydration drift). */
export function useWeather(): WeatherState & { now: Date | null } {
  const [city, setCity] = useState<City | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [failed, setFailed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setCity(readCity());
      setNow(new Date());
    }, 0);
    const tick = setInterval(() => setNow(new Date()), 10 * 60_000);
    return () => {
      clearTimeout(t);
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    if (!city) return;
    let active = true;
    fetch(`/api/weather?lat=${city.lat}&lon=${city.lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((w: Weather) => {
        if (!active) return;
        setWeather({ ...w, days: Array.isArray(w.days) ? w.days : [] });
        setFailed(false);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [city]);

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: City = { lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2), name: "המיקום שלך" };
        try {
          localStorage.setItem(PLACE_KEY, JSON.stringify(c));
        } catch {}
        setCity(c);
        setLocating(false);
      },
      () => setLocating(false),
      { maximumAge: 60 * 60_000, timeout: 10_000 },
    );
  };

  return { weather, city: city?.name ?? null, failed, locate, locating, now };
}
