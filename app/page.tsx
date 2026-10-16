import Link from "next/link";
import SiteHeader from "./components/site-header";
import HomeSearch from "./components/home-search";
import InstallMekivo from "./components/install-mekivo";
import SocialLinks from "./components/social-links";

const categories = [
  { label: "Cars", href: "/cars", path: "m4 9 2-5h12l2 5M3 9h18v8H3V9Zm2 8v3m14-3v3M6 12h2m8 0h2" },
  { label: "Motorbikes", href: "/motorbikes", path: "M7 7h5l5 10M11 7l3-4h4M4 17l6-7h5M8 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm16 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" },
  { label: "Parts", href: "/parts", path: "m14 3-3 3 2 5-5 5-4-1-3 3 5 5 3-3-1-4 5-5 5 2 3-3-4-4-3-3Z" },
];

export default function HomePage() {
  return <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:py-8">
    <div className="mx-auto max-w-3xl">
      <SiteHeader />
      <section aria-labelledby="home-title" className="pb-6 pt-7 sm:pb-8 sm:pt-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-link">One search. More places.</p>
        <h1 id="home-title" className="mt-3 max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Find your next car, motorbike or part.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted sm:text-base">Compare UK marketplaces and open the original adverts.</p>
      </section>

      <section aria-label="Start your search" className="rounded-3xl border border-outline/15 bg-panel p-5 sm:p-6">
        <nav aria-label="Search categories" className="mb-5 grid grid-cols-3 gap-2 border-b border-outline/10 pb-5">
          {categories.map((category, index) => <Link key={category.label} href={category.href}
            className={`flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link sm:flex-row sm:gap-2 sm:text-sm ${index === 0 ? "bg-sky-400/10 text-link" : "text-muted hover:bg-overlay/5 hover:text-foreground"}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5"><path d={category.path} /></svg>
            {category.label}
          </Link>)}
        </nav>
        <HomeSearch />
      </section>

      <Link href="/vehicle-check" className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-outline/15 bg-panel p-5 transition hover:border-sky-400/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">
        <span><span className="block font-bold">Check vehicle tax & MOT</span><span className="mt-1 block text-sm text-muted">See status and due dates where available.</span></span>
        <span aria-hidden="true" className="shrink-0 text-xl text-link">→</span>
      </Link>
      <div className="mt-6 border-t border-outline/10 pt-6">
        <InstallMekivo />
        <SocialLinks />
      </div>
      <footer className="mt-6 border-t border-outline/10 pb-3 pt-5 text-xs leading-6 text-subtle">
        <p>Mekivo is free to use. Some links are affiliate links; we may earn a commission at no extra cost to you. Availability and prices are set by the original marketplace.</p>
        <nav aria-label="Information" className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-semibold text-link">
          <Link href="/guides">Guides</Link><Link href="/support">Help & feedback</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link>
        </nav>
      </footer>
    </div>
  </main>;
}
