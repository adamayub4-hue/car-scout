import Link from "next/link";
import { guides } from "../lib/guides";
import type { Guide } from "../lib/guides/types";
import { guideStructuredData, serializeStructuredData } from "../lib/guides/metadata";

const displayDate = (date: string) => new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
}).format(new Date(`${date}T00:00:00Z`));

export default function GuideArticle({ guide }: { guide: Guide }) {
  const related = guides.filter((entry) => guide.relatedSlugs.includes(entry.slug));
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(guideStructuredData(guide)) }} />
      <article className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="text-sm leading-6 text-muted">
          <ol className="flex flex-wrap gap-x-2 gap-y-1">
            <li><Link href="/" className="text-link hover:underline">Home</Link></li>
            <li><span aria-hidden="true">/ </span><Link href="/guides" className="text-link hover:underline">Guides</Link></li>
            <li><span aria-hidden="true">/ </span><span aria-current="page">{guide.title}</span></li>
          </ol>
        </nav>
        <header className="mt-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-link">UK {guide.category === "cars" ? "car" : "parts"} guide</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{guide.title}</h1>
          <p className="mt-5 text-sm text-subtle">By Mekivo · Updated <time dateTime={guide.updatedAt}>{displayDate(guide.updatedAt)}</time></p>
          {guide.intro.map((paragraph) => <p key={paragraph} className="mt-5 text-lg leading-8 text-muted">{paragraph}</p>)}
        </header>
        <nav aria-label="On this page" className="mt-8 rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5">
          <h2 className="font-bold">In this guide</h2>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {guide.sections.map((section) => <li key={section.id}><a href={`#${section.id}`} className="text-sm leading-6 text-link hover:underline">{section.title}</a></li>)}
          </ol>
        </nav>
        <div className="mt-10 space-y-10">
          {guide.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-6 border-t border-outline/10 pt-6">
              <h2 className="text-2xl font-bold">{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 leading-8 text-muted">{paragraph}</p>)}
              {section.sourceIds.length > 0 && <p className="mt-4 text-sm leading-6 text-subtle">GOV.UK sources: {section.sourceIds.map((id, index) => {
                const source = guide.sources.find((entry) => entry.id === id)!;
                return <span key={id}>{index > 0 && "; "}<a href={source.url} className="text-link underline underline-offset-2">{source.title}</a></span>;
              })}</p>}
            </section>
          ))}
        </div>
        <section aria-labelledby="guide-sources" className="mt-10 rounded-2xl border border-outline/10 p-5">
          <h2 id="guide-sources" className="text-xl font-bold">Sources and review date</h2>
          <p className="mt-3 text-sm leading-6 text-muted">Government information checked on {displayDate(guide.updatedAt)}. Mekivo&apos;s checklists explain how to use these sources; GOV.UK does not endorse Mekivo or verify marketplace listings. Follow the linked guidance for its scope and any later changes.</p>
          <ul className="mt-4 space-y-2">{guide.sources.map((source) => <li key={source.id}><a href={source.url} className="text-sm leading-6 text-link underline underline-offset-2">{source.title}</a></li>)}</ul>
        </section>
        <Link href={guide.category === "parts" ? "/?mode=parts" : "/?mode=cars"} className="mt-8 inline-flex rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950">{guide.category === "parts" ? "Open the parts finder" : "Search for a car"}</Link>
        {related.length > 0 && <aside aria-labelledby="related-guides" className="mt-12 border-t border-outline/10 pt-6">
          <h2 id="related-guides" className="text-xl font-bold">Related guides</h2>
          <ul className="mt-4 space-y-3">{related.map((entry) => <li key={entry.slug}><Link href={`/guides/${entry.slug}`} className="font-semibold text-link hover:underline">{entry.title} →</Link></li>)}</ul>
        </aside>}
      </article>
    </main>
  );
}
