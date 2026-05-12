/**
 * Server-saved plans — single-plan endpoint.
 *
 *   GET    /api/me/plans/[id]  → fetch a plan in full (for /account/plans/[id])
 *   DELETE /api/me/plans/[id]  → soft-delete (sets deletedAt; row stays so
 *                                 GDPR exports keep the full history)
 *
 * Both verbs enforce that the plan belongs to the signed-in user — the
 * `where` clause includes `userId` so we never leak someone else's plan
 * even if an id is guessed.
 *
 * Auth: NextAuth session required.
 */
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const plan = await prisma.plan.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    select: {
      id: true,
      title: true,
      recommendations: true,
      sourceSessionId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!plan) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ plan }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  // updateMany so we don't 500 when the plan doesn't exist or doesn't
  // belong to this user — we just return a 404 in that case.
  const result = await prisma.plan.updateMany({
    where: { id, userId: session.user.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
