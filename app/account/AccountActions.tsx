"use client";

/**
 * Client-side handlers for the GDPR controls on /account.
 *
 *   - Export:  GET /api/me/export — browser downloads JSON directly via
 *              the route's Content-Disposition: attachment header. No
 *              need to fetch + blob; just navigate.
 *   - Delete:  POST /api/me/delete with body { confirm: "DELETE" }.
 *              Two-step confirm: first click arms a red destructive
 *              state, second click executes. The button only fires the
 *              destructive action once the user has visibly acknowledged
 *              the warning. On success we hard-redirect to "/" because
 *              the session cookie is now pointing at a deleted user.
 */
import { signOut } from "next-auth/react";
import { useState } from "react";

export function AccountActions() {
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/me/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `Request failed (${res.status})`);
      }
      // Clear the JWT cookie + redirect.
      await signOut({ callbackUrl: "/", redirect: true });
    } catch (e) {
      setDeleting(false);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      <a
        href="/api/me/export"
        className="inline-flex w-fit items-center gap-2 rounded-md border border-ink-200/25 px-4 py-2 text-sm text-ink-200/90 transition hover:border-ink-200/50 hover:bg-ink-200/[0.04]"
      >
        <span aria-hidden>↓</span> Download my data (JSON)
      </a>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className={
            armed
              ? "inline-flex w-fit items-center gap-2 rounded-md border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
              : "inline-flex w-fit items-center gap-2 rounded-md border border-ink-200/15 px-4 py-2 text-sm text-ink-200/65 transition hover:border-red-500/40 hover:text-red-300/90"
          }
        >
          {deleting
            ? "Deleting…"
            : armed
              ? "Click again to permanently delete →"
              : "Delete my account"}
        </button>
        {armed && !deleting ? (
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="self-start text-xs text-ink-200/55 underline decoration-ink-200/20 underline-offset-4 transition hover:text-ink-200/85"
          >
            Cancel
          </button>
        ) : null}
        {error ? (
          <p className="text-xs text-red-300/85">{error}</p>
        ) : null}
        {armed && !deleting ? (
          <p className="text-xs leading-relaxed text-ink-200/55">
            This permanently removes your profile, sessions, generated plans,
            and email subscriptions. It cannot be undone.
          </p>
        ) : null}
      </div>
    </div>
  );
}
