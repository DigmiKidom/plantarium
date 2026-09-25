/**
 * The site's absolute base URL.
 * Order: NEXT_PUBLIC_SITE_URL (if set and non-empty) → Vercel's deployment URL → localhost.
 * Empty strings count as "not set", so a blank env var on Vercel can't break the build.
 */
function pick(...values: (string | undefined)[]): string | undefined {
  return values.map((v) => v?.trim()).find((v) => v);
}

export function getSiteUrl(): URL {
  const explicit = pick(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return new URL(explicit);

  const vercelHost =
    process.env.VERCEL_ENV === "production"
      ? pick(process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL)
      : pick(process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL);
  if (vercelHost) return new URL(`https://${vercelHost}`);

  return new URL("http://localhost:3000");
}
