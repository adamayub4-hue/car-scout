import type { Metadata } from "next";
import Link from "next/link";
import VehicleCheck from "../components/vehicle-check";
import SiteHeader from "../components/site-header";

export const metadata: Metadata = {
  title: "Free vehicle tax and MOT check",
  description: "Check a UK vehicle’s tax and MOT status for free by registration, with vehicle details and due dates where available.",
  alternates: { canonical: "/vehicle-check" },
  twitter: { card: "summary_large_image", title: "Free vehicle tax and MOT check | Mekivo", description: "Check a UK vehicle’s tax and MOT status for free by registration, with vehicle details and due dates where available." },
  openGraph: {
    title: "Free vehicle tax and MOT check | Mekivo",
    description: "Check a UK vehicle’s tax and MOT status for free by registration, with vehicle details and due dates where available.",
    url: "https://mekivo.uk/vehicle-check",
    type: "website",
    siteName: "Mekivo",
    locale: "en_GB",
  },
};

export default function VehicleCheckPage() {
  return <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:py-10">
    <div className="mx-auto max-w-3xl">
      <SiteHeader />
      <div className="py-7 sm:py-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-link">Free car check</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Check tax and MOT for free</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted">Enter a registration for vehicle details, tax and MOT status, and available due dates. No account or payment needed.</p>
        <p className="mt-3 text-xs leading-6 text-muted">Vehicle records from DVLA; model details from DVSA when available. Mekivo is an independent service, not endorsed by DVLA or DVSA.</p>
      </div>
      <VehicleCheck />
      <section aria-labelledby="insurance-check-heading" className="mt-6 rounded-3xl border border-outline/15 bg-panel p-5 sm:p-8">
        <h2 id="insurance-check-heading" className="text-xl font-bold">Check your vehicle’s insurance</h2>
        <p className="mt-3 text-sm leading-6 text-muted">MIB’s free Check Your Vehicle service uses the Navigate insurance database. Use it only for a vehicle you own or have permission to drive.</p>
        <a href="https://www.mib.org.uk/check-and-stay-insured/check-your-vehicle/" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-outline/20 px-4 py-3 text-sm font-bold text-link focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">Open MIB’s free insurance check ↗</a>
        <p className="mt-3 text-xs leading-6 text-muted">Opens MIB’s website in a new tab. Insurance results are not displayed inside Mekivo. A policy recorded against a vehicle does not confirm that you are covered to drive it; check your own policy.</p>
      </section>
      <nav aria-label="More vehicle help" className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <Link href="/guides/checking-mot-history" className="rounded-2xl border border-outline/15 bg-panel p-5 font-semibold text-link">How to read a vehicle’s MOT history →</Link>
        <Link href="/parts" className="rounded-2xl border border-outline/15 bg-panel p-5 font-semibold text-link">Find parts for your vehicle →</Link>
      </nav>
    </div>
  </main>;
}
