import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CarScout — Search UK cars and parts",
    template: "%s | CarScout",
  },
  description:
    "Search UK car marketplaces and find vehicle-specific parts from one simple starting point.",
  openGraph: {
    title: "CarScout — Search UK cars and parts",
    description:
      "Search UK car marketplaces and find vehicle-specific parts from one simple starting point.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
