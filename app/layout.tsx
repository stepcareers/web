import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Step — Find your next career step",
    template: "%s · Step",
  },
  description:
    "What should you do next in your career? Step gives you 3–5 ranked next moves backed by real career patterns. Two minutes, no commitment.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://step.careers",
  ),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark h-full">
      <body className="min-h-full bg-ink-950 text-ink-50 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
