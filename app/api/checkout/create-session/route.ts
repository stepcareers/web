/**
 * Stripe Checkout — create a session.
 *
 * POST /api/checkout/create-session  { plan: "monthly" | "lifetime" }
 *
 * Returns { url } — the browser navigates to it. We pass back a URL
 * rather than redirect from the server because the client-side button
 * needs to handle the click + network state itself.
 *
 * Flow:
 *   1. Read NextAuth session — must be signed in (Premium is tied to
 *      a Step account; otherwise we have nothing to unlock after pay).
 *   2. Resolve/create a Stripe Customer for this user, store the ID
 *      on the User row so future payments stay grouped.
 *   3. Create a Checkout Session in subscription or payment mode
 *      depending on plan.
 *   4. Pass userId + plan in `metadata` so the webhook can find the
 *      user without a DB lookup.
 *
 * Cancel/success URLs round-trip back to /account, where the user lands
 * either with their freshly-active Premium status or a "checkout
 * cancelled, no charge made" note. We also append session_id for the
 * webhook latency edge case (more notes inline in /account).
 */
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireStripe, PRICE_IDS, type PremiumPlan } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  plan: z.enum(["monthly", "lifetime"]),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const plan: PremiumPlan = parsed.data.plan;

  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    // Missing env var — fail loud so we don't silently send users to
    // a broken checkout.
    return NextResponse.json(
      { error: "price_not_configured", plan },
      { status: 500 },
    );
  }

  const stripe = requireStripe();
  const userId = session.user.id;
  const email = session.user.email;

  // Resolve or create Stripe Customer. The unique index on
  // users.stripe_customer_id keeps us idempotent under retries.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  let customerId = user?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { stepUserId: userId },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });
  }

  // Origin for return URLs — Vercel sets VERCEL_URL on previews; fall
  // back to the request's own origin so local dev (which has neither
  // env var set) still works.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    request.headers.get("origin") ??
    `https://${process.env.VERCEL_URL ?? "step.careers"}`;

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: plan === "monthly" ? "subscription" : "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/account?checkout=cancelled`,
    // Pass the userId so the webhook can resolve the user without
    // round-tripping through Stripe's customer endpoint.
    metadata: { stepUserId: userId, plan },
    // Same metadata gets copied onto the subscription/payment intent so
    // webhook handlers that fire on those objects can still resolve.
    subscription_data:
      plan === "monthly"
        ? { metadata: { stepUserId: userId, plan } }
        : undefined,
    payment_intent_data:
      plan === "lifetime"
        ? { metadata: { stepUserId: userId, plan } }
        : undefined,
    allow_promotion_codes: true,
  });

  if (!checkoutSession.url) {
    return NextResponse.json(
      { error: "stripe_missing_url" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: checkoutSession.url });
}
