"use client";

/**
 * Root-level error boundary.
 *
 * Next.js renders this when a server-component error escapes every other
 * boundary (including app/layout.tsx). It MUST include <html> and <body>
 * because at this point Next has nothing else mounted.
 *
 * We pipe the error to Sentry so we hear about prod crashes instead of
 * finding out from users.
 */
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b0c",
          color: "#e5e5e5",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              marginBottom: "0.75rem",
            }}
          >
            Something broke.
          </h1>
          <p
            style={{
              fontSize: "0.95rem",
              color: "#a3a3a3",
              marginBottom: "1.5rem",
              lineHeight: 1.5,
            }}
          >
            We&apos;ve logged the error and are looking into it. Try reloading
            the page — if it keeps happening, send us a note.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
              global-error.tsx renders outside the Next.js app tree, so the
              router context is gone. A plain anchor forces a full reload,
              which is what we want here — the broken React tree is thrown
              away and replaced by a fresh one. */}
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "0.6rem 1.1rem",
              borderRadius: "0.5rem",
              background: "#fbbf24",
              color: "#0b0b0c",
              fontWeight: 600,
              textDecoration: "none",
              fontSize: "0.9rem",
            }}
          >
            Back to home
          </a>
        </div>
      </body>
    </html>
  );
}
