/**
 * Thin Resend wrapper.
 *
 * We hit the Resend REST API directly (no SDK) so we don't pull in
 * another runtime dependency for what is effectively `fetch + bearer`.
 *
 * No-ops in dev when RESEND_API_KEY isn't set — returns ok=false with a
 * `dev_noop` reason so callers can log it without crashing.
 */
const API_BASE = "https://api.resend.com";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Override the From header. Defaults to RESEND_FROM_EMAIL. */
  from?: string;
  /**
   * Standard headers for one-click unsubscribe. Set them and Gmail will
   * surface the native "Unsubscribe" button next to the sender.
   */
  listUnsubscribeUrl?: string;
  /** Add a `Reply-To` so user replies land somewhere we read. */
  replyTo?: string;
  /** Adds an idempotency-style tag in Resend's dashboard. */
  tag?: string;
};

export type EmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: string; detail?: string };

export async function sendEmail(args: SendArgs): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { ok: false, reason: "dev_noop" };
  }
  const from = args.from ?? process.env.RESEND_FROM_EMAIL ?? "hi@step.careers";

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  const body: Record<string, unknown> = {
    from,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
    headers: {
      // RFC 8058 — one-click unsubscribe. Gmail honours the URL form
      // when paired with `List-Unsubscribe-Post`.
      ...(args.listUnsubscribeUrl
        ? {
            "List-Unsubscribe": `<${args.listUnsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : {}),
    },
  };
  if (args.replyTo) body["reply_to"] = args.replyTo;
  if (args.tag) body["tags"] = [{ name: "category", value: args.tag }];

  const res = await fetch(`${API_BASE}/emails`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, reason: `resend_${res.status}`, detail: text.slice(0, 500) };
  }
  try {
    const json = JSON.parse(text) as { id?: string };
    return { ok: true, id: json.id ?? "unknown" };
  } catch {
    return { ok: false, reason: "resend_parse_error", detail: text.slice(0, 500) };
  }
}
