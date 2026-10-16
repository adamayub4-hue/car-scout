import type { Metadata } from "next";
import SearchExperience from "../components/search-experience";

export const metadata: Metadata = { title: "Search UK used cars", description: "Find UK used cars within your budget and compare original marketplace listings.", alternates: { canonical: "/cars" } };
export default function Page() { return <SearchExperience key="cars" initialMode="cars" initialVehicleType="cars" />; }
