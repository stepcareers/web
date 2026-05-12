/**
 * Sentry — edge runtime initialization.
 *
 * Used by Next.js middleware and any route handlers explicitly opting
 * into the edge runtime (`export const runtime = "edge"`). Our recommend
 * pipeline runs on nodejs, not edge, so this primarily protects the
 * sitemap/robots and any future edge handlers.
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
