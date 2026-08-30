import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Mekivo handles search and vehicle information.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6">
      <article className="mx-auto max-w-3xl rounded-3xl border border-outline/10 bg-panel/95 p-6 sm:p-10">
        <Link href="/" className="text-sm font-semibold text-link">← Back to Mekivo</Link>
        <h1 className="mt-7 text-4xl font-bold tracking-tight">Privacy</h1>
        <p className="mt-3 text-sm text-subtle">Last updated 26 August 2026</p>
        <div className="mt-8 space-y-7 text-sm leading-7 text-muted">
          <section><h2 className="text-lg font-bold text-foreground">Search information</h2><p className="mt-2">Car searches are assembled in your browser. When you choose a marketplace, the relevant search terms are sent to that marketplace under its own privacy policy.</p></section>
          <section><h2 className="text-lg font-bold text-foreground">Vehicle registrations</h2><p className="mt-2">When you use registration lookup, Mekivo sends the registration number to the Driver and Vehicle Licensing Agency (DVLA) Vehicle Enquiry Service to retrieve vehicle information such as make, year, engine size, fuel type, colour, MOT status and tax status. Mekivo uses this information to pre-fill the vehicle search you requested. The raw registration number is not stored in Mekivo&apos;s product-activity records. Standard hosting and security logs may record technical request information, but the lookup response is not publicly indexed or cached.</p></section>
          <section><h2 className="text-lg font-bold text-foreground">Accounts and saved data</h2><p className="mt-2">If you create an account, Mekivo stores your email address, authentication records, and the vehicles or searches you choose to save. Authentication and database services are provided by Supabase. Security rules restrict saved records to the account that created them. You can remove individual saved items from your account.</p></section>
          <section><h2 className="text-lg font-bold text-foreground">Cookies and local storage</h2><p className="mt-2">Mekivo uses essential browser storage to keep an account signed in. It does not currently use advertising cookies or operate a payment system. Hosting providers may process standard technical logs needed to operate and secure the service.</p></section>
          <section><h2 className="text-lg font-bold text-foreground">Feedback and activity</h2><p className="mt-2">When signed in, suggestions or reports you submit and limited product activity such as searches and saved items may be recorded to operate support, understand usage and improve Mekivo. This information is restricted to your account and Mekivo&apos;s authorised owner account.</p></section>
          <section><h2 className="text-lg font-bold text-foreground">Why information is used</h2><p className="mt-2">Account information is used to provide the service you request. Support records, security logs and limited usage information are used to operate, protect and improve Mekivo. Mekivo does not sell personal information or use it for targeted advertising.</p></section>
          <section><h2 className="text-lg font-bold text-foreground">Retention</h2><p className="mt-2">Registration numbers entered for a lookup are not added to Mekivo&apos;s product-activity records. Account data is retained while your account remains active. Deleted accounts and their associated saved items, reports and activity are removed from the live database. Limited hosting and security logs may remain for their providers&apos; normal operational retention periods.</p></section>
          <section><h2 className="text-lg font-bold text-foreground">Your choices and rights</h2><p className="mt-2">The account page lets you download a copy of your data and, unless it is the protected service-owner account, permanently delete the account. You may also ask for access, correction, restriction or deletion through the <Link href="/support" className="font-semibold text-link">Mekivo support form</Link>.</p></section>
          <section><h2 className="text-lg font-bold text-foreground">Service providers and international processing</h2><p className="mt-2">Mekivo uses the DVLA Vehicle Enquiry Service for registration lookups, Vercel for hosting, and Supabase for authentication and database services. Those providers may process relevant vehicle, technical or account information under their own data-processing and security terms.</p></section>
          <section><h2 className="text-lg font-bold text-foreground">Contact and operator</h2><p className="mt-2">Mekivo is operated by Adam Ayub. Privacy questions and complaints can be emailed to <a href="mailto:adamayub4@gmail.com" className="font-semibold text-link">adamayub4@gmail.com</a> or submitted through <Link href="/support" className="font-semibold text-link">Report a problem</Link>. Mekivo does not currently publish a business address because it has no public business premises.</p></section>
          <section><h2 className="text-lg font-bold text-foreground">External services</h2><p className="mt-2">Mekivo links to third-party marketplaces. Their terms and privacy notices apply after you leave Mekivo.</p></section>
        </div>
      </article>
    </main>
  );
}
