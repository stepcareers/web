/**
 * Next.js 15 instrumentation hook.
 *
 * Called once per runtime (nodejs / edge) at server boot. We use it to
 * lazy-load the Sentry server/edge configs so they only run in the
 * appropriate environment.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture errors thrown in React Server Components / route handlers so
// they show up in Sentry instead of being silently swallowed.
export const onRequestError = Sentry.captureRequestError;
