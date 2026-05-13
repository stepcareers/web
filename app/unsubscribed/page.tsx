/**
 * /unsubscribed — landing page after an unsubscribe click.
 *
 * Three states keyed off `?status=`:
 *   ok           — token verified, flag flipped
 *   invalid      — signature mismatch or malformed token
 *   missing-token— link rewritten somewhere along the way
 *
 * Plus an "always ok" message so the user is never made to feel they
 * just broke something. Email unsubscribe should feel frictionless.
 */
import Link from "next/link";

export const metadata = {
  title: "Unsubscribed · Step",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function UnsubscribedPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = sp.status ?? "ok";

  const isOk = status === "ok";
  const title = isOk ? "You're unsubscribed." : "Couldn't process that link.";
  const message = isOk
    ? "You won't receive any more Premium check-in emails. Transactional emails — receipts, sign-in links — are unaffected."
    : "The link looks invalid or expired. You can still manage email preferences from your account page.";

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
