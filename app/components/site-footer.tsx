import type { ReactNode } from "react";
import Link from "next/link";

export default function SiteFooter({ children }: { children?: ReactNode } = {}) {
  return <footer className="mt-6 border-t border-outline/10 pb-3 pt-5 text-xs leading-6 text-subtle">
    {children ?? <p>Mekivo is free to use. Some links are affiliate links; we may earn a commission at no extra cost to you. Availability and prices are set by the original marketplace.</p>}
    <nav aria-label="Information" className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-semibold text-link">
      <Link href="/guides">Guides</Link><Link href="/support">Help & feedback</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link>
    </nav>
  </footer>;
}
