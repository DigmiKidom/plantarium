// Runs in the browser before the app starts. Loads Sentry in the background only when it's configured.
import { attachSentry } from "@/lib/monitoring/client";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Promise.all([import("@sentry/nextjs"), import("@/lib/monitoring/options")])
    .then(([Sentry, { sentryOptions }]) => {
      Sentry.init({
        ...sentryOptions,
        // Browser extensions and flaky networks – not our bugs
        ignoreErrors: ["ResizeObserver loop", "Non-Error promise rejection captured", "Load failed", "Failed to fetch"],
        denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-web-extension:\/\//],
      });
      attachSentry(Sentry);
    })
    .catch(() => {});
}
