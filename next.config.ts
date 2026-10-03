import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { assertEnv } from "./src/env";

// Fail the build early, with a clear list, when a setting in Vercel is missing or malformed.
assertEnv();

const isDev = process.env.NODE_ENV !== "production";
const origin = (url: string | undefined) => {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
};
const images = origin(process.env.NEXT_PUBLIC_IMAGES_URL);
const supabase = origin(process.env.NEXT_PUBLIC_SUPABASE_URL);
// Cloudflare Turnstile ("I'm human" check on login/signup) – only allowed when it's configured.
const turnstile = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? "https://challenges.cloudflare.com" : "";

/**
 * Content-Security-Policy: the browser may only load images from our R2 bucket, talk to Supabase + R2 uploads,
 * embed YouTube, and nobody may frame the site (clickjacking).
 * Scripts: Next.js App Router streams inline scripts, so 'unsafe-inline' is needed without per-request nonces
 * (nonces would make every page dynamic). Everything else is locked down.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${turnstile}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${images}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} ${supabase.replace(/^https:/, "wss:")} https://*.r2.cloudflarestorage.com${isDev ? " ws:" : ""}`.replace(/\s+/g, " "),
  `frame-src https://www.youtube-nocookie.com https://www.youtube.com ${turnstile}`.trim(),
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // geolocation: weather "by my location". Motion sensors stay allowed for the phone-compass feature.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Reading content moved into the magazine (2026-09): keep old links working.
  async redirects() {
    return [
      { source: "/knowledge", destination: "/magazine/plants", permanent: true },
      { source: "/knowledge/:slug", destination: "/magazine/plants/:slug", permanent: true },
      // The blog became "החממה", the community feed on the home page
      { source: "/blog", destination: "/", permanent: true },
      { source: "/magazine/blog", destination: "/", permanent: true },
    ];
  },
};

// Error monitoring: only wraps the build when Sentry is configured. Source maps are uploaded when SENTRY_AUTH_TOKEN is set,
// and browser reports go through our own /monitoring route (no extra CSP host, not blocked by ad blockers).
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
      tunnelRoute: "/monitoring",
      widenClientFileUpload: true,
      silent: !process.env.CI,
      telemetry: false,
    })
  : nextConfig;
