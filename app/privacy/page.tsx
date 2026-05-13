/**
 * Privacy Policy — DRAFT.
 *
 * This page describes how Step processes personal data. It is written
 * to be honest about the actual data flows in the product (vs. boilerplate
 * cut-and-paste from a generator), and to link the GDPR rights surfaces
 * we've already shipped under /account.
 *
 * IT IS A DRAFT. A qualified lawyer must review before launch. The
 * `LawyerReviewBanner` makes that visible to readers until it's removed.
 */
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy · Step",
  description:
    "How Step collects, uses, and stores personal data. GDPR-compliant: download or delete your data anytime from your account.",
};

const LAST_UPDATED = "May 13, 2026";

function LawyerReviewBanner() {
  return (
    <div className="mb-10 rounded-lg border border-amber-400/35 bg-amber-400/[0.06] p-4 text-sm leading-relaxed text-amber-100/95">
      <strong>Draft — pending legal review.</strong> This document describes
      Step&apos;s actual data practices, but is not yet finalised by our
      counsel. If anything here matters to your decision to use Step, email
      us at <a href="mailto:hi@step.careers" className="underline">hi@step.careers</a> and
      we&apos;ll confirm.
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-12 text-xs font-semibold uppercase tracking-[0.18em] text-ink-200/55">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 text-base font-semibold text-ink-50/95">{children}</h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-sm leading-relaxed text-ink-200/85">{children}</p>
  );
}

function ULItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="mt-2 flex gap-3 text-sm leading-relaxed text-ink-200/85">
      <span aria-hidden className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-ink-200/45" />
      <span>{children}</span>
    </li>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <header className="mb-10">
        <Link
          href="/"
          className="text-sm text-ink-200/60 transition hover:text-ink-200/90"
        >
          ← Back to Step
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink-50 md:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-xs text-ink-200/55">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <LawyerReviewBanner />

      <H2>Who we are</H2>
      <P>
        Step (&ldquo;we&rdquo;, &ldquo;Step&rdquo;) operates the website
        step.careers. We are the data controller for the personal data
        described below. We&apos;re a small team based in Italy and the UK
        building career-advice software for early-career professionals
        worldwide.
      </P>
      <P>
        Contact:{" "}
        <a href="mailto:hi@step.careers" className="underline decoration-ink-200/30 underline-offset-4 hover:decoration-ink-200/60">
          hi@step.careers
        </a>
        .
      </P>

      <H2>What we collect</H2>

      <H3>Account data</H3>
      <P>
        When you sign in via Google or email magic link, we receive and store
        your email address and (from Google) your display name and profile
        photo URL. We do not receive your Google password. For magic-link
        sign-in we generate a short-lived verification token sent to your
        inbox.
      </P>

      <H3>Career profile data (the form)</H3>
      <P>
        When you generate a plan in <Link href="/beta" className="underline">/beta</Link>{" "}
        we collect what you type into the form: career stage, field, skills,
        interests, your current dilemma, studies, past positions, languages,
        salary band (optional), location preference (optional), and your
        5-year future-self description.
      </P>
      <P>
        If you upload or paste a CV, the parser extracts a structured profile
        in memory. The original PDF/DOCX is not stored. The extracted text is
        used to pre-fill the form and you can edit any field before
        submitting.
      </P>

      <H3>Generated content</H3>
      <P>
        When you submit the form, we send the structured profile to Anthropic
        Claude and Voyage AI (see &ldquo;Sub-processors&rdquo; below) to
        retrieve similar real career paths from our dataset and generate
        ranked recommendations. The resulting plan is stored if you are
        signed in (so you can revisit it from /account) and may be cached
        anonymously for service quality monitoring.
      </P>

      <H3>Technical data</H3>
      <P>
        On every session we record an SHA-256 hash of your IP address (not
        the address itself) and your browser&apos;s user-agent string, for
        rate-limiting and abuse prevention. Sentry receives error stack
        traces when something breaks server-side; these may include URL
        paths and a minimal user identifier but never form content.
      </P>

      <H3>Payment data</H3>
      <P>
        If you purchase Premium, Stripe processes your payment directly and
        we never see card numbers. We store a Stripe customer identifier so
        we can match subscription events back to your account, plus your
        Premium expiry timestamp.
      </P>

      <H3>Analytics</H3>
      <P>
        We use PostHog (EU-hosted) for product analytics. We capture
        anonymised events such as &ldquo;result_received&rdquo; or
        &ldquo;premium_card_clicked&rdquo; without form content. We do not
        share analytics data with advertising networks.
      </P>

      <H2>Why we use it</H2>
      <P>Our legal bases under the GDPR:</P>
      <ul>
        <ULItem>
          <strong>Performance of a contract</strong> — to operate your
          account, generate plans, deliver Premium features, and send
          transactional emails (sign-in links, payment receipts).
        </ULItem>
        <ULItem>
          <strong>Legitimate interest</strong> — security, fraud prevention,
          service-quality monitoring, and product improvement. You can object
          at any time.
        </ULItem>
        <ULItem>
          <strong>Consent</strong> — for the Premium check-in email series.
          Every check-in email contains a one-click unsubscribe link, and
          you can also toggle the cadence from /account.
        </ULItem>
        <ULItem>
          <strong>Legal obligation</strong> — payment, accounting, and tax
          records for purchases, as required by Italian and UK law.
        </ULItem>
      </ul>

      <H2>Sub-processors</H2>
      <P>
        We use the following services to operate Step. They process personal
        data on our behalf under data-processing agreements:
      </P>
      <ul>
        <ULItem>
          <strong>Vercel</strong> (USA &amp; EU) — application hosting.
        </ULItem>
        <ULItem>
          <strong>Supabase</strong> (EU, Ireland) — Postgres database.
        </ULItem>
        <ULItem>
          <strong>Anthropic</strong> (USA) — Claude LLM. Receives the
          structured profile and the retrieved career paths to generate
          recommendations. Anthropic does not train models on API content
          per their default Commercial Terms.
        </ULItem>
        <ULItem>
          <strong>Voyage AI</strong> (USA) — embedding model used to find
          similar career paths.
        </ULItem>
        <ULItem>
          <strong>Stripe</strong> (USA &amp; EU) — payment processing for
          Premium.
        </ULItem>
        <ULItem>
          <strong>Resend</strong> (EU) — transactional and check-in emails.
        </ULItem>
        <ULItem>
          <strong>Google</strong> (USA) — OAuth login.
        </ULItem>
        <ULItem>
          <strong>Cloudflare Turnstile</strong> (global) — bot protection.
        </ULItem>
        <ULItem>
          <strong>Sentry</strong> (EU) — error monitoring.
        </ULItem>
        <ULItem>
          <strong>PostHog</strong> (EU) — product analytics.
        </ULItem>
      </ul>

      <H2>International transfers</H2>
      <P>
        Anthropic, Voyage, Stripe, Google, and Vercel (depending on region)
        process data in the United States. Transfers rely on the EU-US Data
        Privacy Framework where the vendor is certified, and otherwise on
        Standard Contractual Clauses (SCCs) approved by the European
        Commission.
      </P>

      <H2>How long we keep it</H2>
      <P>
        Account and profile data: until you delete your account. Generated
        plans: until you delete the plan (soft delete) or your account (hard
        cascade). Payment records: 10 years, as required by accounting law.
        Logs and analytics events: 90 days by default. IP hashes: 30 days.
      </P>

      <H2>Your rights</H2>
      <P>Under the GDPR you can:</P>
      <ul>
        <ULItem>
          Access and download a copy of your data — one click from{" "}
          <Link href="/account" className="underline decoration-ink-200/30 underline-offset-4 hover:decoration-ink-200/60">
            /account
          </Link>{" "}
          (&ldquo;Download my data (JSON)&rdquo;).
        </ULItem>
        <ULItem>
          Delete your account and all linked data — also from /account
          (&ldquo;Delete my account&rdquo;). The action is irreversible.
        </ULItem>
        <ULItem>
          Correct inaccurate data, restrict processing, or object to
          processing — email{" "}
          <a href="mailto:hi@step.careers" className="underline">
            hi@step.careers
          </a>
          .
        </ULItem>
        <ULItem>
          Withdraw consent at any time (e.g. unsubscribe from check-ins).
          Withdrawal doesn&apos;t affect processing already done.
        </ULItem>
        <ULItem>
          Lodge a complaint with your national supervisory authority (in
          Italy, the Garante per la protezione dei dati personali).
        </ULItem>
      </ul>

      <H2>Cookies</H2>
      <P>
        We use a NextAuth session cookie (HTTP-only, secure, SameSite=Lax) to
        keep you signed in, and Cloudflare Turnstile may set a short-lived
        cookie during bot challenges. PostHog uses a first-party cookie for
        anonymous analytics; you can disable it through your browser&apos;s
        Do-Not-Track signal which we honour.
      </P>

      <H2>Children</H2>
      <P>
        Step is not directed at users under 16. We don&apos;t knowingly
        collect data from anyone under that age. If you believe we have, email
        us and we&apos;ll delete the account.
      </P>

      <H2>Changes</H2>
      <P>
        We&apos;ll post any material changes on this page and update the
        &ldquo;Last updated&rdquo; date. If the change is significant
        (e.g. a new sub-processor with material risk), we&apos;ll email
        registered users in advance.
      </P>
    </main>
  );
}
