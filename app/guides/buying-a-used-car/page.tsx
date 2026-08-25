import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Buying a used car: UK checklist",
  description: "A plain-English UK used-car checklist covering history, paperwork, condition, test drives and payment.",
  alternates: { canonical: "/guides/buying-a-used-car" },
};

const sections = [
  ["Before viewing", "Compare similar cars so you know the normal price range. Ask for the registration, mileage, service history and reason for sale. Run independent history and MOT checks before travelling."],
  ["Identity and paperwork", "Check that the VIN on the car matches the V5C and other records. The seller's name and address should make sense. A V5C is not proof of ownership, so resolve anything unusual before paying."],
  ["Exterior and tyres", "View the car in daylight and when it is dry. Look for mismatched paint, uneven panel gaps, warning lights, windscreen damage and uneven tyre wear. Tyres should have legal tread and match the stated specification."],
  ["Engine and fluids", "Ask to see the car from cold. Listen for unusual noises, check for smoke and look underneath for leaks. Warning lights should illuminate at startup and then go out normally."],
  ["Test drive", "Test steering, brakes, clutch or automatic transmission, suspension, heating and electronics. The car should track straight, stop cleanly and reach operating temperature without warnings."],
  ["Payment and collection", "Do not be pressured into paying before your checks are complete. Use a traceable payment method, obtain a dated receipt and confirm insurance and vehicle-tax arrangements before driving away."],
] as const;

export default function UsedCarGuide() {
  return <main className="min-h-screen bg-[#07101e] px-4 py-10 text-white"><article className="mx-auto max-w-3xl"><Link href="/guides" className="text-sm font-semibold text-sky-300">← All guides</Link><p className="mt-12 text-xs font-bold uppercase tracking-[0.22em] text-sky-300">Used-car guide</p><h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Buying a used car: a practical UK checklist</h1><p className="mt-5 text-lg leading-8 text-slate-300">A listing is only the start. Work through these checks before committing to a vehicle.</p><div className="mt-10 space-y-8">{sections.map(([title, copy], index) => <section key={title} className="border-t border-white/10 pt-6"><span className="text-xs font-bold text-sky-300">{String(index + 1).padStart(2, "0")}</span><h2 className="mt-2 text-2xl font-bold">{title}</h2><p className="mt-3 leading-7 text-slate-300">{copy}</p></section>)}</div><aside className="mt-10 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5 text-sm leading-6 text-amber-100">If you are unsure, pay an independent qualified mechanic or inspection service. Mekivo does not inspect vehicles or verify marketplace listings.</aside><Link href="/" className="mt-8 inline-flex rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950">Search for a car</Link></article></main>;
}
