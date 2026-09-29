import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/** Public content is indexable; personal and admin areas are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/plants", "/garden", "/profile", "/settings", "/login", "/signup", "/magazine/write", "/market/new", "/market/edit", "/market/mine"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
