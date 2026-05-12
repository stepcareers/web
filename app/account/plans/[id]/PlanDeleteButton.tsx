"use client";

/**
 * Two-step delete button for the saved-plan viewer.
 *
 *   1. First click arms a red destructive state ("Click again to delete")
 *   2. Second click POSTs DELETE /api/me/plans/[id], then routes back
 *      to /account so the user lands on a freshly-rebuilt list.
 *
 * Inline cancel + error states match the GDPR delete pattern over on
 * AccountActions so the affordance feels familiar.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PlanDeleteButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/me/plans/${planId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `Request failed (${res.status})`);
      }
      // Server-rendered list lives one route up; refresh forces it to
      // refetch on the next paint.
      router.push("/account");
      router.refresh();
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={
          armed
            ? "inline-flex w-fit items-center gap-2 rounded-md border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
            : "inline-flex w-fit items-center gap-2 rounded-md border border-ink-200/15 px-4 py-2 text-sm text-ink-200/65 transition hover:border-red-500/40 hover:text-red-300/90"
        }
      >
        {busy
          ? "Deleting…"
          : armed
            ? "Click again to delete →"
            : "Delete this plan"}
      </button>
      {armed && !busy ? (
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="self-start text-xs text-ink-200/55 underline decoration-ink-200/20 underline-offset-4 transition hover:text-ink-200/85"
        >
          Cancel
        </button>
      ) : null}
      {error ? <p className="text-xs text-red-300/85">{error}</p> : null}
    </div>
  );
}
