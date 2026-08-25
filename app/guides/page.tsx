import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "UK car and parts guides",
  description: "Plain-English guides for buying a used car and finding the correct replacement parts in the UK.",
  alternates: { canonical: "/guides" },
};

const guides = [
  ["/guides/buying-a-used-car", "Buying a used car", "A practical UK checklist covering history, condition, paperwork and the test drive."],
  ["/guides/finding-the-right-car-part", "Finding the right car part", "Use vehicle details and part numbers to narrow a search without guessing."],
  ["/guides/checking-part-compatibility", "Checking part compatibility", "Understand OEM numbers, variants and the checks to make before purchasing."],
] as const;

export default function GuidesPage() {
  return <main className="min-h-screen bg-[#07101e] px-4 py-10 text-white"><div className="mx-auto max-w-4xl"><Link href="/" className="text-sm font-semibold text-sky-300">← Back to Mekivo</Link><p className="mt-12 text-xs font-bold uppercase tracking-[0.22em] text-sky-300">Mekivo guides</p><h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Cars and parts, explained clearly</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Straightforward guidance for people who want to make a better-informed choice without needing specialist automotive knowledge.</p><div className="mt-10 grid gap-4 sm:grid-cols-3">{guides.map(([href, title, copy]) => <Link key={href} href={href} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-sky-300/40 hover:bg-white/[0.07]"><h2 className="text-lg font-bold">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p><span className="mt-5 block text-sm font-semibold text-sky-300">Read guide →</span></Link>)}</div></div></main>;
}
