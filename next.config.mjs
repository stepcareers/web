import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Enable when needed:
    // typedRoutes: true,
  },
  // Run env validation on every build to fail-fast on missing keys.
  webpack: (config) => config,
};

// Sentry wraps the config to:
//   - upload sourcemaps to Sentry on prod builds (so stack traces are readable)
//   - tree-shake the SDK when DSN is missing
//   - hide sourcemaps from public bundles
//
// No-ops silently in local dev when SENTRY_AUTH_TOKEN isn't set.
const sentryOptions = {
  // Suppresses source map upload logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps in CI (we don't need them locally).
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Hide source maps from the public bundle.
  hideSourceMaps: true,
};

export default process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig;
