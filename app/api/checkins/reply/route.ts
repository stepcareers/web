/**
 * GET /api/checkins/reply?token=<signed>&day=<N>&answer=<key>
 *
 * Records a 1-click answer from a check-in email button. Auth-free —
 * the HMAC token IS the auth (signed for that specific (plan, day)).
 *
 * Steps:
 *   1. Verify token. 400 on bad sig / malformed.
 *   2. Match the URL day param against the token's day (defence against
 *      tampering after copy-paste).
 *   3. Look up the plan + userId; 404 if deleted or gone.
 *   4. Validate answer key against the allowed set for that day.
 *   5. Upsert PlanCheckinResponse (planId+day unique).
 *   6. Redirect to /checkin-noted?ok=1 (or ?err=... on failure).
 *
 * GET semantics so the link works from every mail client.
 */
import { prisma } from "@/lib/db";
import { verifyReplyToken } from "@/lib/checkins/reply-token";
import { isValidAnswer } from "@/lib/checkins/answers";
import { CHECKIN_DAYS, type CheckinDay } from "@/lib/checkins/schedule";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(request: Request, params: Record<string, string>): Response {
  const url = new URL("/checkin-noted", request.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const dayStr = url.searchParams.get("day");
  const answer = url.searchParams.get("answer");

  if (!token || !dayStr || !answer) {
    return redirectTo(request, { err: "missing_params" });
  }

  const verified = verifyReplyToken(token);
  if (!verified) {
    return redirectTo(request, { err: "invalid_token" });
  }

  const day = parseInt(dayStr, 10);
  if (!Number.isFinite(day) || day !== verified.day) {
    return redirectTo(request, { err: "day_mismatch" });
  }
  if (!(CHECKIN_DAYS as readonly number[]).includes(day)) {
    return redirectTo(request, { err: "unknown_day" });
  }
  const dayTyped = day as CheckinDay;

  if (!isValidAnswer(dayTyped, answer)) {
    return redirectTo(request, { err: "unknown_answer" });
  }

  const plan = await prisma.plan.findFirst({
    where: { id: verified.planId, deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!plan) {
    return redirectTo(request, { err: "plan_not_found" });
  }

  await prisma.planCheckinResponse.upsert({
    where: { planId_day: { planId: plan.id, day: dayTyped } },
    create: { userId: plan.userId, planId: plan.id, day: dayTyped, answer },
    update: { answer },
  });

  return redirectTo(request, { ok: "1", day: String(dayTyped) });
}
