"use client";

import posthog from "posthog-js";
import { PostHogProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * PostHog client-side init + page-view tracker for the App Router.
 *
 * Why PostHog over Vercel Analytics: the Hobby tier of Vercel Analytics
 * has no custom events, which kills our funnel tracking. PostHog free
 * gives 1M events/mo + funnels + retention + session replay.
 *
 * Env vars required (Vercel project settings + .env.local):
 *   NEXT_PUBLIC_POSTHOG_KEY   — project API key (starts with phc_)
 *   NEXT_PUBLIC_POSTHOG_HOST  — usually https://eu.i.posthog.com (EU)
 *                                or https://us.i.posthog.com (US)
 *
 * If the key is missing we silently no-op so dev environments without
 * PostHog don't blow up.
 */

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    // We don't have authenticated users yet; identify only when we do.
    person_profiles: "identified_only",
    // We track page views manually below for App Router SPA navigation.
    capture_pageview: false,
    // Don't capture sessions on localhost during dev.
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.opt_out_capturing();
    },
  });
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!pathname || !ph) return;
    let url = window.location.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    ph.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PostHogProvider>
  );
}
