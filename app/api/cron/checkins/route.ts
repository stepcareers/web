/**
 * Vercel cron — daily Premium check-in dispatch.
 *
 * Runs once a day. For every active Premium user with a non-deleted plan
 * generated in the last 400 days, computes the highest pending check-in
 * day and sends that email. Monotonic state via `plan.lastCheckinDay`.
 *
 * Auth: Vercel cron requests carry `Authorization: Bearer ${CRON_SECRET}`.
 * Reject anything else so this can't be invoked by anyone with the URL.
 *
 * Schedule: see vercel.json — currently every day at 09:00 UTC, which is
 * 11:00 in CET and 10:00 in BST. Tweakable without code changes.
 *
 * Idempotency: re-running the cron on the same day does nothing because
 * `lastCheckinDay` already covers the relevant window. If we skip a day
 * (Vercel outage, missed cron, ...) the next run picks the highest
 * applicable day and "catches up" without sending stale earlier ones.
 */
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { CHECKIN_DAYS, type CheckinDay } from "@/lib/checkins/schedule";
import { buildCheckinEmail } from "@/lib/checkins/templates";
import { signUnsubscribeToken } from "@/lib/checkins/unsubscribe-token";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Cap matches the longest realistic run (a few hundred sends @ ~200ms each).
export const maxDuration = 60;

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://step.careers");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function authorize(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Without CRON_SECRET set we'd be open to anyone with the URL. Better
    // to fail closed than to send mass email.
    return false;
  }
  const got = request.headers.get("authorization");
  return got === `Bearer ${expected}`;
}

/**
 * Returns the highest checkin day that's:
 *   - already elapsed (daysSincePlan >= day)
 *   - not yet sent (day > lastCheckinDay)
 * If none, returns null and the plan is skipped this run.
 */
function pickNextCheckinDay(
  daysSincePlan: number,
  lastCheckinDay: number,
): CheckinDay | null {
  let best: CheckinDay | null = null;
  for (const d of CHECKIN_DAYS) {
    if (d <= daysSincePlan && d > lastCheckinDay) {
      best = d;
    }
  }
  return best;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return new Response("unauthorized", { status: 401 });
  }
  return runDispatch();
}

// Vercel cron pings via GET by default. Support both so we can also call
// it manually with curl for testing.
export async function GET(request: Request) {
  if (!authorize(request)) {
    return new Response("unauthorized", { status: 401 });
  }
  return runDispatch();
}

async function runDispatch(): Promise<NextResponse> {
  const cutoff = new Date(Date.now() - 400 * ONE_DAY_MS);

  // Pull candidate plans: active (not soft-deleted), recent enough that
  // they're still in the cadence window. We then filter premium + unsub
  // in JS so we don't need a complex SQL join.
  const plans = await prisma.plan.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: cutoff },
    },
    select: {
      id: true,
      userId: true,
      title: true,
      createdAt: true,
      lastCheckinDay: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const stats = {
    candidatePlans: plans.length,
    skippedNotPremium: 0,
    skippedUnsubscribed: 0,
    skippedNoPendingDay: 0,
    sent: 0,
    failed: 0,
    errors: [] as { planId: string; reason: string }[],
  };

  if (plans.length === 0) {
    return NextResponse.json(stats);
  }

  // De-dupe userIds for a single user lookup pass.
  const userIds = Array.from(new Set(plans.map((p) => p.userId)));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      email: true,
      name: true,
      premiumUntil: true,
      checkinsUnsubscribedAt: true,
    },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const now = Date.now();

  for (const plan of plans) {
    const user = userById.get(plan.userId);
    if (!user) continue;

    // Gate 1: still Premium right now.
    if (!user.premiumUntil || user.premiumUntil.getTime() <= now) {
      stats.skippedNotPremium += 1;
      continue;
    }

    // Gate 2: not unsubscribed from check-ins.
    if (user.checkinsUnsubscribedAt) {
      stats.skippedUnsubscribed += 1;
      continue;
    }

    const daysSincePlan = Math.floor((now - plan.createdAt.getTime()) / ONE_DAY_MS);
    const day = pickNextCheckinDay(daysSincePlan, plan.lastCheckinDay);
    if (!day) {
      stats.skippedNoPendingDay += 1;
      continue;
    }

    const firstName = (user.name ?? "").split(/\s+/)[0] ?? "";
    const planUrl = `${APP_URL}/account/plans/${plan.id}`;
    const token = signUnsubscribeToken(plan.userId);
    const unsubscribeUrl = `${APP_URL}/api/unsubscribe/checkins?token=${encodeURIComponent(token)}`;

    const tpl = buildCheckinEmail(day, {
      firstName,
      planTitle: plan.title,
      planUrl,
      unsubscribeUrl,
    });

    const send = await sendEmail({
      to: user.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      replyTo: "hi@step.careers",
      listUnsubscribeUrl: unsubscribeUrl,
      tag: `checkin-d${day}`,
    });

    if (!send.ok) {
      stats.failed += 1;
      stats.errors.push({ planId: plan.id, reason: send.reason });
      // Don't mark as sent — we'll retry tomorrow.
      continue;
    }

    // Advance the watermark only after the send actually succeeded.
    await prisma.plan.update({
      where: { id: plan.id },
      data: { lastCheckinDay: day },
    });
    stats.sent += 1;
  }

  return NextResponse.json(stats);
}
