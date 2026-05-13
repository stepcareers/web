import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why Step exists: most career advice is either generic blogs or one-off mentor calls. We're building the thing in between — evidence-grounded recommendations from real career patterns, in a senior peer voice.",
  alternates: { canonical: "https://step.careers/about" },
};

export default function AboutPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10 md:py-16">
      <header className="mb-10 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium tracking-wide text-ink-200/80 transition hover:opacity-70 dark:text-ink-200/60"
        >
          step.careers
        </Link>
        <Link
          href="/beta"
          className="text-xs uppercase tracking-wider text-ink-200/60 transition hover:text-ink-50"
        >
          Try the beta →
        </Link>
      </header>

      <article className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-ink-200/30 px-3 py-1 text-xs uppercase tracking-wider text-ink-200/70">
            About
          </span>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
            Career advice that doesn&apos;t lie to you.
          </h1>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
            The problem
          </h2>
          <p className="leading-relaxed text-ink-200/90">
            Most career advice is either{" "}
            <strong>generic content</strong> (LinkedIn posts, advice
            blogs, &ldquo;5 tips for...&rdquo;) or{" "}
            <strong>one-off conversations</strong> (mentor calls,
            coaches at €200/hour). Neither scales for the messy middle
            — the 22-year-old graduating soon, the 25-year-old at a
            scale-up wondering whether to leave, the 28-year-old
            deciding between FAANG and a startup.
          </p>
          <p className="leading-relaxed text-ink-200/90">
            The big AI tools (ChatGPT, Gemini) give plausible-sounding
            advice but invent statistics, hedge everything, and have
            no grounding in real career patterns. They&apos;ll tell
            anyone the same five generic moves.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
            What we&apos;re building
          </h2>
          <p className="leading-relaxed text-ink-200/90">
            Step is the thing in between: a recommendation engine
            grounded in <strong>10,500+ curated career paths</strong>{" "}
            (real anonymized stories from Italy, UK, EU, and US) with
            honest evidence counts and a senior peer voice. We refuse
            invented probabilities. We name leverage explicitly. We
            tell you when our data is thin.
          </p>
          <p className="leading-relaxed text-ink-200/90">
            The goal: every ambitious young person should be able to
            ask &ldquo;what do I do next?&rdquo; and get an honest,
            specific, evidence-grounded answer in 2 minutes — not
            corporate-hedged platitudes.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
            Where we are
          </h2>
          <p className="leading-relaxed text-ink-200/90">
            We&apos;re in beta. The core engine works (10,500+ paths,
            vector retrieval, Claude-grounded recommendations,
            decision tree). We&apos;re focused on quality over feature
            count — every new addition is gated on whether it makes
            the recommendations sharper, not flashier.
          </p>
          <p className="leading-relaxed text-ink-200/90">
            Coming up the roadmap: real job matches tied to your
            recommendations, tailored CVs per application, 90-day
            check-in cadence, and a Premium tier with personalized 1:1
            advisor support.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
            Stack
          </h2>
          <p className="leading-relaxed text-ink-200/90">
            Built on Next.js 15 + React 19 + TypeScript. Postgres on
            Supabase (eu-west-1) with pgvector for retrieval. Voyage
            AI for embeddings (voyage-3-large, 1024-dim). Anthropic
            Claude (Haiku 4.5) for generation. Vercel for hosting.
            Resend for transactional email. NextAuth for sign-in
            (Google + email magic links).
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
            Made in
          </h2>
          <p className="leading-relaxed text-ink-200/90">
            Italy &amp; the UK — the two markets we know best, and the
            two that anchor our dataset most heavily. EU and US paths
            are growing.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
            Get in touch
          </h2>
          <p className="leading-relaxed text-ink-200/90">
            Feedback, partnership ideas, or want to see your career
            story added to the dataset (anonymized)? Email{" "}
            <a
              href="mailto:hi@step.careers"
              className="underline underline-offset-4 hover:opacity-70"
            >
              hi@step.careers
            </a>
            .
          </p>
        </section>

        <section className="rounded-xl border border-ink-200/25 bg-ink-200/[0.03] p-6">
          <h2 className="text-base font-semibold leading-snug">
            Try the beta
          </h2>
          <p className="mt-2 text-sm text-ink-200/80">
            2 minutes, no signup. See what evidence-grounded advice
            looks like for your profile.
          </p>
          <Link
            href="/beta"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink-50 px-6 py-3 text-sm font-medium text-ink-950 transition hover:opacity-80"
          >
            Open the planner →
          </Link>
        </section>
      </article>

      <footer className="mt-16 flex flex-col gap-2 text-xs text-ink-200/50 md:flex-row md:justify-between">
        <span>© {new Date().getFullYear()} Step</span>
        <span>Built with care in Italy &amp; the UK.</span>
      </footer>
    </main>
  );
}
