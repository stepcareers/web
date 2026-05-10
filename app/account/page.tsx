/**
 * Account page — placeholder for sub-block 2 (plan persistence + history).
 *
 * For now this just confirms the user is signed in and offers a logout
 * button. The "My plans" list lands in the next sub-block.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export const metadata = {
  title: "Account — Step",
};

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const u = session.user;

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
          <h2 className="text-base font-semibold uppercase tracking-wider text-ink-200/70">
            Your plans
          </h2>
          <p className="mt-3 text-sm text-ink-200/75">
            Plan history is coming next. For now, head back to the beta
            and any new plan you generate while signed in will be saved
            to your account automatically.
          </p>
          <Link
            href="/beta"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink-50 px-5 py-2.5 text-sm font-medium text-ink-950 transition hover:opacity-90"
          >
            Go to the planner →
          </Link>
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
