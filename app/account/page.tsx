/**
 * Account page — profile + plan history + privacy controls.
 *
 * Server component: pulls the auth session and the user's plan list in
 * one render pass. Plans are loaded with a direct Prisma call rather
 * than going through /api/me/plans because we're already on the server.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { getPremiumStatus } from "@/lib/premium";
import { AccountActions } from "./AccountActions";

export const metadata = {
  title: "Account",
  // Auth-gated page; never indexed.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

async function toggleCheckinsAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) return;
  // Trust nothing client-side: read the current state and flip it.
  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { checkinsUnsubscribedAt: true },
  });
  const newValue = current?.checkinsUnsubscribedAt ? null : new Date();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { checkinsUnsubscribedAt: newValue },
  });
  // formData unused — kept on the signature so React's form action types resolve.
  void formData;
}

function formatPlanDate(d: Date): string {
  // "May 12, 2026" — short and unambiguous across EN/IT readers.
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type PageProps = {
  // Next 15 makes searchParams a Promise — opt into the server-side
  // streaming model.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  const sp = await searchParams;
  const checkoutState =
    sp.checkout === "success"
      ? "success"
      : sp.checkout === "cancelled"
        ? "cancelled"
        : null;

  const u = session.user;

  const [plans, premium, userPrefs] = await Promise.all([
    prisma.plan.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true },
    }),
    getPremiumStatus(session.user.id),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { checkinsUnsubscribedAt: true },
    }),
  ]);
  const checkinsUnsubscribed = !!userPrefs?.checkinsUnsubscribedAt;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10 md:py-14">
      <header className="mb-10 flex items-center justify-between">
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
            You&apos;re in.
          </h1>
          <p className="mt-3 text-base text-ink-200/90 dark:text-ink-200/70">
            Signed in as{" "}
            <span className="font-medium text-ink-200/95">{u.email}</span>.
          </p>
        </div>

        {/* Checkout return banners — Stripe redirects back here with a
            ?checkout=success|cancelled flag. Premium activation itself
            happens on the webhook, which can race the redirect; we tell
            the user it might take a moment so they don't refresh in a
            loop. */}
        {checkoutState === "success" ? (
          <div className="rounded-lg border border-emerald-400/40 bg-emerald-400/[0.06] p-4">
            <p className="text-sm font-medium text-emerald-200/95">
              Payment received — thank you!
            </p>
            <p className="mt-1 text-xs text-emerald-200/75">
              Premium usually activates within a few seconds. Refresh this
              page if you don&apos;t see the Premium badge yet.
            </p>
          </div>
        ) : null}
        {checkoutState === "cancelled" ? (
          <div className="rounded-lg border border-ink-200/15 bg-ink-200/[0.03] p-4">
            <p className="text-sm text-ink-200/85">
              Checkout cancelled — no charge was made. You can come back
              anytime from the planner.
            </p>
          </div>
        ) : null}

        {/* Premium status — only shown when active. Free users keep the
            real-estate clean and see the upsell on /beta instead. */}
        {premium.active ? (
          <div className="rounded-lg border border-amber-400/30 bg-gradient-to-b from-amber-400/[0.06] via-amber-400/[0.02] to-transparent p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold uppercase tracking-wider text-amber-300/85">
                Premium
              </h2>
              <span className="text-xs font-medium uppercase tracking-wider text-amber-300/80">
                {premium.lifetime ? "Lifetime" : "Active"}
              </span>
            </div>
            <p className="mt-3 text-sm text-ink-200/85">
              {premium.lifetime
                ? "You have lifetime access. Decision tree, scenario expansion, and all upcoming Premium features are unlocked."
                : premium.until
                  ? `Active until ${formatPlanDate(premium.until)}. Renews automatically.`
                  : "Active."}
            </p>
          </div>
        ) : null}

        <div className="rounded-lg border border-ink-200/20 bg-ink-200/[0.02] p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold uppercase tracking-wider text-ink-200/70">
              Your plans
            </h2>
            <span className="text-xs tabular-nums text-ink-200/50">
              {plans.length} saved
            </span>
          </div>

          {plans.length === 0 ? (
            <>
              <p className="mt-3 text-sm text-ink-200/75">
                No plans saved yet. Head back to the planner — any plan you
                generate while signed in will be saved here automatically.
              </p>
              <Link
                href="/beta"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink-50 px-5 py-2.5 text-sm font-medium text-ink-950 transition hover:opacity-90"
              >
                Go to the planner →
              </Link>
            </>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-ink-200/10">
              {plans.map((p) => (
                <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/account/plans/${p.id}`}
                    className="group flex items-center justify-between gap-3 rounded-md p-2 transition hover:bg-ink-200/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-50/95">
                        {p.title}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-200/55">
                        {formatPlanDate(p.createdAt)}
                      </p>
                    </div>
                    <span
                      aria-hidden
                      className="shrink-0 text-amber-400/85 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Email preferences — only shown to Premium users since check-ins
            are Premium-gated. Free users see nothing, no clutter. */}
        {premium.active ? (
          <div className="rounded-lg border border-ink-200/20 bg-ink-200/[0.02] p-5">
            <h2 className="text-base font-semibold uppercase tracking-wider text-ink-200/70">
              Email preferences
            </h2>
            <p className="mt-3 text-sm text-ink-200/75">
              {checkinsUnsubscribed
                ? "You're unsubscribed from the Premium check-in cadence (1, 3, 7, 14, 30, 60, 90, 180, and 365 days after each plan). Re-enable them anytime."
                : "Premium check-ins are on: short prompts at days 1, 3, 7, 14, 30, 60, 90, 180, and 365 after each plan, asking what you actually did. Reply rates are how we learn what's working."}
            </p>
            <form action={toggleCheckinsAction} className="mt-4">
              <button
                type="submit"
                className={
                  checkinsUnsubscribed
                    ? "inline-flex items-center gap-2 rounded-md border border-amber-400/40 bg-amber-400/[0.06] px-4 py-2 text-sm font-medium text-amber-200/95 transition hover:bg-amber-400/[0.12]"
                    : "inline-flex items-center gap-2 rounded-md border border-ink-200/25 px-4 py-2 text-sm text-ink-200/85 transition hover:border-ink-200/50 hover:bg-ink-200/[0.04]"
                }
              >
                {checkinsUnsubscribed
                  ? "Re-subscribe to check-ins"
                  : "Unsubscribe from check-ins"}
              </button>
            </form>
            <p className="mt-3 text-xs text-ink-200/55">
              Transactional emails (receipts, sign-in links) aren&apos;t affected
              either way.
            </p>
          </div>
        ) : null}

        {/* GDPR / privacy controls — right of access + right to erasure. */}
        <div className="rounded-lg border border-ink-200/20 bg-ink-200/[0.02] p-5">
          <h2 className="text-base font-semibold uppercase tracking-wider text-ink-200/70">
            Privacy &amp; data
          </h2>
          <p className="mt-3 text-sm text-ink-200/75">
            Under GDPR you can download a copy of everything we hold about you,
            or permanently delete your account and all linked data at any time.
          </p>
          <AccountActions />
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="self-start rounded-md border border-ink-200/30 px-4 py-2 text-sm transition hover:border-ink-200/60"
          >
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
