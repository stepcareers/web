/**
 * GDPR right-to-erasure — POST /api/me/delete
 *
 * Hard-deletes the signed-in user and every record tied to them.
 *
 * Cascade order (inside a single transaction so partial failures roll back):
 *   1. Delete onboarding Sessions belonging to user
 *      → cascades to Input and Result via Prisma FK onDelete: Cascade
 *   2. Delete EmailSubscription rows
 *   3. Delete VerificationToken rows matching user.email (defensive — short-lived,
 *      but a stray token shouldn't be able to revive the email after deletion)
 *   4. Delete the User row
 *      → cascades to Account via Prisma FK onDelete: Cascade
 *
 * The client is responsible for clearing the auth cookie afterwards (call
 * NextAuth signOut() once this returns 200).
 *
 * Body: { confirm: "DELETE" } — guard against accidental fetches.
 * Auth: NextAuth session cookie required.
 */
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  confirm: z.literal("DELETE"),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const email = session.user.email;

  // Confirm-string guard. Catches typos, prefetches, and "are you sure" bugs
  // before they nuke an account.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "confirmation_required", expected: { confirm: "DELETE" } },
      { status: 400 },
    );
  }

  // Everything-or-nothing. If any step fails, the user record stays intact
  // so the user can retry rather than ending up half-deleted.
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.session.deleteMany({ where: { userId } });
    await tx.plan.deleteMany({ where: { userId } });
    await tx.emailSubscription.deleteMany({ where: { userId } });
    await tx.verificationToken.deleteMany({ where: { identifier: email } });
    await tx.user.delete({ where: { id: userId } });
  });

  return NextResponse.json({ ok: true, deletedAt: new Date().toISOString() });
}
