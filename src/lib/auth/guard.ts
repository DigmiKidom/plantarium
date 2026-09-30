import "server-only";
import { headers } from "next/headers";
import { createAdminClient, hasAdmin } from "@/lib/supabase/admin";

/** The visitor's IP (Vercel puts the real one first in x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

/**
 * Counts one attempt for `key` and says whether it's still allowed (max `max` per `windowSeconds`).
 * Stored in the database (auth_attempts, migration 0020) through the service key.
 * Fails open: if the database can't answer, the attempt is allowed (and logged) – better than locking everyone out.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (!hasAdmin()) return true;
  const { data, error } = await createAdminClient().rpc("auth_rate_check", {
    p_key: key.toLowerCase().slice(0, 200),
    p_max: max,
    p_window: `${windowSeconds} seconds`,
  });
  if (error) {
    console.error(JSON.stringify({ at: "auth.rateLimit", code: error.code, error: error.message }));
    return true;
  }
  return data !== false;
}

/** Cloudflare Turnstile ("I'm human" check). Only enforced when TURNSTILE_SECRET_KEY is set. */
export const captchaEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export async function verifyCaptcha(token: FormDataEntryValue | null, ip: string): Promise<boolean> {
  if (!captchaEnabled()) return true;
  if (typeof token !== "string" || !token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    const out = (await res.json()) as { success?: boolean };
    return out.success === true;
  } catch (e) {
    console.error(JSON.stringify({ at: "auth.captcha", error: e instanceof Error ? e.message : String(e) }));
    return false;
  }
}

export const TOO_MANY = "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות";
export const CAPTCHA_FAILED = "האימות האוטומטי נכשל. רעננו את הדף ונסו שוב";
