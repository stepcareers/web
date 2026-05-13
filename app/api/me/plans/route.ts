/**
 * Server-saved plans — collection endpoint.
 *
 *   GET  /api/me/plans  → list the signed-in user's plans (latest first,
 *                         soft-deleted excluded).
 *   POST /api/me/plans  → save a plan generated in /beta.
 *
 * The browser fires POST in a fire-and-forget call right after a plan
 * finishes streaming. We validate the body against the same Zod schema
 * the recommender produces, so junk can't sneak into Postgres.
 *
 * The list response intentionally omits `recommendations` — the full JSON
 * can be heavy and is only needed by the detail view at /account/plans/[id].
 *
 * Auth: NextAuth session required for both verbs.
 */
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { RecommendInputSchema, RecommendResultSchema } from "@/lib/ai/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SavePlanSchema = z.object({
  recommendations: RecommendResultSchema,
  // Short user-facing label so the list view doesn't crack the JSON open.
  // Defaults to the foundation rec's title when not supplied.
  title: z.string().min(3).max(200).optional(),
  // Loose pointer back to the onboarding Session that produced this plan.
  sourceSessionId: z.string().uuid().optional(),
  // Full RecommendInput blob — the structured form that drove this plan.
  // Optional for backwards-compat with old clients that don't send it.
  // Validated against the same schema the recommender ingests so we never
  // store malformed garbage.
  inputSnapshot: RecommendInputSchema.optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const plans = await prisma.plan.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      sourceSessionId: true,
    },
  });

  return NextResponse.json({ plans }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = SavePlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { recommendations, sourceSessionId, inputSnapshot } = parsed.data;
  // Derive a title from the foundation rec when the client didn't pass one.
  // Falls back to the first rec, then to a generic stamp so we always have
  // *something* readable in the list.
  const foundationRec =
    recommendations.recommendations.find((r) => r.leverage === "foundation") ??
    recommendations.recommendations[0];
  const title =
    parsed.data.title?.trim() ||
    foundationRec?.title ||
    `Plan from ${new Date().toLocaleDateString()}`;

  const created = await prisma.plan.create({
    data: {
      userId: session.user.id,
      title,
      // Cast through unknown: Prisma's Json input type rejects nested
      // optional shapes, but the Zod parser already proved this is safe.
      recommendations: recommendations as unknown as object,
      inputSnapshot: inputSnapshot
        ? (inputSnapshot as unknown as object)
        : undefined,
      sourceSessionId: sourceSessionId ?? null,
    },
    select: { id: true, title: true, createdAt: true },
  });

  return NextResponse.json({ plan: created }, { status: 201 });
}
