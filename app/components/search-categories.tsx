import Link from "next/link";

export type SearchCategory = "cars" | "motorbikes" | "parts";

const categories = [
  { id: "cars", label: "Cars", href: "/cars", path: "m4 9 2-5h12l2 5M3 9h18v8H3V9Zm2 8v3m14-3v3M6 12h2m8 0h2" },
  { id: "motorbikes", label: "Motorbikes", href: "/motorbikes", path: "M7 7h5l5 10M11 7l3-4h4M4 17l6-7h5M8 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm16 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" },
  { id: "parts", label: "Parts", href: "/parts", path: "m14 3-3 3 2 5-5 5-4-1-3 3 5 5 3-3-1-4 5-5 5 2 3-3-4-4-3-3Z" },
] as const;

export default function SearchCategories({ active }: { active: SearchCategory }) {
  return <nav aria-label="Search categories" className="mb-5 grid grid-cols-3 gap-2 border-b border-outline/10 pb-5">
    {categories.map(category => <Link key={category.id} href={category.href} aria-current={category.id === active ? "page" : undefined}
      className={`flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link sm:flex-row sm:gap-2 sm:text-sm ${category.id === active ? "bg-sky-400/10 text-link" : "text-muted hover:bg-overlay/5 hover:text-foreground"}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5"><path d={category.path} /></svg>
      {category.label}
    </Link>)}
  </nav>;
}
