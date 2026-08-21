import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How CarScout handles search and vehicle information.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#07101e] px-4 py-12 text-white sm:px-6">
      <article className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-slate-950/55 p-6 sm:p-10">
        <Link href="/" className="text-sm font-semibold text-sky-300">← Back to CarScout</Link>
        <h1 className="mt-7 text-4xl font-bold tracking-tight">Privacy</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated 21 August 2026</p>
        <div className="mt-8 space-y-7 text-sm leading-7 text-slate-300">
          <section><h2 className="text-lg font-bold text-white">Search information</h2><p className="mt-2">Car searches are assembled in your browser. When you choose a marketplace, the relevant search terms are sent to that marketplace under its own privacy policy.</p></section>
          <section><h2 className="text-lg font-bold text-white">Vehicle registrations</h2><p className="mt-2">A registration submitted for vehicle identification is sent through CarScout&apos;s server to the DVLA Vehicle Enquiry Service. It is sent in a secure request body and is not placed in a marketplace URL. CarScout does not intentionally retain registration searches.</p></section>
          <section><h2 className="text-lg font-bold text-white">Cookies and accounts</h2><p className="mt-2">CarScout currently has no user accounts, advertising cookies or payment system. Hosting providers may process standard technical logs needed to operate and secure the service.</p></section>
          <section><h2 className="text-lg font-bold text-white">External services</h2><p className="mt-2">CarScout links to third-party marketplaces. Their terms and privacy notices apply after you leave CarScout.</p></section>
        </div>
      </article>
    </main>
  );
}
