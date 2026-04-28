export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-between px-6 py-12 md:py-20">
      <header>
        <p className="text-sm font-medium tracking-wide text-ink-200/80 dark:text-ink-200/60">
          step.careers
        </p>
      </header>

      <section className="my-auto flex flex-col gap-8">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          Find your next career step.
        </h1>

        <p className="max-w-lg text-lg leading-relaxed text-ink-200/90 dark:text-ink-200/70 md:text-xl">
          Tell us where you are. Get 3–5 ranked next moves backed by real
          career patterns. Two minutes, no commitment.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-full bg-ink-950 px-6 py-3 text-sm font-medium text-ink-50 opacity-50 dark:bg-ink-50 dark:text-ink-950"
            aria-label="Get your next step (coming soon)"
          >
            Get your next step
          </button>
          <span className="text-sm text-ink-200/60 dark:text-ink-200/50">
            Coming soon — we&apos;re live in beta in a few weeks.
          </span>
        </div>
      </section>

      <footer className="mt-16 flex flex-col gap-2 text-xs text-ink-200/50 dark:text-ink-200/40 md:flex-row md:justify-between">
        <span>© {new Date().getFullYear()} Step</span>
        <span>Built with care in Italy &amp; the UK.</span>
      </footer>
    </main>
  );
}
