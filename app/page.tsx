"use client";

import { useState } from "react";
import Link from "next/link";
import { TurnstileWidget } from "@/components/turnstile";

/**
 * Step — public landing page.
 *
 * Marketing-first: explains the product (today + roadmap), captures
 * waitlist emails with a "what excites you most" signal, and exposes
 * the live beta behind a single CTA so visitors self-select.
 *
 * The actual form / pipeline lives at /beta.
 */

type Interest =
  | "job_matching"
  | "cv_adaptation"
  | "dream_tracking"
  | "accountability"
  | "other";

const INTEREST_OPTIONS: Array<{ value: Interest; label: string; hint: string }> = [
  {
    value: "job_matching",
    label: "Real job matches",
    hint: "Show me actual openings that fit my next step.",
  },
  {
    value: "cv_adaptation",
    label: "Tailored CVs",
    hint: "Help me rewrite my CV per application.",
  },
  {
    value: "dream_tracking",
    label: "5-year dream tracking",
    hint: "Track my long-term trajectory, not just next quarter.",
  },
  {
    value: "accountability",
    label: "Front-loaded check-ins",
    hint: "Email me at days 1, 2, 4, 7, 14, 21, 30, 45, 60, 90.",
  },
  {
    value: "other",
    label: "Something else",
    hint: "I'll tell you what.",
  },
];

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState<Interest | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  async function handleWaitlistSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setErrorMsg("Please enter a valid email.");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          mostInterestedIn: interest,
          notes: notes.trim() || undefined,
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? `API ${res.status}`);
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10 md:py-16">
      {/* Structured data — Organization + WebApplication, used by Google
          for rich snippets in search results. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": "https://step.careers/#org",
                name: "Step",
                url: "https://step.careers",
                description:
                  "AI career advice grounded in real career patterns. Step gives ambitious students and early-career professionals 3–5 ranked next moves with concrete 90-day actions.",
              },
              {
                "@type": "WebApplication",
                name: "Step",
                url: "https://step.careers",
                applicationCategory: "BusinessApplication",
                operatingSystem: "Web",
                description:
                  "AI career planner. Get 3–5 ranked next-step recommendations grounded in 10,000+ curated career paths across 26 countries. Includes 90-day actions, 12-month outcome, 5-year vision bridge.",
                offers: {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "EUR",
                  description: "Free during beta",
                },
                publisher: { "@id": "https://step.careers/#org" },
                featureList: [
                  "3–5 ranked career recommendations per session",
                  "90-day actionable plans",
                  "Decision tree visualization",
                  "Per-recommendation scenario expansion",
                  "Honest take in senior peer voice",
                  "Salary realism anchored to current comp",
                ],
              },
            ],
          }),
        }}
      />
      <header className="mb-10 flex items-center justify-between">
        <p className="text-sm font-medium tracking-wide text-ink-200/80 dark:text-ink-200/60">
          step.careers
        </p>
        <nav className="flex items-center gap-4 text-xs uppercase tracking-wider text-ink-200/60">
          <Link
            href="/how-it-works"
            className="transition hover:text-ink-50"
          >
            How it works
          </Link>
          <Link
            href="/beta"
            className="transition hover:text-ink-50"
          >
            Try the beta →
          </Link>
        </nav>
      </header>

      {/* Hero ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-6">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-ink-200/30 px-3 py-1 text-xs uppercase tracking-wider text-ink-200/70">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Beta · live today
        </span>
        <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          Find your next career step.
          <br />
          <span className="text-ink-200/50">Backed by real patterns.</span>
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-ink-200/90 dark:text-ink-200/70 md:text-xl">
          AI career advice grounded in real career patterns. We turn the fog of{" "}
          <span className="text-ink-50">&ldquo;what do I do next?&rdquo;</span>{" "}
          into 3–5 ranked moves with concrete 90-day actions, a 12-month
          outcome, and a bridge to your 5-year vision.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/beta"
            className="self-start rounded-full bg-ink-50 px-7 py-3.5 text-sm font-medium text-ink-950 transition hover:opacity-80"
          >
            Try the beta →
          </Link>
          <span className="text-sm text-ink-200/60 dark:text-ink-200/50">
            2 minutes. No signup. Beta runs 30–60 seconds.
          </span>
        </div>
      </section>

      {/* Journey preview ──────────────────────────────────────── */}
      <section className="mt-14 md:mt-16">
        <p className="mb-4 text-xs uppercase tracking-wider text-ink-200/50">
          What you&apos;ll get
        </p>
        <div className="rounded-xl border border-ink-200/20 bg-ink-200/[0.03] p-5 dark:bg-ink-50/[0.02]">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <JourneyStep label="Now" detail="Where you are" filled />
            <JourneyStep label="Day 90" detail="3–4 actions per move" />
            <JourneyStep label="Month 12" detail="First visible outcome" />
            <JourneyStep label="Year 5" detail="Your vision, reality-checked" />
          </div>
        </div>
      </section>

      {/* Sample plan preview ──────────────────────────────────── */}
      <SamplePlanPreview />

      {/* What's live today ────────────────────────────────────── */}
      <section className="mt-16 flex flex-col gap-4 md:mt-20">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
          Live today
        </h2>
        <ul className="flex flex-col gap-3 text-base leading-relaxed">
          <Bullet>
            <strong>3–5 ranked next moves</strong> for your specific dilemma,
            backed by <strong>10,000+ curated career paths across 26
            countries</strong> — US, UK, EU, India, Canada, Australia,
            Singapore, Hong Kong, Japan, Korea, Brazil, MENA, sub-Saharan
            Africa, and more.
          </Bullet>
          <Bullet>
            <strong>Concrete 90-day actions</strong> — verb-led, time-bounded,
            replicable. Not &ldquo;network more.&rdquo;
          </Bullet>
          <Bullet>
            <strong>Honest take</strong> in the voice of a senior peer who has
            seen this play out, not a polite cheerleader.
          </Bullet>
          <Bullet>
            <strong>Salary realism</strong>. We anchor every move to your
            current comp — no fantasy 4x jumps in 12 months.
          </Bullet>
          <Bullet>
            <strong>Confidence labels</strong>. We tell you when our data is
            thin, not just when we&apos;re sure.
          </Bullet>
        </ul>
      </section>

      {/* Coming soon ──────────────────────────────────────────── */}
      <section className="mt-16 flex flex-col gap-4 md:mt-20">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
          Coming soon
        </h2>
        <p className="max-w-2xl text-sm text-ink-200/70 dark:text-ink-200/60">
          The full decision-to-action loop. We&apos;re prioritizing based on
          what real users ask for, not what looks cool on a roadmap.
        </p>
        <ul className="flex flex-col gap-3 text-base leading-relaxed">
          <Bullet>
            <strong>Real job matches</strong> — given the recommended move,
            see actual openings that fit (location, comp, role).
          </Bullet>
          <Bullet>
            <strong>Tailored CVs</strong> per application, in your voice. No
            generic templates.
          </Bullet>
          <Bullet>
            <strong>Your 5-year dream as a roadmap</strong>. Tell us where you
            want to be. We backtrack the steps and track your progress.
          </Bullet>
          <Bullet>
            <strong>Front-loaded check-ins</strong>. Emails at day 1, 2, 4, 7,
            14, 21, 30, 45, 60, 90 — designed so you actually do the work, not
            just read the recommendations.
          </Bullet>
          <Bullet>
            <strong>Premium tier</strong>. Monthly 1:1 with a senior advisor,
            CV review tied to your plan, matched job opportunities.
          </Bullet>
        </ul>
      </section>

      {/* Waitlist ────────────────────────────────────────────── */}
      <section className="mt-16 flex flex-col gap-5 md:mt-20">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
          Tell us what you want next
        </h2>
        <p className="max-w-2xl text-sm text-ink-200/70 dark:text-ink-200/60">
          Join the waitlist. Pick the feature you&apos;re most excited about —
          we ship in the order users ask.
        </p>

        {status === "success" ? (
          <div className="rounded-md border border-green-500/30 bg-green-500/10 px-5 py-4 text-base text-green-700 dark:text-green-300">
            ✓ You&apos;re in. We&apos;ll email you when the next thing ships.
          </div>
        ) : (
          <form
            onSubmit={handleWaitlistSubmit}
            className="flex flex-col gap-5 rounded-lg border border-ink-200/20 p-5"
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="form-input"
              />
            </label>

            <fieldset className="flex flex-col gap-2.5">
              <legend className="text-sm font-medium">
                What feature would unlock the most value for you?
              </legend>
              <div className="flex flex-col gap-2">
                {INTEREST_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition ${
                      interest === opt.value
                        ? "border-ink-50 bg-ink-200/10"
                        : "border-ink-200/30 hover:border-ink-200/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="interest"
                      value={opt.value}
                      checked={interest === opt.value}
                      onChange={() => setInterest(opt.value)}
                      className="mt-1"
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-xs text-ink-200/60">
                        {opt.hint}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                Anything else? (optional)
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What career problem are you trying to solve? What's missing in tools you've tried?"
                rows={3}
                maxLength={500}
                className="form-input"
              />
            </label>

            {errorMsg && status === "error" && (
              <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
            )}

            {/* Cloudflare Turnstile bot check — invisible managed mode.
                Renders nothing if the env site key is unset. */}
            <TurnstileWidget onToken={setTurnstileToken} />

            <button
              type="submit"
              disabled={status === "submitting"}
              className="self-start rounded-full bg-ink-50 px-6 py-3 text-sm font-medium text-ink-950 transition hover:opacity-80 disabled:opacity-50"
            >
              {status === "submitting" ? "Submitting…" : "Join the waitlist"}
            </button>
          </form>
        )}
      </section>

      {/* Footer ──────────────────────────────────────────────── */}
      <footer className="mt-20 flex flex-col gap-4 text-xs text-ink-200/50 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span>© {new Date().getFullYear()} Step</span>
          <Link
            href="/how-it-works"
            className="underline-offset-4 transition hover:underline hover:text-ink-200/80"
          >
            How it works
          </Link>
          <Link
            href="/about"
            className="underline-offset-4 transition hover:underline hover:text-ink-200/80"
          >
            About
          </Link>
          <Link
            href="/beta"
            className="underline-offset-4 transition hover:underline hover:text-ink-200/80"
          >
            Beta
          </Link>
        </div>
        <span>Built with care in Italy &amp; the UK.</span>
      </footer>
    </main>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2.5 inline-block h-1 w-1 shrink-0 rounded-full bg-ink-200/60" />
      <span>{children}</span>
    </li>
  );
}

function JourneyStep({
  label,
  detail,
  filled,
}: {
  label: string;
  detail: string;
  filled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            filled
              ? "bg-ink-50"
              : "border-2 border-ink-200/40 bg-transparent"
          }`}
        />
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
          {label}
        </span>
      </div>
      <span className="text-sm leading-snug text-ink-200/80">{detail}</span>
    </div>
  );
}

/* ─── Sample plan preview ──────────────────────────────────────── */

function SamplePlanPreview() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="mt-10 md:mt-12">
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        className="flex w-full items-center justify-between rounded-xl border border-ink-200/25 bg-ink-200/[0.03] px-5 py-4 text-left transition hover:border-ink-200/50"
        aria-expanded={expanded}
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-xs uppercase tracking-wider text-ink-200/60">
            Curious what you&apos;d actually get?
          </span>
          <span className="text-base font-medium">
            See a sample plan — anonymized real output
          </span>
        </span>
        <span className="text-xl text-ink-200/60">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="mt-4 flex flex-col gap-5 rounded-xl border border-ink-200/20 p-6">
          <div className="flex flex-col gap-2 border-b border-ink-200/15 pb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-200/60">
              The profile (anonymized)
            </span>
            <p className="text-sm leading-relaxed text-ink-200/80">
              UK junior backend engineer at a Series B fintech, 18 months in.
              Currently £58k. Wants to be tech lead in 18–24 months. Priority:
              position first, money second, location third (London-based).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-200/60">
              Top recommendation
            </span>
            <h3 className="text-lg font-semibold leading-snug">
              Volunteer to own the next high-stakes service end-to-end
            </h3>
            <p className="text-sm leading-relaxed text-ink-200/85">
              The uk-cs-grad-to-techlead path shows that &ldquo;volunteered to
              own&rdquo; is the recurring move from junior to tech lead at
              fintechs. With your TypeScript and Postgres depth, the payments
              service rewrite is your highest-leverage project.
            </p>

            <div className="mt-3 flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-200/60">
                90-day actions
              </span>
              <ul className="ml-1 flex flex-col gap-1.5 pl-4 text-sm leading-relaxed text-ink-200/85 marker:text-ink-200/40 [&>li]:list-disc">
                <li>
                  Identify the 2–3 services your team owns where the on-call
                  burden is highest. Volunteer to own the rewrite of one in
                  your next 1:1.
                </li>
                <li>
                  Mentor 1 incoming intern this quarter — write a 1-page
                  onboarding doc that becomes the team&apos;s default.
                </li>
                <li>
                  Drive 1 cross-team initiative end-to-end (pick the smallest
                  visible one) to show stakeholder management, not just code.
                </li>
              </ul>
            </div>

            <div className="mt-3 flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-200/60">
                12-month outcome
              </span>
              <p className="text-sm text-ink-200/85">
                Senior Engineer with one squad-wide rewrite shipped, 1 mentee
                promoted, on the tech-lead shortlist for the next opening.
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-200/60">
              <span className="font-semibold text-emerald-400">
                HIGH confidence
              </span>
              <span>·</span>
              <span>
                Path replicated by 3 of 5 retrieved profiles in the same stage
                + field
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-ink-200/15 bg-ink-200/[0.03] p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-200/60">
              Honest take
            </span>
            <p className="text-sm leading-relaxed text-ink-200/85">
              You&apos;re asking the right question, but the bottleneck for
              tech lead at 18 months in is rarely technical — it&apos;s
              showing you can drive work that isn&apos;t yours. Your TypeScript
              skills are table stakes. The signal that gets you promoted is
              owning a hairy multi-team project before someone above you asks
              you to. Pick that project this quarter.
            </p>
          </div>

          <div className="text-xs text-ink-200/50">
            This is one move out of three to four ranked recommendations.
            Yours will be specific to your stage, field, dilemma, and 5-year
            vision.
          </div>

          <Link
            href="/beta"
            className="self-start rounded-full bg-ink-50 px-5 py-2.5 text-sm font-medium text-ink-950 transition hover:opacity-80"
          >
            Try with your own profile →
          </Link>
        </div>
      )}
    </section>
  );
}
