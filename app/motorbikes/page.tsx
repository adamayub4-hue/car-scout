import type { Metadata } from "next";
import SearchExperience from "../components/search-experience";

export const metadata: Metadata = { title: "Search UK motorbikes", description: "Browse UK eBay motorbike listings with your make, model and budget.", alternates: { canonical: "/motorbikes" } };
export default function Page() { return <SearchExperience key="motorbikes" initialMode="cars" initialVehicleType="motorbikes" />; }
