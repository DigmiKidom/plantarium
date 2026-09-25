import { z } from "zod";

/**
 * All user settings live here. To add a new setting:
 * 1. add a field to settingsSchema (with a default),
 * 2. add a control for it in src/components/settings/settings-view.tsx.
 */
export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const settingsSchema = z.object({
  theme: z.enum(THEMES).default("light"),
});

export type Settings = z.infer<typeof settingsSchema>;

/** Reads settings from anything (DB JSON, cookie) and fills in defaults. */
export const parseSettings = (raw: unknown): Settings => settingsSchema.catch({ theme: "light" }).parse(raw ?? {});

export const THEME_COOKIE = "pl_theme";
export const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Tiny script for <head>: applies the saved theme before the first paint, so there is no white flash.
 * Keep it dependency-free.
 */
export const themeInitScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(dark|light)/);if(m&&m[1]==="dark"){document.documentElement.setAttribute("data-theme","dark")}}catch(e){}})();`;
