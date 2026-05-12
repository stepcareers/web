import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/me/premium-status
 *
 * Returns whether the current logged-in user has Premium access right
 * now. Two paths qualify:
 *   1. A paid Premium plan — `users.premium_until > NOW()` (set by
 *      the Stripe webhook on checkout.session.completed and
 *      subscription renewals).
 *   2. The legacy intent signal — a row in `waitlist` with
 *      `most_interested_in = 'premium'`. Pre-Stripe early users got
 *      Premium just by signaling intent + email; we honour that
 *      forever so we don't yank features from them. Once those users
 *      churn or this flag becomes noise, drop the fallback.
 *
 * Response (always 200):
 *   { premium: boolean, willingToPayEur: number | null, until: string | null, lifetime: boolean }
 *
 * Anonymous callers always get the not-premium response — we never
 * leak DB lookups for unauthenticated users.
 */

export const runtime = "nodejs";

const ONE_CENTURY_MS = 100 * 365 * 24 * 60 * 60 * 1000;

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email?.toLowerCase().trim();
  if (!userId || !email) {
    return Response.json({
      premium: false,
      willingToPayEur: null,
      until: null,
      lifetime: false,
    });
  }

  // Path 1 — paid Premium via Stripe.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { premiumUntil: true },
  });
  const until = user?.premiumUntil ?? null;
  if (until && until.getTime() > Date.now()) {
    const lifetime = until.getTime() > Date.now() + ONE_CENTURY_MS;
    return Response.json({
      premium: true,
      willingToPayEur: null,
      until: until.toISOString(),
      lifetime,
    });
  }

  // Path 2 — legacy intent signal. Best-effort: a DB blip shouldn't
  // strip Premium UI from a user who hasn't even paid yet, so we
  // degrade to "not premium" on error.
  try {
    const rows = await prisma.$queryRaw<
      { willing_to_pay_eur: number | null }[]
    >`
      SELECT willing_to_pay_eur
      FROM waitlist
      WHERE email = ${email}
        AND most_interested_in = 'premium'
      LIMIT 1
    `;
    if (rows.length === 0) {
      return Response.json({
        premium: false,
        willingToPayEur: null,
        until: null,
        lifetime: false,
      });
    }
    return Response.json({
      premium: true,
      willingToPayEur: rows[0]?.willing_to_pay_eur ?? null,
      until: null,
      lifetime: false,
    });
  } catch (err) {
    console.error("[/api/me/premium-status] DB error:", err);
    return Response.json({
      premium: false,
      willingToPayEur: null,
      until: null,
      lifetime: false,
    });
  }
}
