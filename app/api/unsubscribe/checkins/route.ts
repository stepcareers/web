/**
 * GET /api/unsubscribe/checkins?token=<signed>
 *
 * One-click unsubscribe link embedded in every check-in email. Verifies
 * the HMAC token, sets `checkins_unsubscribed_at` on the user, and
 * redirects to a confirmation page.
 *
 * GET semantics so it works from email clients that don't issue POSTs
 * on link clicks. We also accept POST for RFC 8058 ("List-Unsubscribe-Post")
 * which Gmail uses when surfacing the native unsubscribe button.
 *
 * No auth required — the signed token IS the auth.
 */
import { prisma } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/checkins/unsubscribe-token";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/unsubscribed?status=missing-token", request.url));
  }

  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return NextResponse.redirect(new URL("/unsubscribed?status=invalid", request.url));
  }

  // Idempotent — if already unsubscribed we still redirect to the OK
  // page so the user sees a confirmation rather than an error.
  await prisma.user.update({
    where: { id: userId },
    data: { checkinsUnsubscribedAt: new Date() },
  }).catch(() => {
    // User row deleted via GDPR; nothing to update. Treat as success.
  });

  return NextResponse.redirect(new URL("/unsubscribed?status=ok", request.url));
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
