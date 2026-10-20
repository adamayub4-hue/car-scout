import type { ReactNode, Ref } from "react";
import SiteHeader from "./site-header";
import SearchCategories, { type SearchCategory } from "./search-categories";

type SearchPageShellProps = {
  active: SearchCategory;
  children: ReactNode;
  after?: ReactNode;
  searchRef?: Ref<HTMLElement>;
};

export default function SearchPageShell({ active, children, after, searchRef }: SearchPageShellProps) {
  return <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:py-8">
    <div className="mx-auto max-w-3xl">
      <SiteHeader />
      <section aria-labelledby="home-title" className="py-5 text-center sm:py-6">
        <h1 id="home-title" className="mx-auto max-w-xl text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">Find your next car, motorbike or part.</h1>
      </section>
      <section ref={searchRef} tabIndex={searchRef ? -1 : undefined} aria-label="Start your search"
        className={`rounded-3xl border border-outline/15 bg-panel p-5 sm:p-6${searchRef ? " scroll-mt-4 outline-none" : ""}`}>
        <SearchCategories active={active} />
        {children}
      </section>
      {after}
    </div>
  </main>;
}
