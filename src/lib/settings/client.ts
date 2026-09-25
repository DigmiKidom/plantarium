"use client";

import { ONE_YEAR, THEME_COOKIE, type Theme } from "./schema";

/** Applies a theme to the page now and remembers it in this browser. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

export function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/** Fired when the signed-in user's profile changes, so the nav can refresh. */
export const PROFILE_CHANGED = "plantarium:profile-changed";
export const notifyProfileChanged = () => window.dispatchEvent(new Event(PROFILE_CHANGED));
