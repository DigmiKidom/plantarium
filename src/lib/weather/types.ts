export type Weather = {
  temp: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  code: number;
  isDay: boolean;
  max: number;
  min: number;
  uv: number;
};

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

/** WMO weather codes (used by Open-Meteo) → kind + Hebrew text. */
export function describeWeather(code: number): { kind: WeatherKind; he: string } {
  if (code === 0) return { kind: "clear", he: "בהיר" };
  if (code === 1) return { kind: "partly", he: "בהיר ברובו" };
  if (code === 2) return { kind: "partly", he: "מעונן חלקית" };
  if (code === 3) return { kind: "cloudy", he: "מעונן" };
  if (code === 45 || code === 48) return { kind: "fog", he: "ערפל" };
  if (code >= 51 && code <= 57) return { kind: "drizzle", he: "טפטוף" };
  if (code === 61 || code === 80) return { kind: "rain", he: "גשם קל" };
  if (code === 63 || code === 81) return { kind: "rain", he: "גשם" };
  if (code === 65 || code === 82) return { kind: "rain", he: "גשם כבד" };
  if (code === 66 || code === 67) return { kind: "rain", he: "גשם קופא" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: "snow", he: "שלג" };
  if (code >= 95) return { kind: "storm", he: "סופת רעמים" };
  return { kind: "cloudy", he: "מעונן" };
}

/** One short plant-care hint for today's weather. */
export function plantTip(w: Weather): string {
  const { kind } = describeWeather(w.code);
  if (kind === "rain" || kind === "storm" || kind === "drizzle") return "יורד גשם – צמחי חוץ יכולים לדלג על השקיה היום";
  if (w.max >= 32) return "יום חם – השקו את צמחי החוץ בבוקר או בערב";
  if (w.min <= 8) return "לילה קר – כדאי להכניס צמחים רגישים פנימה";
  if (w.humidity < 35) return "אוויר יבש – צמחים טרופיים ישמחו לריסוס";
  if (w.uv >= 8) return "קרינה חזקה – צמחים עדינים עדיף בצל חלקי";
  return "מזג אוויר נוח לצמחים";
}
