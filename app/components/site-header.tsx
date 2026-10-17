import Image from "next/image";
import Link from "next/link";
import SiteMenu from "./site-menu";

export default function SiteHeader() {
  return <header className="relative z-20 flex items-center justify-between gap-4 border-b border-outline/10 pb-4">
    <Link href="/" aria-label="Mekivo home" className="inline-flex min-h-11 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">
      <Image src="/icons/mekivo-192.png" alt="" width={44} height={44} priority className="rounded-xl" />
      <span><span className="block text-xl font-bold">Mekivo</span><span className="block text-xs text-muted">UK cars, motorbikes & parts</span></span>
    </Link>
    <SiteMenu />
  </header>;
}
