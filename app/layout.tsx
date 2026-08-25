import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  metadataBase: new URL("https://mekivo.uk"),
  title: {
    default: "Mekivo — Search UK cars and parts",
    template: "%s | Mekivo",
  },
  description:
    "Search UK car marketplaces and narrow down vehicle-parts listings from one simple starting point.",
  keywords: ["UK used cars", "car parts", "vehicle parts finder", "UK car marketplaces", "Auto Trader search", "Facebook Marketplace cars", "eBay Motors", "MOTORS used cars"],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Mekivo — Search UK cars and parts",
    description:
      "Search UK car marketplaces and narrow down vehicle-parts listings from one simple starting point.",
    type: "website",
    url: "https://mekivo.uk",
    siteName: "Mekivo",
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image", title: "Mekivo — Search UK cars and parts", description: "Search UK car marketplaces and narrow down vehicle-parts listings from one simple starting point." },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: "Mekivo", url: "https://mekivo.uk", description: "A UK car and vehicle-parts marketplace search starting point.", inLanguage: "en-GB" }) }} />
        {children}<Analytics /><SpeedInsights />
      </body>
    </html>
  );
}
