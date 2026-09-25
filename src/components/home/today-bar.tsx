"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Leaf,
  LocateFixed,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { describeWeather, plantTip, type Weather, type WeatherKind } from "@/lib/weather/types";

type Place = { lat: number; lon: number; name: string };
const DEFAULT_PLACE: Place = { lat: 32.08, lon: 34.78, name: "תל אביב" };
const PLACE_KEY = "plantarium:weather-place";

const ICONS: Record<WeatherKind, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

const timeFmt = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
const dateFmt = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const hebrewFmt = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { day: "numeric", month: "long" });

function readPlace(): Place {
  try {
    const saved = JSON.parse(localStorage.getItem(PLACE_KEY) ?? "null");
    if (saved && typeof saved.lat === "number" && typeof saved.lon === "number") return saved;
  } catch {
    // private mode / blocked storage – use the default
  }
  return DEFAULT_PLACE;
}

/** Ticks exactly on each new minute, so the clock never shows a stale minute. */
function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      timer = setTimeout(tick, 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50);
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, []);
  return now;
}

/** Home page line: live time · date (Gregorian + Hebrew) · current weather + a plant tip. */
export function TodayBar() {
  const now = useNow();
  const [place, setPlace] = useState<Place | null>(null);
  const [weather, setWeather] = useState<Weather | null | "error">(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPlace(readPlace()), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!place) return;
    let active = true;
    const load = () =>
      fetch(`/api/weather?lat=${place.lat}&lon=${place.lon}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((w: Weather) => active && setWeather(w))
        .catch(() => active && setWeather("error"));
    load();
    const refresh = setInterval(load, 15 * 60_000);
    return () => {
      active = false;
      clearInterval(refresh);
    };
  }, [place]);

  const locateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: Place = { lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2), name: "המיקום שלך" };
        try {
          localStorage.setItem(PLACE_KEY, JSON.stringify(p));
        } catch {}
        setPlace(p);
        setLocating(false);
      },
      () => setLocating(false),
      { maximumAge: 60 * 60_000, timeout: 10_000 },
    );
  };

  const w = weather && weather !== "error" ? weather : null;
  const desc = w ? describeWeather(w.code) : null;
  const Icon = desc ? (desc.kind === "clear" && !w!.isDay ? Moon : ICONS[desc.kind]) : Cloud;

  return (
    <section
      aria-label="היום"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm shadow-sm md:px-5"
    >
      <div className="flex items-baseline gap-3">
        <time
          dateTime={now?.toISOString()}
          className="ltr text-2xl font-bold tabular-nums tracking-tight"
          aria-label={now ? `השעה ${timeFmt.format(now)}` : undefined}
        >
          {now ? timeFmt.format(now) : "--:--"}
        </time>
        <span className="flex flex-col leading-tight">
          <span className="font-medium">{now ? dateFmt.format(now) : " "}</span>
          <span className="text-xs text-muted">{now ? hebrewFmt.format(now) : " "}</span>
        </span>
      </div>

      <span className="hidden h-8 w-px bg-border sm:block" aria-hidden />

      {/* On phones the weather gets its own full-width row under the clock */}
      <div className="flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-2 sm:w-auto sm:flex-1">
        {w && desc ? (
          <>
            <span className="flex items-center gap-2">
              <Icon className="size-6 text-primary" aria-hidden />
              <span className="ltr text-xl font-bold tabular-nums">{w.temp}°</span>
              <span className="flex flex-col leading-tight">
                <span className="font-medium">{desc.he}</span>
                <span className="text-xs text-muted">
                  <span className="ltr tabular-nums">
                    {w.max}° / {w.min}°
                  </span>{" "}
                  · {place?.name}
                </span>
              </span>
            </span>
            <span className="flex items-center gap-1 text-muted" title="לחות">
              <Droplets className="size-4" aria-hidden />
              <span className="ltr tabular-nums">{w.humidity}%</span>
              <span className="sr-only">לחות</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-leaf-soft px-3 py-1 text-primary-strong">
              <Leaf className="size-4 shrink-0" aria-hidden />
              {plantTip(w)}
            </span>
          </>
        ) : weather === "error" ? (
          <span className="text-muted">מזג האוויר לא זמין כרגע</span>
        ) : (
          <span className="h-8 w-48 animate-pulse rounded-lg bg-surface-2" aria-hidden />
        )}
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          title="מזג אוויר לפי המיקום שלי"
          aria-label="מזג אוויר לפי המיקום שלי"
          className="ms-auto rounded-full p-2 text-muted hover:bg-surface-2 hover:text-primary disabled:animate-pulse"
        >
          <LocateFixed className="size-5" aria-hidden />
        </button>
      </div>
    </section>
  );
}
