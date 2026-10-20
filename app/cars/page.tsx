import type { Metadata } from "next";
import SearchExperience from "../components/search-experience";

export const metadata: Metadata = {
  title: "Search UK used cars",
  description: "Find UK used cars within your budget and compare original marketplace listings.",
  alternates: { canonical: "/cars" },
  twitter: { card: "summary_large_image", title: "Search UK used cars | Mekivo", description: "Find UK used cars within your budget and compare original marketplace listings." },
  openGraph: {
    title: "Search UK used cars | Mekivo",
    description: "Find UK used cars within your budget and compare original marketplace listings.",
    url: "https://mekivo.uk/cars",
    type: "website",
    siteName: "Mekivo",
    locale: "en_GB",
  },
};
export default function Page() { return <SearchExperience key="cars" initialMode="cars" initialVehicleType="cars" />; }
