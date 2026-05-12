/**
 * Stripe SDK singleton.
 *
 * One instance per Node process — Stripe's client is thread-safe and
 * holds an HTTP keep-alive pool, so re-creating it on every request
 * would just waste connections.
 *
 * No-ops at import time if STRIPE_SECRET_KEY isn't set: routes that try
 * to use `stripe` will throw clearly. Avoids crashing the whole server
 * boot when running locally without Stripe configured.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

export const stripe = key
  ? new Stripe(key, {
      // Pin an API version so a Stripe-side default bump can't change our
      // shapes silently. Update intentionally when we audit a new version.
      apiVersion: "2026-04-22.dahlia",
      typescript: true,
    })
  : (null as unknown as Stripe);

export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. Set it on Vercel (and in .env for local dev).",
    );
  }
  return stripe;
}

/** Env-driven Price IDs for the two plans we sell. */
export const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_ID_MONTHLY,
  lifetime: process.env.STRIPE_PRICE_ID_LIFETIME,
} as const;

export type PremiumPlan = keyof typeof PRICE_IDS;
