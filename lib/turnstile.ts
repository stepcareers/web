/**
 * Cloudflare Turnstile — server-side token verification.
 *
 * Turnstile gives the client a one-time token after a (usually
 * invisible) bot challenge. The server MUST verify this token via
 * Cloudflare's siteverify API before trusting the request. Tokens
 * expire after ~5 minutes and are single-use.
 *
 * Failure modes we treat as PASS:
 *   - TURNSTILE_SECRET_KEY not set (e.g. local dev without keys
 *     configured). We log a warning but accept the request — better
 *     than blocking real users on a misconfig.
 *
 * Failure modes we treat as FAIL:
 *   - Missing token from client.
 *   - Token rejected by Cloudflare (expired, replayed, low score).
 *   - Network error talking to Cloudflare (fail-closed: an attacker
 *     could intentionally break the connection to bypass).
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileVerifyResult {
  ok: boolean;
  reason?: string;
  errors?: string[];
}

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Dev/preview without key: skip verification to avoid blocking the
  // developer. Logged loudly so it's hard to ship to prod by accident.
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[turnstile] TURNSTILE_SECRET_KEY not set in production — skipping verification",
      );
    } else {
      console.warn(
        "[turnstile] TURNSTILE_SECRET_KEY not set — skipping verification (dev only)",
      );
    }
    return { ok: true, reason: "no_secret_configured" };
  }

  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  let res: Response;
  try {
    res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      // Don't let a slow Cloudflare hang our request handler.
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.error("[turnstile] siteverify network error:", err);
    return { ok: false, reason: "network_error" };
  }

  if (!res.ok) {
    return { ok: false, reason: `siteverify_${res.status}` };
  }

  const data = (await res.json()) as {
    success: boolean;
    "error-codes"?: string[];
  };
  if (!data.success) {
    return {
      ok: false,
      reason: "rejected",
      errors: data["error-codes"],
    };
  }

  return { ok: true };
}

/**
 * Pull the client IP from a Next.js Request. Falls back to undefined
 * when no proxy header is present (local dev).
 */
export function getClientIp(req: Request): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim();
  return req.headers.get("x-real-ip") ?? undefined;
}
