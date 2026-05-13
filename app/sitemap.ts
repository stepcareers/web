import type { MetadataRoute } from "next";

/**
 * Dynamic sitemap — auto-served at /sitemap.xml.
 *
 * Lists every page worth indexing. Excludes auth-gated pages
 * (/account) and the auth handler itself (/api/auth/*) — those are
 * handled by robots.ts.
 *
 * lastModified is bumped on every deploy (Vercel rebuilds), which
 * tells Google's crawler that pages might have changed and to
 * re-fetch.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://step.careers";
  const lastModified = new Date();
  return [
    { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/beta`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/how-it-works`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/about`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    // Legal pages — indexable so search engines, app-store policies, and
    // payment providers can find them.
    { url: `${base}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
