import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Shared Sentry settings (browser + server). Errors only – no performance tracing or session replay,
 * which keeps us inside the free plan. Personal data stays out: no IP, no email, no cookies or headers.
 */
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN?.trim(),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? "development",
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: 0,
  sendDefaultPii: false,
  beforeSend: scrub,
};

export function scrub(event: ErrorEvent): ErrorEvent {
  if (event.user) event.user = event.user.id ? { id: String(event.user.id) } : undefined;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
    delete event.request.query_string;
  }
  return event;
}
