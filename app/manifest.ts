/**
 * Web App Manifest — auto-served at /manifest.webmanifest.
 *
 * Lets Chrome/Edge/Safari treat Step as an installable app: home-screen
 * icon, standalone window (no browser chrome), themed splash. We don't
 * ship a service worker yet (no offline + no web push for v1), but this
 * is the minimum required to look installable.
 *
 * `start_url: "/beta"` skips the home page on second open — most installs
 * happen after a user has already used the planner, so we drop them
 * straight into the action.
 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Step — Find your next career step",
    short_name: "Step",
    description:
      "AI career advice grounded in 10,500+ real career paths. 3–5 ranked moves, concrete 90-day actions, honest take.",
    start_url: "/beta",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    categories: ["productivity", "education", "business"],
    lang: "en",
    icons: [
      {
        src: "/icon",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
