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
        <p className="mt-3 text-sm text-slate-500">Last updated 22 August 2026</p>
        <div className="mt-8 space-y-7 text-sm leading-7 text-slate-300">
          <section><h2 className="text-lg font-bold text-white">Search information</h2><p className="mt-2">Car searches are assembled in your browser. When you choose a marketplace, the relevant search terms are sent to that marketplace under its own privacy policy.</p></section>
          <section><h2 className="text-lg font-bold text-white">Vehicle registrations</h2><p className="mt-2">A registration submitted for vehicle identification is sent through CarScout&apos;s server to the DVLA Vehicle Enquiry Service. It is sent in a secure request body and is not placed in a marketplace URL. CarScout does not intentionally retain registration searches.</p></section>
          <section><h2 className="text-lg font-bold text-white">Accounts and saved data</h2><p className="mt-2">If you create an account, CarScout stores your email address, authentication records, and the vehicles or searches you choose to save. Authentication and database services are provided by Supabase. Security rules restrict saved records to the account that created them. You can remove individual saved items from your account.</p></section>
          <section><h2 className="text-lg font-bold text-white">Cookies and local storage</h2><p className="mt-2">CarScout uses essential browser storage to keep an account signed in. It does not currently use advertising cookies or operate a payment system. Hosting providers may process standard technical logs needed to operate and secure the service.</p></section>
          <section><h2 className="text-lg font-bold text-white">Complaints and activity</h2><p className="mt-2">When signed in, reports you submit and limited product activity such as searches and saved items may be recorded to operate support, understand usage and improve CarScout. This information is restricted to your account and CarScout&apos;s authorised owner account.</p></section>
          <section><h2 className="text-lg font-bold text-white">Why information is used</h2><p className="mt-2">Account information is used to provide the service you request. Support records, security logs and limited usage information are used to operate, protect and improve CarScout. CarScout does not sell personal information or use it for targeted advertising.</p></section>
          <section><h2 className="text-lg font-bold text-white">Retention</h2><p className="mt-2">Account data is retained while your account remains active. Deleted accounts and their associated saved items, reports and activity are removed from the live database. Limited hosting and security logs may remain for their providers&apos; normal operational retention periods.</p></section>
          <section><h2 className="text-lg font-bold text-white">Your choices and rights</h2><p className="mt-2">The account page lets you download a copy of your data and, unless it is the protected service-owner account, permanently delete the account. You may also ask for access, correction, restriction or deletion through the <Link href="/support" className="font-semibold text-sky-300">CarScout support form</Link>.</p></section>
          <section><h2 className="text-lg font-bold text-white">Service providers and international processing</h2><p className="mt-2">CarScout uses Vercel for hosting and Supabase for authentication and database services. Those providers may process technical and account information under their own data-processing and security terms.</p></section>
          <section><h2 className="text-lg font-bold text-white">Contact and operator</h2><p className="mt-2">CarScout is operated by Adam Ayub. Privacy questions and complaints can be emailed to <a href="mailto:adamayub4@gmail.com" className="font-semibold text-sky-300">adamayub4@gmail.com</a> or submitted through <Link href="/support" className="font-semibold text-sky-300">Report a problem</Link>. CarScout does not currently publish a business address because it has no public business premises.</p></section>
          <section><h2 className="text-lg font-bold text-white">External services</h2><p className="mt-2">CarScout links to third-party marketplaces. Their terms and privacy notices apply after you leave CarScout.</p></section>
        </div>
      </article>
    </main>
  );
}
