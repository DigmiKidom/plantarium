"use client";

/**
 * Browser side of error monitoring. Sentry is loaded lazily, and only when NEXT_PUBLIC_SENTRY_DSN is set,
 * so it adds nothing to the first page load. Until it has loaded, the user id and errors are kept and sent after.
 */
type Sentry = typeof import("@sentry/nextjs");

let sentry: Sentry | null = null;
let userId: string | null = null;
const queued: unknown[] = [];

export function attachSentry(s: Sentry) {
  sentry = s;
  s.setUser(userId ? { id: userId } : null);
  for (const e of queued.splice(0)) s.captureException(e);
}

/** Who is signed in – the id only, never the email. */
export function setMonitoringUser(id: string | null) {
  userId = id;
  sentry?.setUser(id ? { id } : null);
}

/** Report an error caught by an error page. */
export function reportError(error: unknown) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  if (sentry) sentry.captureException(error);
  else if (queued.length < 10) queued.push(error);
}
