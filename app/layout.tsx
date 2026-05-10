import type { Metadata } from "next";
import Script from "next/script";
import { Providers } from "./providers";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://step.careers";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Step — Find your next career step",
    template: "%s · Step",
  },
  description:
    "AI career advice grounded in real patterns. Step gives you 3–5 ranked next moves with concrete 90-day actions, a 12-month outcome, and a bridge to your 5-year vision. 2 minutes, no signup.",
  keywords: [
    "career advice",
    "next career step",
    "career planning",
    "career change",
    "career guidance",
    "AI career coach",
    "job search strategy",
    "professional development",
  ],
  authors: [{ name: "Step" }],
  applicationName: "Step",
  openGraph: {
    type: "website",
    siteName: "Step",
    title: "Step — Find your next career step",
    description:
      "AI career advice grounded in real patterns. 3–5 ranked moves, concrete 90-day actions, honest take. 2 minutes, no signup.",
    url: siteUrl,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Step — Find your next career step",
    description:
      "AI career advice grounded in real patterns. 3–5 ranked moves, concrete 90-day actions, honest take.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // GA4 Measurement ID (G-XXXXXXXXXX). When unset (e.g. local dev) the
  // script tags are skipped entirely so we don't ping Google with a
  // bad ID and don't leak any client identity to GA in dev.
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en" className="dark h-full">
      <body className="min-h-full bg-ink-950 text-ink-50 antialiased">
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}', {
                  send_page_view: true,
                  anonymize_ip: true,
                });
              `}
            </Script>
          </>
        )}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
