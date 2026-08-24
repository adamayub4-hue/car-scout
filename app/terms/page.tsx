import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms for using the Mekivo search service.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#07101e] px-4 py-12 text-white sm:px-6">
      <article className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-slate-950/55 p-6 sm:p-10">
        <Link href="/" className="text-sm font-semibold text-sky-300">← Back to Mekivo</Link>
        <h1 className="mt-7 text-4xl font-bold tracking-tight">Terms of use</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated 22 August 2026</p>
        <div className="mt-8 space-y-7 text-sm leading-7 text-slate-300">
          <section><h2 className="text-lg font-bold text-white">Search service</h2><p className="mt-2">Mekivo is a discovery tool that prepares searches and directs you to independent marketplaces. Mekivo is not the seller, dealer, parts supplier or payment provider.</p></section>
          <section><h2 className="text-lg font-bold text-white">Accuracy and compatibility</h2><p className="mt-2">Listings, prices and availability can change. Vehicle diagrams are illustrative, not manufacturer workshop documentation. Confirm specifications, history, condition, part numbers and fitment with the seller before committing to a purchase.</p></section>
          <section><h2 className="text-lg font-bold text-white">No professional advice</h2><p className="mt-2">Mekivo does not provide mechanical, safety, legal or financial advice. Repairs should be assessed and performed by a suitably qualified person.</p></section>
          <section><h2 className="text-lg font-bold text-white">Third-party services</h2><p className="mt-2">Your use of Auto Trader, eBay, Gumtree, DVLA services and other linked sites is governed by their respective terms.</p></section>
          <section><h2 className="text-lg font-bold text-white">Accounts</h2><p className="mt-2">You are responsible for keeping your account credentials secure and for activity performed through your account. Do not use Mekivo to submit unlawful, abusive or misleading content. Mekivo may restrict accounts that threaten the security or availability of the service.</p></section>
          <section><h2 className="text-lg font-bold text-white">Saved information</h2><p className="mt-2">Saved searches are provided for convenience and may become outdated as third-party listings change. You can export or delete account information using the controls on your account page.</p></section>
          <section><h2 className="text-lg font-bold text-white">Operator and contact</h2><p className="mt-2">Mekivo is operated by Adam Ayub. Questions about these terms can be emailed to <a href="mailto:adamayub4@gmail.com" className="font-semibold text-sky-300">adamayub4@gmail.com</a> or submitted through the <Link href="/support" className="font-semibold text-sky-300">support form</Link>. No public business address is currently provided because Mekivo has no public business premises.</p></section>
        </div>
      </article>
    </main>
  );
}
