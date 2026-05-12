/**
 * Premium-gating helpers.
 *
 * Single source of truth for "is this user premium right now?". Used by
 * route handlers that gate Premium features (decision tree, scenarios)
 * and by the /account UI to decide what to show.
 */
import { prisma } from "@/lib/db";

/**
 * True when `premiumUntil` is in the future. Brief lapses (card decline
 * grace, processing delays) don't immediately revoke access — we trust
 * the timestamp Stripe last gave us.
 */
export async function isUserPremium(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { premiumUntil: true },
  });
  return !!u?.premiumUntil && u.premiumUntil.getTime() > Date.now();
}

/**
 * Returns the same info plus the raw expiry timestamp, so callers can
 * render messages like "Premium until Jun 12, 2026" without a second
 * fetch. Useful for the /account status card.
 */
export async function getPremiumStatus(userId: string): Promise<{
  active: boolean;
  until: Date | null;
  lifetime: boolean;
}> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { premiumUntil: true },
  });
  const until = u?.premiumUntil ?? null;
  const active = !!until && until.getTime() > Date.now();
  // Lifetime plans are written with year >= 9999 by the webhook handler.
  // 100-year cutoff is a safe heuristic that survives clock skew and
  // future plan tweaks without locking us into checking year === 9999.
  const oneCenturyFromNow = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;
  const lifetime = !!until && until.getTime() > oneCenturyFromNow;
  return { active, until, lifetime };
}
