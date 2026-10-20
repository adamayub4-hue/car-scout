import type { Metadata } from "next";
import SearchExperience from "../components/search-experience";

export const metadata: Metadata = {
  title: "Search UK motorbikes",
  description: "Browse UK eBay motorbike listings with your make, model and budget.",
  alternates: { canonical: "/motorbikes" },
  twitter: { card: "summary_large_image", title: "Search UK motorbikes | Mekivo", description: "Browse UK eBay motorbike listings with your make, model and budget." },
  openGraph: {
    title: "Search UK motorbikes | Mekivo",
    description: "Browse UK eBay motorbike listings with your make, model and budget.",
    url: "https://mekivo.uk/motorbikes",
    type: "website",
    siteName: "Mekivo",
    locale: "en_GB",
  },
};
export default function Page() { return <SearchExperience key="motorbikes" initialMode="cars" initialVehicleType="motorbikes" />; }
