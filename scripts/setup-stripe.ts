/**
 * One-shot Stripe setup — run once after creating your Stripe account.
 *
 * Creates two products (Monthly + Lifetime) with prices, plus a webhook
 * endpoint pointing at our /api/webhooks/stripe route, then prints
 * the IDs you need to paste into Vercel's env vars.
 *
 *   STRIPE_SECRET_KEY=sk_test_...  pnpm tsx scripts/setup-stripe.ts
 *
 * Idempotent-ish: it looks up existing products by name and reuses them
 * instead of duplicating on re-runs. Re-running after a price change
 * won't lower-price the existing price — Stripe prices are immutable.
 * If you want a different price, delete the old one in the dashboard
 * first or rename the product so this script creates a fresh one.
 */
const SECRET = process.env.STRIPE_SECRET_KEY;
if (!SECRET) {
  console.error("Set STRIPE_SECRET_KEY env var first.");
  process.exit(1);
}

const API = "https://api.stripe.com/v1";
const HEADERS: Record<string, string> = {
  Authorization: `Bearer ${SECRET}`,
  "Content-Type": "application/x-www-form-urlencoded",
};

const PRODUCTION_URL = "https://step.careers";

const PRODUCTS = {
  monthly: {
    name: "Step Premium — Monthly",
    description:
      "Decision tree, 5-year scenarios, and progress check-ins (1/7/30/90 days). Monthly subscription.",
    price: {
      unit_amount: 1900, // €19.00 in cents
      currency: "eur",
      recurring: { interval: "month" as const },
    },
  },
  lifetime: {
    name: "Step Premium — Lifetime",
    description:
      "Decision tree, 5-year scenarios, and progress check-ins (1/7/30/90 days). Pay once, keep forever.",
    price: {
      unit_amount: 9900, // €99.00 in cents
      currency: "eur",
      // No `recurring` field = one-time charge.
    },
  },
};

const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
];

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

async function apiCall<T>(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, string | string[] | number>,
): Promise<ApiResult<T>> {
  const url = method === "GET" && body ? `${API}${path}?${formEncode(body)}` : `${API}${path}`;
  const init: RequestInit = { method, headers: HEADERS };
  if (method === "POST" && body) {
    init.body = formEncode(body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: text };
  }
  return { ok: true, data: JSON.parse(text) as T };
}

function formEncode(obj: Record<string, string | string[] | number>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        parts.push(`${encodeURIComponent(k + "[]")}=${encodeURIComponent(item)}`);
      }
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join("&");
}

type Product = { id: string; name: string };
type Price = { id: string; product: string; unit_amount: number; recurring: { interval: string } | null };
type WebhookEndpoint = { id: string; url: string; secret: string; enabled_events: string[] };

async function findOrCreateProduct(name: string, description: string): Promise<string> {
  const search = await apiCall<{ data: Product[] }>(
    `/products/search`,
    "GET",
    { query: `name:'${name}' AND active:'true'` },
  );
  if (search.ok && search.data.data.length > 0) {
    console.log(`✓ Found existing product "${name}" → ${search.data.data[0]!.id}`);
    return search.data.data[0]!.id;
  }
  const created = await apiCall<Product>("/products", "POST", { name, description });
  if (!created.ok) {
    throw new Error(`Failed to create product ${name}: ${created.error}`);
  }
  console.log(`+ Created product "${name}" → ${created.data.id}`);
  return created.data.id;
}

async function findOrCreatePrice(
  productId: string,
  unitAmount: number,
  recurring?: { interval: string },
): Promise<string> {
  const list = await apiCall<{ data: Price[] }>(
    `/prices`,
    "GET",
    { product: productId, active: "true", limit: 100 },
  );
  if (list.ok) {
    const match = list.data.data.find(
      (p) =>
        p.unit_amount === unitAmount &&
        ((recurring && p.recurring?.interval === recurring.interval) ||
          (!recurring && !p.recurring)),
    );
    if (match) {
      console.log(`✓ Found existing price ${unitAmount / 100} ${recurring ? recurring.interval : "one-time"} → ${match.id}`);
      return match.id;
    }
  }
  const body: Record<string, string | number> = {
    product: productId,
    unit_amount: unitAmount,
    currency: "eur",
  };
  if (recurring) {
    body["recurring[interval]"] = recurring.interval;
  }
  const created = await apiCall<Price>("/prices", "POST", body);
  if (!created.ok) {
    throw new Error(`Failed to create price: ${created.error}`);
  }
  console.log(`+ Created price ${unitAmount / 100} ${recurring ? recurring.interval : "one-time"} → ${created.data.id}`);
  return created.data.id;
}

async function findOrCreateWebhook(): Promise<{ id: string; secret: string }> {
  const list = await apiCall<{ data: WebhookEndpoint[] }>(
    `/webhook_endpoints`,
    "GET",
    { limit: 100 },
  );
  if (list.ok) {
    const target = `${PRODUCTION_URL}/api/webhooks/stripe`;
    const match = list.data.data.find((w) => w.url === target);
    if (match) {
      console.log(`✓ Found existing webhook → ${match.id}`);
      console.log(
        `  NOTE: Stripe only shows the signing secret on creation. If you don't have it saved, delete the webhook in the dashboard and re-run this script.`,
      );
      // Stripe API doesn't return the secret on GET — only on initial creation.
      // If we found an existing webhook the user needs to handle the secret manually.
      return { id: match.id, secret: "<existing — recreate webhook to see secret>" };
    }
  }
  const created = await apiCall<WebhookEndpoint>("/webhook_endpoints", "POST", {
    url: `${PRODUCTION_URL}/api/webhooks/stripe`,
    enabled_events: WEBHOOK_EVENTS,
    description: "Step — Premium subscription + lifetime events",
  });
  if (!created.ok) {
    throw new Error(`Failed to create webhook: ${created.error}`);
  }
  console.log(`+ Created webhook → ${created.data.id}`);
  return { id: created.data.id, secret: created.data.secret };
}

async function main() {
  console.log("Setting up Stripe products, prices, and webhook…\n");

  const monthlyProductId = await findOrCreateProduct(
    PRODUCTS.monthly.name,
    PRODUCTS.monthly.description,
  );
  const lifetimeProductId = await findOrCreateProduct(
    PRODUCTS.lifetime.name,
    PRODUCTS.lifetime.description,
  );

  const monthlyPriceId = await findOrCreatePrice(
    monthlyProductId,
    PRODUCTS.monthly.price.unit_amount,
    PRODUCTS.monthly.price.recurring,
  );
  const lifetimePriceId = await findOrCreatePrice(
    lifetimeProductId,
    PRODUCTS.lifetime.price.unit_amount,
  );

  const webhook = await findOrCreateWebhook();

  console.log("\n────────────────────────────────────────────────────────");
  console.log("PASTE THESE INTO VERCEL (Production + Preview + Development):");
  console.log("────────────────────────────────────────────────────────");
  console.log(`STRIPE_SECRET_KEY        = ${SECRET}`);
  console.log(`STRIPE_PRICE_ID_MONTHLY  = ${monthlyPriceId}`);
  console.log(`STRIPE_PRICE_ID_LIFETIME = ${lifetimePriceId}`);
  console.log(`STRIPE_WEBHOOK_SECRET    = ${webhook.secret}`);
  console.log("────────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("setup-stripe failed:", err);
  process.exit(1);
});
