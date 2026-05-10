import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/me/premium-status
 *
 * Returns whether the current logged-in user has previously signaled
 * Premium intent (a row in the `waitlist` table with
 * `most_interested_in = 'premium'`).
 *
 * Used by the beta page to auto-unlock decision tree + scenario
 * expansion for users who already gave the signal — they shouldn't
 * see the Premium CTA again on a different device or after clearing
 * cookies.
 *
 * Response (always 200):
 *   { premium: boolean, willingToPayEur: number | null }
 *
 * Anonymous callers always get { premium: false, willingToPayEur: null }
 * — we never leak DB lookups for unauthenticated users.
 */

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase().trim();
  if (!email) {
    return Response.json({ premium: false, willingToPayEur: null });
  }

  try {
    // Raw SQL because the waitlist table isn't in the Prisma schema (it
    // was created via a manual migration). Result shape is explicit.
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
      return Response.json({ premium: false, willingToPayEur: null });
    }
    return Response.json({
      premium: true,
      willingToPayEur: rows[0]?.willing_to_pay_eur ?? null,
    });
  } catch (err) {
    console.error("[/api/me/premium-status] DB error:", err);
    // Don't fail the page over this — degrade to "not premium" so the
    // CTA still shows. Worst case the user re-signals and waitlist
    // upserts on the existing email row (idempotent).
    return Response.json({ premium: false, willingToPayEur: null });
  }
}
