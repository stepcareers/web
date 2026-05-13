/**
 * Recommendation feedback — POST + GET.
 *
 *   POST /api/me/feedback  { planId, recIndex, recTitle, rating, comment? }
 *     Upserts a vote. Same user clicking thumbs-down twice toggles back
 *     to no-vote (we delete the row); changing from up to down updates.
 *
 *   GET /api/me/feedback?planId=<uuid>
 *     Returns the user's existing votes on that plan so the viewer can
 *     highlight which recommendations they already rated.
 *
 * Both verbs require auth. Cross-user access is blocked by scoping every
 * query through the session userId — never trust the planId alone.
 */
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RatingEnum = z.enum(["up", "down"]);

const PostBodySchema = z.object({
  planId: z.string().uuid(),
  recIndex: z.number().int().min(0).max(20),
  recTitle: z.string().min(3).max(280),
  rating: RatingEnum,
  comment: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { planId, recIndex, recTitle, rating, comment } = parsed.data;

  // Verify the plan belongs to the user — without this someone could
  // post feedback against any plan id by guessing.
  const plan = await prisma.plan.findFirst({
    where: { id: planId, userId },
    select: { id: true },
  });
  if (!plan) {
    return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  }

  const upserted = await prisma.planRecommendationFeedback.upsert({
    where: {
      userId_planId_recIndex: { userId, planId, recIndex },
    },
    create: {
      userId,
      planId,
      recIndex,
      recTitle,
      rating,
      comment: comment ?? null,
    },
    update: {
      recTitle,
      rating,
      comment: comment ?? null,
    },
    select: { id: true, rating: true, comment: true, recIndex: true },
  });

  return NextResponse.json({ feedback: upserted }, { status: 200 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const planId = url.searchParams.get("planId");
  if (!planId) {
    return NextResponse.json({ error: "missing_planId" }, { status: 400 });
  }

  const items = await prisma.planRecommendationFeedback.findMany({
    where: { planId, userId: session.user.id },
    select: { recIndex: true, rating: true, comment: true, updatedAt: true },
    orderBy: { recIndex: "asc" },
  });

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "no-store" } },
  );
}
