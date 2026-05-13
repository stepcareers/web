/**
 * Signed reply tokens for 1-click check-in answer links.
 *
 * Each check-in email embeds 3-4 buttons, each one a URL with
 *   ?token=<signed>&day=<N>&answer=<key>
 *
 * The token verifies that the link was minted by us for that exact
 * (plan, day) pair. The endpoint resolves `userId` via the plan FK so
 * we never trust user-supplied identity.
 *
 * Format: `<base64url(planId.day)>.<base64url(hmac_sha256(planId.day, secret))>`
 *
 * Reuses AUTH_SECRET — same fate-sharing as unsubscribe tokens
 * (rotating would break sessions, so handle with care).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.AUTH_SECRET ?? "";

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signReplyToken(planId: string, day: number): string {
  if (!SECRET) {
    throw new Error("AUTH_SECRET is not set; cannot sign reply tokens.");
  }
  const payload = `${planId}.${day}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest();
  return `${b64url(payload)}.${b64url(sig)}`;
}

export function verifyReplyToken(
  token: string,
): { planId: string; day: number } | null {
  if (!SECRET) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSig] = parts as [string, string];

  let payload: string;
  let providedSig: Buffer;
  try {
    payload = fromB64url(encodedPayload).toString("utf-8");
    providedSig = fromB64url(encodedSig);
  } catch {
    return null;
  }

  const expectedSig = createHmac("sha256", SECRET).update(payload).digest();
  if (
    providedSig.length !== expectedSig.length ||
    !timingSafeEqual(providedSig, expectedSig)
  ) {
    return null;
  }

  const [planId, dayStr] = payload.split(".");
  if (!planId || !dayStr) return null;
  if (!/^[0-9a-f-]{36}$/.test(planId)) return null;
  const day = parseInt(dayStr, 10);
  if (!Number.isFinite(day) || day <= 0) return null;
  return { planId, day };
}
