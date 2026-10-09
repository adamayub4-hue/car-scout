import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { SiteAnalytics } from "./components/site-analytics";
import { AppearanceRuntime } from "./components/appearance";
import { ReturnVisitPreference } from "./components/return-visit-preference";
import { siteName, siteUrl, siteTitle, siteDescription, siteStructuredData } from "./lib/site-brand";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: siteTitle,
    template: "%s | Mekivo",
  },
  description: siteDescription,
  keywords: ["UK used cars", "car parts", "vehicle parts finder", "UK car marketplaces", "Auto Trader search", "Facebook Marketplace cars", "eBay Motors", "MOTORS used cars"],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: "website",
    url: siteUrl,
    siteName,
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image", title: siteTitle, description: siteDescription },
  icons: {
    icon: [{ url: "/icons/mekivo-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(()=>{let p='system';try{const s=localStorage.getItem('mekivo-appearance');if(s==='light'||s==='dark')p=s}catch{}document.documentElement.dataset.appearance=p;document.documentElement.dataset.theme=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p})()` }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AppearanceRuntime />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteStructuredData).replace(/</g, "\\u003c") }} />
        {children}<Suspense fallback={null}><ReturnVisitPreference /><SiteAnalytics /></Suspense>
      </body>
    </html>
  );
}
