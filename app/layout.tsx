import type { Metadata } from "next";
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
    <html lang="en" className="h-full">
      <body className="min-h-full bg-ink-50 text-ink-950 antialiased dark:bg-ink-950 dark:text-ink-50">
        {children}
      </body>
    </html>
  );
}
