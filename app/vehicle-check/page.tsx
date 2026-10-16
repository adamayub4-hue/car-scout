import type { Metadata } from "next";
import Link from "next/link";
import VehicleCheck from "../components/vehicle-check";
import SiteHeader from "../components/site-header";

export const metadata: Metadata = {
  title: "Check vehicle tax and MOT",
  description: "Check a UK vehicle’s tax and MOT status by registration, with due dates where available.",
  alternates: { canonical: "/vehicle-check" },
};

export default function VehicleCheckPage() {
  return <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:py-10">
    <div className="mx-auto max-w-3xl">
      <SiteHeader />
      <div className="py-7 sm:py-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-link">Vehicle check</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Check tax and MOT</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted">A quick registration check with tax and MOT due dates where available. Vehicle data comes from DVLA, with model details from DVSA when available.</p>
      </div>
      <VehicleCheck />
      <nav aria-label="More vehicle help" className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <Link href="/guides/checking-mot-history" className="rounded-2xl border border-outline/15 bg-panel p-5 font-semibold text-link">How to read a vehicle’s MOT history →</Link>
        <Link href="/parts" className="rounded-2xl border border-outline/15 bg-panel p-5 font-semibold text-link">Find parts for your vehicle →</Link>
      </nav>
    </div>
  </main>;
}
