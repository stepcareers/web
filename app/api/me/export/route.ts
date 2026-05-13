/**
 * GDPR data export — GET /api/me/export
 *
 * Returns a JSON dump of every personal datum we hold about the signed-in
 * user. Content-Disposition: attachment forces a download named
 * `step-data-export-<date>.json`.
 *
 * Scope (everything tied to the user's identity):
 *   - User row (profile)
 *   - Onboarding Sessions + their Input + Result
 *   - EmailSubscription rows
 *   - Account rows (OAuth provider links) — minus the secret tokens.
 *
 * We deliberately strip:
 *   - access_token / refresh_token / id_token / session_state — these are
 *     credentials we hold for our OAuth handshake with the IdP, not data
 *     "about" the user. Including them would be a security footgun.
 *
 * Auth: NextAuth session cookie required. 401 otherwise.
 */
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Fetch in parallel — these are independent reads.
  const [user, sessions, emailSubs, accounts, plans, feedback, checkinResponses] =
    await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        image: true,
        locale: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        premiumUntil: true,
        checkinsUnsubscribedAt: true,
        // Stripe Customer ID intentionally omitted — it's an internal
        // billing identifier, not personal data.
      },
    }),
    prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        input: true,
        result: {
          select: {
            id: true,
            recommendations: true,
            model: true,
            promptVersion: true,
            createdAt: true,
            deletedAt: true,
            // Deliberately omit cost/token columns — internal accounting,
            // not user data.
          },
        },
      },
    }),
    prisma.emailSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.account.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        type: true,
        // Secret credentials intentionally omitted.
      },
    }),
    // Saved plans (incl. soft-deleted — GDPR right of access is about
    // showing everything we still hold, even if hidden from the UI).
    prisma.plan.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    // Per-recommendation thumbs-up/down ratings the user has cast.
    prisma.planRecommendationFeedback.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    // Structured 1-click check-in answers ("started", "stuck", etc.)
    prisma.planCheckinResponse.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 5,
    user,
    accounts,
    sessions,
    plans,
    planRecommendationFeedback: feedback,
    planCheckinResponses: checkinResponses,
    emailSubscriptions: emailSubs,
    _meta: {
      notes:
        "OAuth provider tokens (access/refresh/id_token) are intentionally excluded — they are credentials we hold for the IdP handshake, not personal data. Internal cost/token accounting columns on results are also excluded. Soft-deleted plans are included so this export reflects everything we still hold.",
    },
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="step-data-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}