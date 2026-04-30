"use client";

import { useState } from "react";
import Link from "next/link";

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
      <header className="mb-10 flex items-center justify-between">
        <p className="text-sm font-medium tracking-wide text-ink-200/80 dark:text-ink-200/60">
          step.careers
        </p>
        <Link
          href="/beta"
          className="text-xs uppercase tracking-wider text-ink-200/60 transition hover:text-ink-50"
        >
          Try the beta →
        </Link>
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

      {/* What's live today ────────────────────────────────────── */}
      <section className="mt-16 flex flex-col gap-4 md:mt-20">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
          Live today
        </h2>
        <ul className="flex flex-col gap-3 text-base leading-relaxed">
          <Bullet>
            <strong>3–5 ranked next moves</strong> for your specific dilemma,
            backed by curated career paths from Italy, UK, and EU.
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
      <footer className="mt-20 flex flex-col gap-2 text-xs text-ink-200/50 md:flex-row md:justify-between">
        <span>© {new Date().getFullYear()} Step</span>
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
