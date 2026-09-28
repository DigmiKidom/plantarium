import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reading content moved into the magazine (2026-09): keep old links working.
  async redirects() {
    return [
      { source: "/knowledge", destination: "/magazine/plants", permanent: true },
      { source: "/knowledge/:slug", destination: "/magazine/plants/:slug", permanent: true },
      { source: "/blog", destination: "/magazine/blog", permanent: true },
    ];
  },
};

export default nextConfig;
