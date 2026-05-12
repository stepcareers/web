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

function formatPlanDate(d: Date): string {
  // "May 12, 2026" — short and unambiguous across EN/IT readers.
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  const u = session.user;

  const plans = await prisma.plan.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, createdAt: true },
  });

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
