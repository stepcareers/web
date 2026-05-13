/**
 * Dynamic Open Graph image — auto-rendered at /opengraph-image.png.
 *
 * Used by every page that doesn't override it (most do). Pre-1.x style
 * platforms (Slack, LinkedIn, Twitter, iMessage, Facebook) all read
 * og:image and twitter:image; we serve the same asset for both via
 * Next's automatic metadata wiring.
 *
 * Generated at request time via Vercel's edge runtime — no static file
 * to update when copy changes.
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";

// Twitter's preferred card-large size; also the LinkedIn / Slack default.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "Step — Find your next career step. Backed by 10,500+ real career paths.";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "64px 72px",
          background:
            "linear-gradient(160deg, #0b0b0c 0%, #111114 55%, #1a1410 100%)",
          color: "#f5f5f4",
          fontFamily: "system-ui",
        }}
      >
        {/* Header — wordmark + beta pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "#e7e5e4",
            }}
          >
            step.careers
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 18px",
              border: "1px solid rgba(245, 158, 11, 0.45)",
              borderRadius: 999,
              fontSize: 18,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "#fbbf24",
              background: "rgba(245, 158, 11, 0.06)",
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: "#10b981",
              }}
            />
            Beta · live
          </div>
        </div>

        {/* Headline + subtitle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
              color: "#fafaf9",
            }}
          >
            Find your next career step.
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "rgba(231, 229, 228, 0.55)",
            }}
          >
            Backed by real patterns.
          </div>
        </div>

        {/* Bottom strip — proof point */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            paddingTop: 28,
            borderTop: "1px solid rgba(231, 229, 228, 0.12)",
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: "rgba(231, 229, 228, 0.78)",
              maxWidth: 720,
              lineHeight: 1.35,
            }}
          >
            10,500+ curated career paths · 76 countries · 3–5 ranked moves in
            90 seconds.
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "16px 26px",
              borderRadius: 999,
              background: "#fbbf24",
              color: "#0b0b0c",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            Try the beta →
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
