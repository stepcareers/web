/**
 * Sentry — server-side initialization (Node.js runtime).
 *
 * Captures errors from API routes, server components, and route handlers
 * running on Vercel's Node.js serverless functions.
 *
 * Same sampling philosophy as the client config:
 *   - 10% of transactions for perf data
 *   - 100% of errors
 *
 * No-ops silently when SENTRY_DSN is not set.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? "development",
    tracesSampleRate: 0.1,
    sampleRate: 1.0,
  });
}
