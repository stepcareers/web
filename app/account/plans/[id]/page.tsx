/**
 * /account/plans/[id] — read-only viewer for a saved plan.
 *
 * Renders the same conceptual layout as the /beta result view but as a
 * standalone, refresh-friendly page tied to the persisted record. We
 * keep the markup self-contained here (rather than reusing /beta's
 * ResultView, which is deeply coupled to live form state) so this page
 * stays simple and fast.
 *
 * Auth: signed-in users only. Plan IDs are scoped to the user — a
 * stranger's id returns 404 even if it's valid.
 */
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { RecommendResultSchema } from "@/lib/ai/types";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PlanDeleteButton } from "./PlanDeleteButton";

export const metadata = {
  title: "Plan",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type PageProps = { params: Promise<{ id: string }> };

export default async function PlanViewerPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }
  const { id } = await params;

  const plan = await prisma.plan.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    select: {
      id: true,
      title: true,
      recommendations: true,
      createdAt: true,
    },
  });
  if (!plan) notFound();

  // Validate the stored JSON against the live schema. If the shape has
  // drifted (e.g. an old plan saved before a schema change), fall back
  // to "best-effort" rendering: show whatever fields are present and
  // skip the rest. We never throw — the user shouldn't see a 500 on
  // their own saved plan.
  const parsed = RecommendResultSchema.safeParse(plan.recommendations);
  const data = parsed.success ? parsed.data : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10 md:py-14">
      <header className="mb-8">
        <Link
          href="/account"
          className="text-sm text-ink-200/60 transition hover:text-ink-200/90"
        >
          ← Back to account
        </Link>
        <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-tight text-ink-50 md:text-3xl">
          {plan.title}
        </h1>
        <p className="mt-1 text-xs text-ink-200/55">
          Saved {formatDate(plan.createdAt)}
        </p>
      </header>

      {!data ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.04] p-5">
          <p className="text-sm text-amber-200/90">
            This plan was generated with an older format and can&apos;t be
            re-rendered cleanly. You can still download a full copy from
            the Privacy &amp; data section on your account page.
          </p>
        </div>
      ) : (
        <article className="flex flex-col gap-8">
          {/* Honest take — peer voice, prominent block */}
          <section className="rounded-2xl border border-amber-400/25 bg-gradient-to-b from-amber-400/[0.05] via-amber-400/[0.02] to-transparent p-5 md:p-7">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300/80">
              Honest take
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-200/90 md:text-base">
              {data.honestTake}
            </p>
          </section>

          {/* Recommendations list */}
          <section className="flex flex-col gap-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-200/55">
              Recommendations
            </h2>
            {data.recommendations.map((rec, idx) => {
              const isFoundation = rec.leverage === "foundation";
              return (
                <div
                  key={`${idx}-${rec.title}`}
                  className={
                    isFoundation
                      ? "rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-400/[0.06] via-amber-400/[0.02] to-transparent p-5 md:p-7"
                      : "rounded-2xl border border-ink-200/15 bg-ink-200/[0.02] p-5 md:p-7"
                  }
                >
                  <div className="flex items-baseline gap-3">
                    {isFoundation ? (
                      <span className="inline-flex h-7 items-center rounded-full border border-amber-400/45 bg-amber-400/10 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">
                        Foundation
                      </span>
                    ) : (
                      <span className="inline-flex h-7 items-center rounded-full border border-ink-200/15 bg-ink-200/[0.04] px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-200/65">
                        {rec.leverage}
                      </span>
                    )}
                    <span className="text-xs tabular-nums text-ink-200/45">
                      #{idx + 1}
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-semibold leading-snug text-ink-50/95 md:text-xl">
                    {rec.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-200/80">
                    {rec.rationale}
                  </p>

                  <h4 className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-200/55">
                    90-day actions
                  </h4>
                  <ul className="mt-2 flex flex-col gap-2">
                    {(Array.isArray(rec.ninetyDayActions)
                      ? rec.ninetyDayActions
                      : []
                    ).map((a, i) => (
                      <li
                        key={i}
                        className="flex gap-3 text-sm leading-relaxed text-ink-200/85"
                      >
                        <span
                          className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-400/35 bg-amber-400/5 text-[10px] font-semibold text-amber-300/90"
                          aria-hidden
                        >
                          {i + 1}
                        </span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 grid gap-3 rounded-lg border border-ink-200/10 bg-ink-200/[0.02] p-3 text-xs leading-relaxed text-ink-200/70 md:grid-cols-2 md:gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-200/45">
                        12-month outcome
                      </p>
                      <p className="mt-1 text-ink-200/85">
                        {rec.twelveMonthOutcome}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-200/45">
                        Pattern evidence
                      </p>
                      <p className="mt-1 text-ink-200/85">{rec.pathEvidence}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] text-ink-200/55">
                    Confidence:{" "}
                    <span className="text-ink-200/80">
                      {rec.confidence?.level ?? "low"}
                    </span>{" "}
                    — {rec.confidence?.reason ?? ""}
                  </p>
                </div>
              );
            })}
          </section>

          {/* What we don't know — calmer footer block */}
          <section className="rounded-lg border border-ink-200/15 bg-ink-200/[0.02] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-200/55">
              What we don&apos;t know
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-200/80">
              {data.whatWeDontKnow}
            </p>
          </section>
        </article>
      )}

      {/* Danger zone */}
      <section className="mt-12 rounded-lg border border-ink-200/10 bg-ink-200/[0.015] p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-200/45">
          Plan controls
        </h2>
        <p className="mt-2 text-xs text-ink-200/55">
          Deleting a plan removes it from your account list. The underlying
          record is kept (soft-deleted) so GDPR exports still include it.
        </p>
        <div className="mt-3">
          <PlanDeleteButton planId={plan.id} />
        </div>
      </section>
    </main>
  );
}
