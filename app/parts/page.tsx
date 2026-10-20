import type { Metadata } from "next";
import SearchExperience from "../components/search-experience";

export const metadata: Metadata = {
  title: "Find car parts",
  description: "Find car parts by part number, picture or vehicle details.",
  alternates: { canonical: "/parts" },
  twitter: { card: "summary_large_image", title: "Find car parts | Mekivo", description: "Find car parts by part number, picture or vehicle details." },
  openGraph: {
    title: "Find car parts | Mekivo",
    description: "Find car parts by part number, picture or vehicle details.",
    url: "https://mekivo.uk/parts",
    type: "website",
    siteName: "Mekivo",
    locale: "en_GB",
  },
};
export default function Page() { return <SearchExperience key="parts" initialMode="parts" initialVehicleType="cars" />; }
