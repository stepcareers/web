/**
 * Sentry — browser-side initialization.
 *
 * Next.js 15+ auto-loads this file in the browser, replacing the older
 * `sentry.client.config.ts` convention. Works with both Webpack and
 * Turbopack (the legacy filename only worked with Webpack).
 *
 * Runs on every page load in the user's browser. Captures unhandled
 * errors, promise rejections, and (optionally) replays of sessions where
 * something went wrong.
 *
 * We sample conservatively to stay inside the free tier (5k events/mo):
 *   - 10% of pageloads send a transaction (perf data)
 *   - 100% of errors send (we want them all)
 *   - Session replay disabled for now (heavy on quota)
 *
 * No-ops silently when NEXT_PUBLIC_SENTRY_DSN is not set so local dev
 * doesn't ship junk events to Sentry.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    // Performance monitoring — sample 10% of transactions to stay under
    // the free-tier event budget.
    tracesSampleRate: 0.1,
    // Catch every error (these are what we actually care about).
    sampleRate: 1.0,
    // Session replay disabled — eats events fast. Re-enable later if we
    // upgrade to a paid plan and want recording of broken sessions.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Filter out errors we don't care about (browser extension noise,
    // cross-origin script errors with no useful info, etc.)
    ignoreErrors: [
      // Chrome extension messaging — we see this in console but it's not
      // our code. Comes from Posthog session recorder.
      "A listener indicated an asynchronous response by returning true",
      // Browser extensions injecting scripts that fail silently.
      "Non-Error promise rejection captured",
      // Network errors that aren't actionable (user lost connection mid-page).
      "Failed to fetch",
      "NetworkError",
    ],
    beforeSend(event) {
      // Drop events on localhost so testing doesn't pollute the dashboard.
      if (
        typeof window !== "undefined" &&
        window.location.hostname === "localhost"
      ) {
        return null;
      }
      return event;
    },
  });
}

// Required by Next 15+ to capture navigation timings for App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
