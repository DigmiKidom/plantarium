import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { Weather } from "@/lib/weather/types";

// Current weather from Open-Meteo (free, no API key). Cached 15 minutes per ~1 km area,
// so every visitor in the same city shares one request.
const CACHE_SECONDS = 900;

const coords = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

const openMeteo = z.object({
  current: z.object({
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    wind_speed_10m: z.number(),
    weather_code: z.number(),
    is_day: z.number(),
  }),
  daily: z.object({
    temperature_2m_max: z.array(z.number()).min(1),
    temperature_2m_min: z.array(z.number()).min(1),
    uv_index_max: z.array(z.number().nullable()).min(1),
  }),
});

export async function GET(request: NextRequest) {
  const parsed = coords.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "bad coordinates" }, { status: 400 });
  const lat = parsed.data.lat.toFixed(2);
  const lon = parsed.data.lon.toFixed(2);

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day" +
    "&daily=temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto&forecast_days=1";

  try {
    const res = await fetch(url, { next: { revalidate: CACHE_SECONDS }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const data = openMeteo.parse(await res.json());
    const c = data.current;
    const weather: Weather = {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      humidity: Math.round(c.relative_humidity_2m),
      wind: Math.round(c.wind_speed_10m),
      code: c.weather_code,
      isDay: c.is_day === 1,
      max: Math.round(data.daily.temperature_2m_max[0]),
      min: Math.round(data.daily.temperature_2m_min[0]),
      uv: Math.round(data.daily.uv_index_max[0] ?? 0),
    };
    return NextResponse.json(weather, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600` },
    });
  } catch (e) {
    console.error(JSON.stringify({ at: "api.weather", error: e instanceof Error ? e.message : String(e) }));
    return NextResponse.json({ error: "weather unavailable" }, { status: 502 });
  }
}
