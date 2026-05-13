/**
 * Premium check-in cadence — single source of truth.
 *
 * After a Premium user generates a plan, we send 9 emails over the
 * following year, each themed for that interval. The cadence is dense
 * at the start (when the plan is fresh) and sparse later (when reflection
 * matters more than action).
 *
 * Adding a new touchpoint = add a number here + a template in templates.ts.
 * The cron picks them up automatically. Removing one mid-flight is also
 * fine: existing plans with `lastCheckinDay` past the removed day just
 * stop seeing it.
 *
 * IMPORTANT: keep ASCENDING. The cron picks the highest pending day so a
 * missed day collapses into the next eligible one (we don't backfill
 * skipped earlier days, by design — better to feel current than belated).
 */
export const CHECKIN_DAYS = [1, 3, 7, 14, 30, 60, 90, 180, 365] as const;
export type CheckinDay = (typeof CHECKIN_DAYS)[number];
