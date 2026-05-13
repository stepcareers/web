/**
 * Custom 404. The default Next.js page is monochrome and gives the
 * visitor no way back into the funnel; this one matches the rest of
 * the site and routes them to the home or the planner.
 */
import Link from "next/link";

export const metadata = {
  title: "Page not found · Step",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-amber-300/80">
        404
      </p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
        We couldn&apos;t find that page.
      </h1>
      <p className="mt-4 text-base text-ink-200/80">
        The link might be old or the URL mistyped. The planner and the rest of
        Step are one click away.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/beta"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-ink-950 shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_22px_-14px_rgba(245,158,11,0.6)] transition hover:bg-amber-300"
        >
          Try the beta →
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-200/25 px-6 py-3 text-sm text-ink-200/85 transition hover:border-ink-200/45"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
