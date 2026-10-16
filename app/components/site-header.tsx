import Image from "next/image";
import Link from "next/link";
import AppearanceControl from "./appearance";

export default function SiteHeader() {
  return <header className="relative z-20 flex items-center justify-between gap-4 border-b border-outline/10 pb-4">
    <Link href="/" aria-label="Mekivo home" className="inline-flex min-h-11 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">
      <Image src="/icons/mekivo-192.png" alt="" width={44} height={44} priority className="rounded-xl" />
      <span><span className="block text-xl font-bold">Mekivo</span><span className="block text-xs text-muted">UK cars, motorbikes & parts</span></span>
    </Link>
    <details className="group relative shrink-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-outline/15 bg-panel px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className="h-5 w-5"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        Menu
      </summary>
      <div className="absolute right-0 top-full mt-3 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-outline/20 bg-panel p-3 shadow-2xl">
        <nav aria-label="Mekivo menu" className="grid gap-1 text-sm font-semibold">
          <Link href="/" className="rounded-xl px-3 py-3 text-link hover:bg-overlay/5">Home</Link>
          <Link href="/guides" className="rounded-xl px-3 py-3 text-link hover:bg-overlay/5">Buying & parts guides</Link>
          <Link href="/account" className="rounded-xl px-3 py-3 text-link hover:bg-overlay/5">My account & saved items</Link>
          <Link href="/support" className="rounded-xl px-3 py-3 text-link hover:bg-overlay/5">Help & feedback</Link>
        </nav>
        <div className="mt-2 border-t border-outline/10 px-2 pt-3">
          <p className="mb-2 text-xs font-semibold text-muted">Appearance</p>
          <AppearanceControl />
        </div>
      </div>
    </details>
  </header>;
}
