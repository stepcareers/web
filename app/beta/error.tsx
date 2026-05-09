"use client";

/**
 * Route-level error boundary for /beta.
 *
 * Next.js mounts this when any client component in the route throws
 * during render. Without this, users see the generic "Application
 * error: a client-side exception has occurred" screen with no info.
 *
 * The error message and digest are exposed so the user can paste them
 * back to us — far more actionable than a white screen.
 */
import Link from "next/link";
import { useEffect } from "react";

export default function BetaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the full stack to the dev console so users can copy it
    // when they file a report.
    console.error("[/beta] route error boundary caught:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10 md:py-14">
      <header className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium tracking-wide text-ink-200/80 transition hover:opacity-70 dark:text-ink-200/60"
        >
          step.careers
        </Link>
        <span className="rounded-full border border-ink-200/30 px-2.5 py-0.5 text-xs uppercase tracking-wider text-ink-200/60">
          beta
        </span>
      </header>

      <section className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            Something broke.
          </h1>
          <p className="mt-3 text-base text-ink-200/90 dark:text-ink-200/70">
            The page hit an error. We&apos;d love to know what happened — copy
            the message below and send it our way, then try again.
          </p>
        </div>

        <div className="rounded-md border border-red-500/40 bg-red-500/[0.06] px-4 py-3 text-sm">
          <div className="font-medium text-red-300">Error message</div>
          <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-red-200/90">
            {error.message || "(no message)"}
          </pre>
          {error.digest && (
            <div className="mt-2 text-[11px] text-red-200/60">
              Digest: {error.digest}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-ink-50 bg-ink-50 px-4 py-2 text-sm font-medium text-ink-950 transition hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/beta"
            className="rounded-md border border-ink-200/40 px-4 py-2 text-sm transition hover:border-ink-200/70"
          >
            Reset and start over
          </Link>
        </div>

        <p className="text-xs text-ink-200/50">
          Tip: if the error mentions CV parsing, try uploading the file as
          DOCX instead of PDF (or paste the text manually). We&apos;re still
          fixing some PDF edge cases.
        </p>
      </section>
    </main>
  );
}
