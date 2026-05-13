"use client";

/**
 * Inline 👍/👎 widget for a single recommendation on a saved plan.
 *
 * Server-renders with the existing rating (if any) and lets the user
 * change their mind. Optimistic UI: we flip the visual state on click
 * and reconcile on the response. A POST that fails leaves the previous
 * rating visible plus a small inline error.
 */
import { useState } from "react";

type Rating = "up" | "down" | null;

export function RecommendationFeedback({
  planId,
  recIndex,
  recTitle,
  initialRating,
}: {
  planId: string;
  recIndex: number;
  recTitle: string;
  initialRating: Rating;
}) {
  const [rating, setRating] = useState<Rating>(initialRating);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vote(next: Rating) {
    if (busy) return;
    // Click the same button you already voted → no-op for now. (Could
    // implement "unvote" by DELETE; for v1 we keep it minimal.)
    if (next === rating) return;

    const prev = rating;
    setRating(next);
    setError(null);
    setBusy(true);
    try {
      if (next === null) {
        // No "unvote" endpoint yet — bail out cleanly. Server stays
        // consistent because we just bounce back to prev.
        setRating(prev);
        setBusy(false);
        return;
      }
      const res = await fetch("/api/me/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, recIndex, recTitle, rating: next }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `Request failed (${res.status})`);
      }
    } catch (e) {
      setRating(prev);
      setError(e instanceof Error ? e.message : "Couldn't save your rating.");
    } finally {
      setBusy(false);
    }
  }

  const upActive = rating === "up";
  const downActive = rating === "down";

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink-200/10 pt-4">
      <span className="text-[11px] uppercase tracking-[0.16em] text-ink-200/45">
        Was this helpful?
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => vote("up")}
          disabled={busy}
          aria-pressed={upActive}
          aria-label="Helpful"
          className={
            upActive
              ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/45 bg-emerald-400/[0.12] text-base text-emerald-200 transition disabled:cursor-wait"
              : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200/15 text-base text-ink-200/60 transition hover:border-emerald-400/35 hover:bg-emerald-400/[0.06] hover:text-emerald-200 disabled:cursor-wait disabled:opacity-60"
          }
        >
          <span aria-hidden>👍</span>
        </button>
        <button
          type="button"
          onClick={() => vote("down")}
          disabled={busy}
          aria-pressed={downActive}
          aria-label="Not helpful"
          className={
            downActive
              ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-400/45 bg-red-400/[0.12] text-base text-red-300 transition disabled:cursor-wait"
              : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200/15 text-base text-ink-200/60 transition hover:border-red-400/35 hover:bg-red-400/[0.06] hover:text-red-300 disabled:cursor-wait disabled:opacity-60"
          }
        >
          <span aria-hidden>👎</span>
        </button>
      </div>
      {rating ? (
        <span className="text-xs text-ink-200/55">
          Thanks — we use this to tune future plans.
        </span>
      ) : null}
      {error ? (
        <span className="text-xs text-red-300/85">{error}</span>
      ) : null}
    </div>
  );
}
