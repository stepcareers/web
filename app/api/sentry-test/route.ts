/**
 * Sentry sanity-check endpoint.
 *
 * Hit GET /api/sentry-test in production once after wiring Sentry up.
 * It throws a tagged error so we can confirm:
 *   1. The server-side SDK is initialized
 *   2. instrumentation.ts is picking up the nodejs runtime config
 *   3. Errors reach the Sentry dashboard with readable stack traces
 *
 * Remove this route once verified — keeping a "throw on demand" endpoint
 * in prod is a footgun.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  throw new Error(
    "Sentry sanity-check — if you see this in the Sentry dashboard, the wiring works.",
  );
}
