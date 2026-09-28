import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "../lib/guides";
import { serializeStructuredData } from "../lib/guides/metadata";

export const metadata: Metadata = {
  title: "UK car and parts guides",
  description: "UK car and parts checklists with GOV.UK sources: buying safely, MOT history, V5C documents, part numbers and compatibility.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "UK car and parts guides",
    description: "Practical UK car and parts checklists with GOV.UK sources.",
    url: "https://mekivo.uk/guides",
    type: "website",
    siteName: "Mekivo",
    locale: "en_GB",
  },
  twitter: { card: "summary", title: "UK car and parts guides", description: "Practical UK car and parts checklists with GOV.UK sources." },
};

export default function GuidesPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://mekivo.uk" },
          { "@type": "ListItem", position: 2, name: "Guides", item: "https://mekivo.uk/guides" },
        ],
      }) }} />
      <div className="mx-auto max-w-5xl">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <ol className="flex gap-2"><li><Link href="/" className="font-semibold text-link hover:underline">Home</Link></li><li><span aria-hidden="true">/ </span><span aria-current="page">Guides</span></li></ol>
        </nav>
        <p className="mt-12 text-xs font-bold uppercase tracking-[0.22em] text-link">Mekivo guides</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Cars and parts, explained clearly</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">Practical UK checklists with links to GOV.UK guidance, so you can check the vehicle, understand the paperwork and ask better questions before buying.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => <Link key={guide.slug} href={`/guides/${guide.slug}`} className="rounded-2xl border border-outline/10 bg-overlay/[0.04] p-5 transition hover:border-sky-300/40 hover:bg-overlay/[0.07]">
            <p className="text-xs font-bold uppercase tracking-wider text-link">{guide.category === "cars" ? "Buying a car" : "Finding parts"}</p>
            <h2 className="mt-3 text-lg font-bold">{guide.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{guide.description}</p>
            <span className="mt-5 block text-sm font-semibold text-link">Read guide →</span>
          </Link>)}
        </div>
      </div>
    </main>
  );
}
