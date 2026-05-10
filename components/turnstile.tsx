"use client";

/**
 * Cloudflare Turnstile widget — client side.
 *
 * Renders a (usually invisible) bot-check that calls onToken with a
 * fresh token when verification passes. The token is single-use and
 * expires in ~5 min, so call refresh() before re-submitting after a
 * server-side rejection.
 *
 * No new npm dependency — we load the official Cloudflare script tag
 * once, then explicit-render the widget into our div.
 *
 * If NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset (e.g. dev), the widget
 * silently no-ops and onToken is never called — the form should
 * accept "no token" in that case (the server side does the same).
 */
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
} from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible" | "invisible";
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("ssr"));
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="${SCRIPT_URL.split("?")[0]}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("script_error")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.defer = true;
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("script_error")));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

export interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onError?: () => void;
  onExpired?: () => void;
  className?: string;
}

export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(function TurnstileWidget(
  { onToken, onError, onExpired, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const id = useId();
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Expose a reset() to the parent so it can request a fresh token after
  // each successful POST — Turnstile tokens are single-use, so after the
  // server consumes one, the widget's old token is dead. The parent should
  // call reset() right after a successful submit so a new challenge is
  // already in flight by the time the user refines or retries.
  useImperativeHandle(
    ref,
    () => ({
      reset() {
        if (typeof window === "undefined") return;
        if (!window.turnstile || !widgetIdRef.current) return;
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch (err) {
          console.warn("[turnstile] reset failed:", err);
        }
      },
    }),
    [],
  );

  useEffect(() => {
    // No site key in env → silently skip. The server-side verifier is
    // also a no-op when its secret is unset, so dev still works.
    if (!sitekey || !containerRef.current) return;

    let cancelled = false;
    let renderedId: string | null = null;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        renderedId = window.turnstile.render(containerRef.current, {
          sitekey,
          callback: (token) => onToken(token),
          "error-callback": () => onError?.(),
          "expired-callback": () => onExpired?.(),
          theme: "dark",
          // "flexible" auto-renders compact and visible; managed mode
          // shows the checkbox + label only when needed.
          size: "flexible",
        });
        widgetIdRef.current = renderedId;
      })
      .catch((err) => {
        console.warn("[turnstile] failed to load script:", err);
        onError?.();
      });

    return () => {
      cancelled = true;
      if (window.turnstile && renderedId) {
        try {
          window.turnstile.remove(renderedId);
        } catch {
          /* ignore */
        }
      }
      widgetIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitekey]);

  if (!sitekey) return null;
  return <div ref={containerRef} id={`turnstile-${id}`} className={className} />;
});
