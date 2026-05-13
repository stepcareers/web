/**
 * Apple touch icon — auto-served at /apple-icon.png.
 *
 * iOS uses this specifically for "Add to Home Screen". Same composition
 * as the generic icon but at Apple's required 180x180 + flatter
 * background (iOS auto-applies its own rounded mask).
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b0c",
          fontFamily: "system-ui",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 130,
            height: 130,
            borderRadius: 34,
            background:
              "linear-gradient(135deg, #fbbf24 0%, #f59e0b 70%, #d97706 100%)",
            color: "#0b0b0c",
            fontSize: 108,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          S
        </div>
      </div>
    ),
    { ...size },
  );
}
