import Link from "next/link";
import SearchPageShell from "./components/search-page-shell";
import SiteFooter from "./components/site-footer";
import HomeSearch from "./components/home-search";
import InstallMekivo from "./components/install-mekivo";
import SocialLinks from "./components/social-links";

export default function HomePage() {
  return <SearchPageShell active="cars" after={<>
      <Link href="/vehicle-check" className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-outline/15 bg-panel p-5 transition hover:border-sky-400/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">
        <span><span className="block font-bold">Free car check</span><span className="mt-1 block text-sm text-muted">Tax & MOT status, vehicle details and available due dates.</span></span>
        <span aria-hidden="true" className="shrink-0 text-xl text-link">→</span>
      </Link>
      <div className="mt-6 border-t border-outline/10 pt-6">
        <InstallMekivo />
        <SocialLinks />
      </div>
      <SiteFooter />
    </>}><HomeSearch /></SearchPageShell>;
}
