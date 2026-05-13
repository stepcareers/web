/**
 * Terms of Service — DRAFT.
 *
 * The contract between Step and the user. Pricing language matches the
 * Stripe products and the PremiumCard copy. Pending lawyer review.
 */
import Link from "next/link";

export const metadata = {
  title: "Terms of Service · Step",
  description:
    "Terms under which you can use Step — account responsibilities, Premium subscription rules, refunds, and limitations of liability.",
};

const LAST_UPDATED = "May 13, 2026";

function LawyerReviewBanner() {
  return (
    <div className="mb-10 rounded-lg border border-amber-400/35 bg-amber-400/[0.06] p-4 text-sm leading-relaxed text-amber-100/95">
      <strong>Draft — pending legal review.</strong> These terms describe how
      we currently run Step in good faith. They have not been finalised by
      our counsel. If something here is unclear or important, email{" "}
      <a href="mailto:hi@step.careers" className="underline">
        hi@step.careers
      </a>{" "}
      and we&apos;ll clarify.
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

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="mt-2 text-xs text-ink-200/55">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <LawyerReviewBanner />

      <H2>1. Who can use Step</H2>
      <P>
        By creating an account or generating a plan at step.careers, you
        agree to these terms. You must be at least 16 years old. If you use
        Step on behalf of an organisation, you confirm you have authority to
        bind that organisation.
      </P>

      <H2>2. What Step does (and doesn&apos;t do)</H2>
      <P>
        Step generates career recommendations grounded in a curated dataset
        of real career paths. Recommendations are educational and
        informational — not professional career counselling, financial,
        legal, medical, immigration, or tax advice. Your decisions are your
        own. Outcomes vary widely person to person.
      </P>
      <P>
        We use AI models (Anthropic Claude, Voyage embeddings). AI output
        can be wrong, incomplete, or out of date. We label every
        recommendation with a confidence level and ground it in retrieved
        paths, but we cannot guarantee accuracy.
      </P>

      <H2>3. Your account</H2>
      <P>
        You&apos;re responsible for keeping your sign-in method (Google or
        email magic link) secure. Tell us if you suspect unauthorised
        access. We may suspend or close accounts that violate these terms
        or applicable law.
      </P>

      <H2>4. Acceptable use</H2>
      <P>You agree not to:</P>
      <ul>
        <ULItem>
          Scrape, crawl, or extract our dataset, recommendations, or path
          identifiers in bulk.
        </ULItem>
        <ULItem>
          Probe, attack, or attempt to bypass authentication, rate limits,
          or the Turnstile bot check.
        </ULItem>
        <ULItem>
          Submit content that is unlawful, defamatory, infringing, or
          designed to harass others.
        </ULItem>
        <ULItem>
          Resell, sublicense, or commercially redistribute our output
          without written permission.
        </ULItem>
        <ULItem>
          Use Step to make automated decisions that produce legal effects
          on others (hiring, lending, etc.).
        </ULItem>
      </ul>

      <H2>5. Premium subscription</H2>
      <P>
        <strong>Pricing.</strong> We currently sell two Premium plans:
      </P>
      <ul>
        <ULItem>
          <strong>Monthly</strong> — €19 per month, auto-renewing until you
          cancel. Cancellable anytime from /account; access continues until
          the end of the paid period.
        </ULItem>
        <ULItem>
          <strong>Lifetime</strong> — €99 one-time. Access remains as long
          as Step operates. Lifetime does not cover future products we may
          launch as separate offerings.
        </ULItem>
      </ul>
      <P>
        Prices include applicable VAT for EU consumers. Currency may be
        converted by Stripe based on your card&apos;s country.
      </P>
      <P>
        <strong>Refunds &amp; right of withdrawal.</strong> EU consumers
        have a 14-day right of withdrawal from the date of purchase under
        Directive 2011/83/EU. For digital services that begin immediately
        with your consent, this right ends once delivery starts — when you
        first use a Premium feature after purchase, you acknowledge you
        waive the right of withdrawal for that purchase. Outside of that,
        refunds are at our discretion; email{" "}
        <a href="mailto:hi@step.careers" className="underline">
          hi@step.careers
        </a>
        .
      </P>

      <H2>6. Your content</H2>
      <P>
        You keep ownership of anything you submit (form input, CV text,
        replies to check-in emails). You grant Step a non-exclusive,
        worldwide, royalty-free licence to process that content as needed
        to operate the service for you, improve recommendations in
        aggregated/anonymised form, and respond to legal obligations.
      </P>

      <H2>7. Our content</H2>
      <P>
        The Step interface, the curated dataset of career paths, the
        recommendation methodology, and the brand are owned by us or
        licensed to us. You may share your generated plan and screenshots,
        and you may use Step output for your own career planning. You may
        not republish substantial portions of our dataset.
      </P>

      <H2>8. Service availability</H2>
      <P>
        Step is provided &ldquo;as is&rdquo;. We aim for high availability
        but don&apos;t guarantee uptime. We may change, suspend, or end
        features with reasonable notice for non-trivial changes affecting
        paying users.
      </P>

      <H2>9. Limitation of liability</H2>
      <P>
        To the maximum extent permitted by law, Step is not liable for
        indirect, incidental, special, or consequential damages, including
        lost income, lost opportunities, or career-decision outcomes. Our
        total liability for any claim is capped at the greater of (a) the
        amount you paid us in the 12 months preceding the claim or (b) €50.
        Nothing in these terms limits liability for gross negligence,
        wilful misconduct, or any other liability that cannot be limited
        under applicable law.
      </P>

      <H2>10. Termination</H2>
      <P>
        You can stop using Step and delete your account anytime from{" "}
        <Link href="/account" className="underline decoration-ink-200/30 underline-offset-4 hover:decoration-ink-200/60">
          /account
        </Link>
        . We may terminate or suspend access for material breach of these
        terms or applicable law. On termination, sections that by their
        nature should survive (IP, liability, governing law) remain in
        effect.
      </P>

      <H2>11. Changes</H2>
      <P>
        We may revise these terms. Material changes (pricing, refunds,
        liability) will be emailed to registered users at least 14 days
        before they take effect for them. Continued use after that
        constitutes acceptance.
      </P>

      <H2>12. Governing law &amp; disputes</H2>
      <P>
        These terms are governed by the laws of Italy. Disputes will be
        handled by the courts of Milan, Italy — except where mandatory
        consumer protection law gives you the right to litigate in your
        country of residence, in which case that right applies.
      </P>
      <P>
        EU consumers can use the European Commission&apos;s online dispute
        resolution platform:{" "}
        <a
          href="https://ec.europa.eu/consumers/odr"
          className="underline decoration-ink-200/30 underline-offset-4 hover:decoration-ink-200/60"
        >
          ec.europa.eu/consumers/odr
        </a>
        .
      </P>

      <H2>13. Contact</H2>
      <P>
        Questions about these terms:{" "}
        <a href="mailto:hi@step.careers" className="underline">
          hi@step.careers
        </a>
        .
      </P>
    </main>
  );
}
