/**
 * /checkin-noted — landing after a 1-click check-in reply.
 *
 * Three states:
 *   ?ok=1            — answer recorded, show thank-you
 *   ?err=<reason>    — something went wrong, soft message
 *   no params        — defensive fallback
 *
 * Tone matches the email voice: brief, no fanfare, drop the user back
 * into their plan or home in one click.
 */
import Link from "next/link";

export const metadata = {
  title: "Noted · Step",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckinNotedPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const ok = sp.ok === "1";

  const title = ok ? "Noted — thanks." : "We couldn't record that.";
  const message = ok
    ? "Your answer is logged. We use these signals to make future plans sharper for people in your spot."
    : "The link looks invalid or expired. Open the check-in email again, or head straight to your account.";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-base text-ink-200/80">{message}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/account"
          className="inline-flex items-center gap-2 rounded-full bg-ink-50 px-5 py-2.5 text-sm font-medium text-ink-950 transition hover:opacity-90"
        >
          Go to account
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-ink-200/25 px-5 py-2.5 text-sm text-ink-200/85 transition hover:border-ink-200/45"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
