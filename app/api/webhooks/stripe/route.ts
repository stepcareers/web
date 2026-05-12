/**
 * Stripe webhook receiver.
 *
 * Verifies the signature against STRIPE_WEBHOOK_SECRET, then flips
 * `premiumUntil` on the corresponding User row based on the event type.
 *
 * Events we listen to (configured in scripts/setup-stripe.ts):
 *   - checkout.session.completed
 *       Fires once per successful Checkout. We use this for both flows:
 *         * One-time (lifetime): payment_status === "paid" → set
 *           premiumUntil to year 9999.
 *         * Subscription (monthly): subscription is created; we read
 *           the subscription's current_period_end and set premiumUntil.
 *   - customer.subscription.updated
 *       Renewals, plan changes, cancellation-at-period-end toggles. We
 *       re-sync premiumUntil to current_period_end on every update.
 *   - customer.subscription.deleted
 *       Subscription ended (cancel-now or final invoice failed). We
 *       keep the existing premiumUntil — the user already paid for that
 *       period, so don't yank access mid-window. If they want it back
 *       later, a new checkout creates a new sub.
 *   - invoice.payment_failed
 *       Dunning. We log but don't change state — Stripe retries on its
 *       own. If they exhaust retries, the subscription.deleted event
 *       fires and we keep the existing premiumUntil as the natural
 *       grace.
 *
 * The handler is intentionally idempotent: repeating the same event
 * results in the same DB state. Stripe will retry on non-2xx, so we
 * return 2xx even when we recognise but choose to skip an event.
 */
import { prisma } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Year 9999 — used as a sentinel "never expires" timestamp for lifetime
// purchases. Comfortably past anyone's lifetime, but still a real Date
// (so all our `premiumUntil > NOW()` checks work without special casing).
const LIFETIME_NEVER = new Date("9999-12-31T23:59:59.999Z");

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  if (!WEBHOOK_SECRET) {
    return new Response("STRIPE_WEBHOOK_SECRET not configured", { status: 500 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  // We need the RAW body — JSON.parse and re-stringify would re-order
  // keys and break the signature check.
  const rawBody = await request.text();

  const stripe = requireStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return new Response(`Signature verification failed: ${msg}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      }
      case "invoice.payment_failed": {
        // No DB change — Stripe handles dunning. Logged for observability.
        console.warn(
          "[stripe webhook] invoice.payment_failed",
          (event.data.object as Stripe.Invoice).id,
        );
        break;
      }
      default: {
        // Unhandled but acknowledged so Stripe doesn't retry.
        console.log(`[stripe webhook] ignored event type: ${event.type}`);
      }
    }
  } catch (err) {
    // Something blew up while applying the event — return 500 so Stripe
    // retries, but log the detail so we can debug.
    console.error("[stripe webhook] handler failed:", err);
    const msg = err instanceof Error ? err.message : "unknown";
    return new Response(`Handler error: ${msg}`, { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

async function findUserIdFromSession(
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  // Prefer the explicit userId we stamped in metadata when creating the
  // session. Falls back to looking up the Stripe customer in our DB.
  const fromMetadata = session.metadata?.stepUserId;
  if (fromMetadata) return fromMetadata;

  if (typeof session.customer === "string") {
    const u = await prisma.user.findUnique({
      where: { stripeCustomerId: session.customer },
      select: { id: true },
    });
    return u?.id ?? null;
  }
  return null;
}

async function findUserIdFromSubscription(
  sub: Stripe.Subscription,
): Promise<string | null> {
  const fromMetadata = sub.metadata?.stepUserId;
  if (fromMetadata) return fromMetadata;

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;
  const u = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return u?.id ?? null;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Stripe sends two-phase notifications for some flows; we only act on
  // sessions where payment actually went through (or where the subscription
  // is now active).
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return;
  }

  const userId = await findUserIdFromSession(session);
  if (!userId) {
    console.warn(
      `[stripe webhook] no user resolvable from session ${session.id}; skipping`,
    );
    return;
  }

  const plan = session.metadata?.plan;

  if (session.mode === "payment" || plan === "lifetime") {
    // One-time lifetime purchase — flip premium to forever-ish.
    await prisma.user.update({
      where: { id: userId },
      data: { premiumUntil: LIFETIME_NEVER },
    });
    return;
  }

  if (session.mode === "subscription") {
    // For subscriptions the source of truth is the subscription itself;
    // pull `current_period_end` from there. The subscription was just
    // created so we can fetch it by ID.
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    if (!subId) {
      console.warn(
        `[stripe webhook] subscription mode session ${session.id} has no subscription id`,
      );
      return;
    }
    const stripe = requireStripe();
    const sub = await stripe.subscriptions.retrieve(subId);
    await applySubscriptionToUser(userId, sub);
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const userId = await findUserIdFromSubscription(sub);
  if (!userId) {
    console.warn(
      `[stripe webhook] no user resolvable from subscription ${sub.id}; skipping`,
    );
    return;
  }
  await applySubscriptionToUser(userId, sub);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  // Don't yank the user's access — they paid for the current window.
  // We rely on `premiumUntil` already pointing at the end of that
  // window, so simply doing nothing keeps the natural expiry behaviour.
  const userId = await findUserIdFromSubscription(sub);
  console.log(
    `[stripe webhook] subscription deleted for user ${userId ?? "?"}; access expires at premiumUntil (no change)`,
  );
}

async function applySubscriptionToUser(
  userId: string,
  sub: Stripe.Subscription,
) {
  // `current_period_end` lives on the subscription item in modern Stripe
  // API versions; older versions had it on the subscription root. We
  // check both so we survive minor version bumps without breaking.
  const root = (sub as unknown as { current_period_end?: number })
    .current_period_end;
  const fromItem = sub.items.data[0]?.current_period_end;
  const periodEndSec = root ?? fromItem;
  if (!periodEndSec) {
    console.warn(
      `[stripe webhook] no current_period_end on subscription ${sub.id}; skipping update`,
    );
    return;
  }

  // Active subs (including past_due, where Stripe is still retrying)
  // keep access until period end. Cancelled / unpaid don't get a
  // forward write — they just inherit whatever premiumUntil was set
  // by the most recent successful renewal.
  const activeStatuses = new Set<Stripe.Subscription.Status>([
    "active",
    "trialing",
    "past_due",
  ]);
  if (!activeStatuses.has(sub.status)) return;

  await prisma.user.update({
    where: { id: userId },
    data: { premiumUntil: new Date(periodEndSec * 1000) },
  });
}
