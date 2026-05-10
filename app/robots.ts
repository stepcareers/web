import type { MetadataRoute } from "next";

/**
 * Robots.txt — auto-served at /robots.txt.
 *
 * Allow indexing of public marketing pages. Block auth-gated pages
 * (/account) and ALL /api routes (no SEO value, and we don't want
 * Google triggering LLM calls).
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://step.careers";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/account", "/login"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
