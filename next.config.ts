import type { NextConfig } from "next";

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

/**
 * Content-Security-Policy: the browser may only load images from our R2 bucket, talk to Supabase + R2 uploads,
 * embed YouTube, and nobody may frame the site (clickjacking).
 * Scripts: Next.js App Router streams inline scripts, so 'unsafe-inline' is needed without per-request nonces
 * (nonces would make every page dynamic). Everything else is locked down.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${images}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} ${supabase.replace(/^https:/, "wss:")} https://*.r2.cloudflarestorage.com${isDev ? " ws:" : ""}`.replace(/\s+/g, " "),
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
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

export default nextConfig;
