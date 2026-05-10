/**
 * Login page — Google OAuth + email magic link.
 *
 * Both flows are server actions (`signIn` from auth.ts) so we don't
 * need any client-side auth library calls. The Google button kicks off
 * a redirect to Google's consent screen; the email form posts to a
 * server action that triggers Resend.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export const metadata = {
  title: "Sign in",
  // Auth pages have no SEO value and should never appear in search.
  robots: { index: false, follow: false },
};

async function googleAction() {
  "use server";
  await signIn("google", { redirectTo: "/account" });
}

async function emailAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;
  await signIn("resend", { email, redirectTo: "/account" });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/account");
  }

  const params = await searchParams;
  const error = params.error;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10 md:py-14">
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

      <section className="flex flex-col gap-7">
        <div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            Sign in
          </h1>
          <p className="mt-3 text-base text-ink-200/90 dark:text-ink-200/70">
            Save your plans, come back later, and get the 90-day
            check-ins. We use email only — no password, no spam.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/[0.06] px-4 py-3 text-sm text-red-200/90">
            {humanizeAuthError(error)}
          </div>
        )}

        {/* Google */}
        <form action={googleAction}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-full border border-ink-200/40 bg-white px-6 py-3 text-base font-medium text-ink-950 transition hover:opacity-90"
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-ink-200/45">
          <hr className="flex-1 border-ink-200/15" />
          <span>or</span>
          <hr className="flex-1 border-ink-200/15" />
        </div>

        {/* Email magic link */}
        <form action={emailAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Email magic link</span>
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="form-input"
              autoComplete="email"
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-ink-50 px-6 py-3 text-base font-medium text-ink-950 transition hover:opacity-90"
          >
            Send me a magic link →
          </button>
          <span className="text-xs text-ink-200/55">
            We&apos;ll email you a link. Click it from your inbox to sign
            in. The link expires in 24h.
          </span>
        </form>

        <p className="text-xs leading-relaxed text-ink-200/50">
          By signing in you agree to keep your plan and check-in
          preferences on our infrastructure. We don&apos;t share or sell
          your data.
        </p>
      </section>
    </main>
  );
}

function humanizeAuthError(code: string): string {
  switch (code) {
    case "OAuthAccountNotLinked":
      return "An account with this email already exists with a different sign-in method. Try the other option.";
    case "EmailSignin":
      return "Couldn't send the magic link. Double-check the email address and try again.";
    case "Verification":
      return "This link has expired or was already used. Request a new one.";
    case "AccessDenied":
      return "Sign-in was cancelled.";
    default:
      return "Sign-in failed. Try again, or use a different method.";
  }
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
