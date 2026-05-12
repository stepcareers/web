/**
 * Removed — was a one-shot sanity check for Sentry wiring (proven working).
 * Keeping the file as a stub avoids breaking inbound URLs cached anywhere;
 * the route returns 410 Gone so it's clear this was retired on purpose.
 */
export const runtime = "nodejs";

export async function GET() {
  return new Response("Gone.", { status: 410 });
}
