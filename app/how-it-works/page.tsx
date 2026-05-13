import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Step turns career uncertainty into ranked next steps: 10,500+ curated career paths, vector embeddings, and Claude-grounded recommendations with honest evidence counts. No invented probabilities.",
  keywords: [
    "how Step works",
    "AI career advice methodology",
    "career path recommendation engine",
    "evidence-based career advice",
    "vector embeddings career",
  ],
  alternates: { canonical: "https://step.careers/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10 md:py-16">
      {/* Article structured data — helps Google show this page as
          a content article in search results. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "TechArticle",
            headline: "How Step works — under the hood",
            description:
              "Step's career recommendation engine: 10,500+ curated career paths, vector embedding retrieval, and Claude-grounded advice with honest evidence counts.",
            author: { "@type": "Organization", name: "Step" },
            publisher: {
              "@type": "Organization",
              name: "Step",
              url: "https://step.careers",
            },
            datePublished: "2026-05-10",
            mainEntityOfPage: "https://step.careers/how-it-works",
          }),
        }}
      />

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
            Methodology
          </span>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
            How Step works
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-ink-200/90 dark:text-ink-200/70">
            Most career advice is either generic blog posts or one-off
            mentor calls. Step is something else: a recommendation
            engine grounded in 10,500+ curated career paths across 76
            countries, with honest evidence counts instead of made-up
            probabilities.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
            The dataset
          </h2>
          <p className="leading-relaxed text-ink-200/90">
            We&apos;ve curated{" "}
            <strong className="text-ink-50">10,500+ career paths</strong>{" "}
            — real anonymized stories of how people moved from one role
            to another. Each path has the starting state (stage, field,
            role), the transition type (vertical promo, industry pivot,
            geo move...), the next role with timeframe, the 4–5 concrete
            actions that drove the transition, and the 24-month outcome.
          </p>
          <p className="leading-relaxed text-ink-200/90">
            The dataset spans 76 countries — US, UK, Italy, Germany,
            France, Spain, the Nordics, India, Canada, Australia,
            Singapore, Hong Kong, Japan, Korea, Brazil, Mexico, the
            broader LatAm, the UAE, Saudi Arabia and the wider MENA, plus
            sub-Saharan Africa and CIS. It covers elite tracks (FAANG
            SWE, MBB consulting, IB analyst, VC associate, Magic Circle
            law, Bain Capital PE) and underrepresented ones (NHS doctor
            pivots, Italian boutique consulting, bootcamp grads, dropout
            founders, returnship parents, military veterans, late-30s
            career switchers, neurodivergent ICs, FGLI students). Every
            path has a confidence label —{" "}
            <code className="rounded bg-ink-200/10 px-1.5 py-0.5 text-sm">
              high
            </code>{" "}
            for well-trodden,{" "}
            <code className="rounded bg-ink-200/10 px-1.5 py-0.5 text-sm">
              low
            </code>{" "}
            for selective or unusual.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
            The retrieval
          </h2>
          <p className="leading-relaxed text-ink-200/90">
            When you submit your profile (stage, field, skills,
            education, past positions, languages, salary, 5-year vision,
            specific dilemma), we embed it with{" "}
            <a
              href="https://www.voyageai.com/"
              className="underline underline-offset-4 hover:opacity-70"
              target="_blank"
              rel="noopener"
            >
              Voyage AI
            </a>{" "}
            into a 1024-dimensional vector. We then retrieve the 5 most
            similar career paths from the dataset using cosine distance
            on{" "}
            <a
              href="https://github.com/pgvector/pgvector"
              className="underline underline-offset-4 hover:opacity-70"
              target="_blank"
              rel="noopener"
            >
              pgvector
            </a>
            . This isn&apos;t keyword matching — semantically similar
            paths surface even when the exact words differ.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
            The recommendations
          </h2>
          <p className="leading-relaxed text-ink-200/90">
            We feed the retrieved paths plus your profile to Anthropic
            Claude (Haiku 4.5) with a tight prompt that enforces 14
            hard rules: ground every recommendation in 1–3 retrieved
            paths, honor your priority order (position vs money vs
            location), respect education and past positions to
            differentiate, no invented statistics, salary realism
            anchored to your current comp, honest confidence labels.
          </p>
          <p className="leading-relaxed text-ink-200/90">
            Output is 3–4 ranked recommendations. Each carries:
          </p>
          <ul className="ml-1 flex flex-col gap-2 pl-4 leading-relaxed text-ink-200/85 marker:text-ink-200/40 [&>li]:list-disc">
            <li>
              <strong>A leverage tag</strong> —{" "}
              <code className="rounded bg-ink-200/10 px-1.5 py-0.5 text-sm">
                foundation
              </code>{" "}
              (without this, the vision is unrealistic),{" "}
              <code className="rounded bg-ink-200/10 px-1.5 py-0.5 text-sm">
                accelerator
              </code>{" "}
              (compresses the timeframe),{" "}
              <code className="rounded bg-ink-200/10 px-1.5 py-0.5 text-sm">
                optional
              </code>{" "}
              (useful but not gating). Hard cap: at most one foundation
              per plan.
            </li>
            <li>
              <strong>Path evidence</strong> — a literal count from the
              retrieved paths, e.g. &ldquo;3 of 5 retrieved profiles took
              this exact action; 2 reached an equivalent outcome within
              24 months.&rdquo; Never invented percentages.
            </li>
            <li>
              <strong>3–4 concrete 90-day actions</strong> — verb-led,
              time-bounded, replicable. Not &ldquo;network more.&rdquo;
            </li>
            <li>
              <strong>12-month outcome</strong> — one specific sentence
              describing where you&apos;d be.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
            Why no probabilities
          </h2>
          <p className="leading-relaxed text-ink-200/90">
            Career advice tools love to say &ldquo;83% match&rdquo; or
            &ldquo;+38% chance of promotion.&rdquo; With 8,500 paths and
            no control group, those numbers would be invented. We
            refuse. Instead each move carries the leverage tag plus an
            evidence count from the retrieved paths — that&apos;s the
            honest version of &ldquo;how much does this matter?&rdquo;
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
            What you also get
          </h2>
          <ul className="ml-1 flex flex-col gap-2 pl-4 leading-relaxed text-ink-200/85 marker:text-ink-200/40 [&>li]:list-disc">
            <li>
              <strong>Honest take</strong> — a 4–6 sentence paragraph
              from a senior peer voice. Direct where the data supports
              it, humble where it doesn&apos;t.
            </li>
            <li>
              <strong>What we don&apos;t know about you</strong> — gaps
              in your input that would change the recommendations if
              filled. Prompt for refinement.
            </li>
            <li>
              <strong>3 closed follow-up questions</strong> — generated
              from your gaps, click an option to refine the plan in 30
              seconds.
            </li>
            <li>
              <strong>Decision tree (Premium)</strong> — anchored on
              the foundation move: NOW → DAY 90 → MONTH 6 → MONTH 18 →
              YEAR 5, with branches and 3 outcome scenarios.
            </li>
            <li>
              <strong>Per-recommendation scenario expansion (Premium)</strong>{" "}
              — for each rec, the 3-month, 12-month, 5-year states plus
              risks and tradeoffs.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
            Privacy
          </h2>
          <p className="leading-relaxed text-ink-200/90">
            Your inputs and generated plans are stored on our
            infrastructure (Supabase EU, eu-west-1). We don&apos;t share
            or sell your data. CV uploads are processed in-memory only
            and never persisted as files. Email magic-links and 90-day
            check-ins are opt-in.
          </p>
        </section>

        <section className="rounded-xl border border-ink-200/25 bg-ink-200/[0.03] p-6">
          <h2 className="text-base font-semibold leading-snug">
            Try it with your own profile
          </h2>
          <p className="mt-2 text-sm text-ink-200/80">
            2 minutes, no signup. The beta runs in 30–60 seconds.
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
