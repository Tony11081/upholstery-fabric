import type { Metadata } from "next";
import { Suspense } from "react";
import { MessageCircle } from "lucide-react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AnalyticsScripts } from "@/components/analytics/analytics-scripts";
import { AnalyticsTracker } from "@/components/analytics/analytics-tracker";
import { Toaster } from "@/components/ui/toaster";
import { ReferralTracker } from "@/components/referral/referral-tracker";
import { PromoBar } from "@/components/promo/promo-bar";
import { BRAND_NAME, DEFAULT_OG_IMAGE, absoluteUrl, getSiteUrl } from "@/lib/utils/site";
import "./globals.css";
import { Providers } from "./providers";

const siteUrl = getSiteUrl();
const defaultTitle = `${BRAND_NAME} | Luxury Fabrics & Designer Textile Archive`;
const defaultDescription =
  "Source luxury maison fabrics, archive textiles, and premium upholstery yardage with swatch support and global delivery.";
const defaultKeywords = [
  "luxury fabric",
  "designer fabric",
  "maison textile",
  "boucle tweed",
  "silk jacquard",
  "upholstery fabric",
];

const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}#organization`,
      name: BRAND_NAME,
      url: siteUrl,
      logo: absoluteUrl(DEFAULT_OG_IMAGE),
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer support",
          availableLanguage: ["en", "pt-BR", "es-ES"],
          url: "https://wa.me/8613462248923",
        },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}#website`,
      url: siteUrl,
      name: BRAND_NAME,
      publisher: {
        "@id": `${siteUrl}#organization`,
      },
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: `%s | ${BRAND_NAME}`,
  },
  description: defaultDescription,
  keywords: defaultKeywords,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [{ url: DEFAULT_OG_IMAGE, type: "image/svg+xml" }],
    apple: [{ url: DEFAULT_OG_IMAGE, type: "image/svg+xml" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    url: siteUrl,
    title: defaultTitle,
    description: defaultDescription,
    siteName: BRAND_NAME,
    locale: "en_US",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${BRAND_NAME} luxury fabric archive`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-background text-ink antialiased">
        <Providers>
          <Suspense fallback={null}>
            <AnalyticsTracker />
            <ReferralTracker />
          </Suspense>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
          />
          <div className="min-h-screen bg-background text-ink">
            <PromoBar />
            <div className="pb-20 md:pb-0">{children}</div>
            <BottomNav />
          </div>
          <a
            href="https://wa.me/8613462248923"
            target="_blank"
            rel="noreferrer"
            className="fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-3 text-sm font-medium text-ink shadow-[var(--shadow-float)] transition hover:border-ink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink md:bottom-6 md:right-6"
            aria-label="Chat with our concierge on WhatsApp"
          >
            <MessageCircle size={16} />
            <span>Concierge</span>
          </a>
          <Toaster />
        </Providers>
        <AnalyticsScripts />
      </body>
    </html>
  );
}
