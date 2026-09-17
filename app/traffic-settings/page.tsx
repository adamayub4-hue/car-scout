import type { Metadata } from "next";
import Link from "next/link";
import TrafficExclusionControl from "../components/traffic-exclusion-control";

export const metadata: Metadata = { title: "Visitor report settings", robots: { index: false, follow: false } };

export default function TrafficSettingsPage() {
  return <main className="min-h-screen bg-background px-4 py-12 text-foreground"><div className="mx-auto max-w-xl">
    <h1 className="text-3xl font-bold">Keep your testing out of the results</h1>
    <p className="mt-4 leading-7 text-muted">Use this before checking Mekivo so your own activity does not look like a customer visit. Signed-in owner visits are excluded automatically. This settings page is never counted.</p>
    <TrafficExclusionControl />
    <p className="mt-5 text-sm leading-6 text-muted">This affects future website analytics and optional search activity only. Earlier totals stay unchanged. Saving items and sending support messages still work normally.</p>
    <Link href="/" className="mt-6 inline-block font-semibold text-link">Return to Mekivo →</Link>
  </div></main>;
}
