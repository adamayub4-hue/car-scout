import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to check car-part compatibility",
  description: "Understand OEM numbers, superseded references, vehicle variants and seller fitment checks before buying car parts.",
  alternates: { canonical: "/guides/checking-part-compatibility" },
};

const checks = [
  ["OEM number", "The vehicle manufacturer's original reference is usually the strongest starting point. Confirm every letter and suffix."],
  ["Superseded number", "Manufacturers sometimes replace an older reference with a newer one. Ask for evidence that the new number officially replaces yours."],
  ["Engine and trim", "Power output, gearbox, braking package and factory options can change the fitted component even within one model year."],
  ["Physical comparison", "Compare dimensions, connectors, bolt pattern and orientation. Similar appearance is useful for spotting an obvious mismatch, but is not a guarantee."],
  ["Seller confirmation", "Ask the seller to confirm fitment against the VIN or registration and retain the reply."],
] as const;

export default function CompatibilityGuide() {
  return <main className="min-h-screen bg-background px-4 py-10 text-foreground"><article className="mx-auto max-w-3xl"><Link href="/guides" className="text-sm font-semibold text-link">← All guides</Link><p className="mt-12 text-xs font-bold uppercase tracking-[0.22em] text-purple">Compatibility guide</p><h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">How to check whether a car part fits</h1><p className="mt-5 text-lg leading-8 text-muted">Use several matching signals before purchasing. No single photograph or keyword is enough.</p><div className="mt-10 grid gap-4 sm:grid-cols-2">{checks.map(([title, copy]) => <section key={title} className="rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5"><h2 className="text-lg font-bold">{title}</h2><p className="mt-3 text-sm leading-6 text-muted">{copy}</p></section>)}</div><section className="mt-10 border-t border-outline/10 pt-7"><h2 className="text-2xl font-bold">Before fitting</h2><p className="mt-3 leading-7 text-muted">Place the old and replacement parts side by side without forcing or modifying anything. If identifiers, dimensions or connections differ, stop and confirm with the supplier or a qualified mechanic.</p></section><Link href="/" className="mt-8 inline-flex rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950">Start a Mekivo search</Link></article></main>;
}
