import type { Instrumentation } from "next";

// Server-side error monitoring (Sentry). Does nothing until NEXT_PUBLIC_SENTRY_DSN is set in Vercel.
export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const [Sentry, { sentryOptions }] = await Promise.all([import("@sentry/nextjs"), import("@/lib/monitoring/options")]);
  Sentry.init(sentryOptions);
}

// Errors thrown while rendering pages, in server actions and in route handlers.
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(...args);
};
