import type { Metadata } from "next";
import SearchExperience from "../components/search-experience";

export const metadata: Metadata = { title: "Find car parts", description: "Find car parts by part number, picture or vehicle details.", alternates: { canonical: "/parts" } };
export default function Page() { return <SearchExperience key="parts" initialMode="parts" initialVehicleType="cars" />; }
