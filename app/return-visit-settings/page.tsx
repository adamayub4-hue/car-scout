import type { Metadata } from "next";
import Link from "next/link";
import { ReturnVisitPreference } from "../components/return-visit-preference";

export const metadata: Metadata = { title: "Return visit settings", robots: { index: false, follow: false }, alternates: { canonical: "/return-visit-settings" } };

export default function ReturnVisitSettingsPage() {
  return <main className="min-h-screen bg-background px-4 py-12 text-foreground"><div className="mx-auto max-w-3xl">
    <h1 className="text-3xl font-bold">Your return visit choice</h1>
    <p className="mt-4 leading-7 text-muted">You can help Mekivo understand how often visitors come back. This is optional and separate from the existing visitor reports. The choice applies to this browser until you change it or clear browser storage. This settings page is not counted.</p>
    <ReturnVisitPreference settings />
    <p className="mt-4 text-sm leading-6 text-muted">Disabling stops future return counts and removes the timestamp from this browser where storage is available. Visit times 30 days old or more are ignored and replaced on your next allowed visit; browser storage does not expire automatically while Mekivo is closed. Disabling does not remove earlier anonymous totals. Owner and test-browser exclusions always take priority.</p>
    <p className="mt-4 text-sm leading-6 text-muted">Return totals are estimates. Browsers that cannot remember and safely update their visit history are not counted. This does not change the existing visitor reports.</p>
    <Link href="/" className="mt-6 inline-block font-semibold text-link">Return to Mekivo →</Link>
  </div></main>;
}
