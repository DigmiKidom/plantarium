import { z } from "zod";

z.config({ jitless: true });

/**
 * Settings check, run once when the site is built (next.config.ts).
 * A malformed value always fails the build; a missing required value fails only the Vercel production build,
 * so CI and local builds still work without secrets.
 */
const url = z.url({ protocol: /^https?$/ });
const present = z.string().trim().min(1);

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: url.optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: present.optional(),
  SUPABASE_SERVICE_ROLE_KEY: present.optional(),
  NEXT_PUBLIC_IMAGES_URL: z.url({ protocol: /^https$/ }).optional(),
  NEXT_PUBLIC_SITE_URL: url.optional(),
  R2_ACCOUNT_ID: present.optional(),
  R2_ACCESS_KEY_ID: present.optional(),
  R2_SECRET_ACCESS_KEY: present.optional(),
  R2_BUCKET: present.optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: present.optional(),
  TURNSTILE_SECRET_KEY: present.optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.url({ protocol: /^https$/ }).optional(),
});

const REQUIRED_IN_PRODUCTION = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_IMAGES_URL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

/** Returns the problems found (empty = all good). Values are trimmed; empty strings count as missing. */
export function envProblems(env: Record<string, string | undefined>): string[] {
  const clean = Object.fromEntries(
    Object.keys(schema.shape).map((k) => [k, env[k]?.trim() ? env[k]!.trim() : undefined]),
  );
  const problems: string[] = [];
  const parsed = schema.safeParse(clean);
  if (!parsed.success) for (const i of parsed.error.issues) problems.push(`${i.path.join(".")}: invalid value`);
  if (env.VERCEL_ENV === "production") {
    for (const k of REQUIRED_IN_PRODUCTION) if (!clean[k]) problems.push(`${k}: missing (required in production)`);
  }
  if (Boolean(clean.NEXT_PUBLIC_TURNSTILE_SITE_KEY) !== Boolean(clean.TURNSTILE_SECRET_KEY)) {
    problems.push("NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY: set both or neither");
  }
  return problems;
}

/** Throws with a readable list when a setting is wrong. Secret values are never printed. */
export function assertEnv(env: Record<string, string | undefined> = process.env) {
  const problems = envProblems(env);
  if (problems.length) throw new Error(`Site settings (environment variables) problem:\n- ${problems.join("\n- ")}`);
}
