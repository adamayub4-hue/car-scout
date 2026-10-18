"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const items = [
  { label: "Home", href: "/", path: "M3 10.5 12 3l9 7.5M5.5 9v11h5v-6h3v6h5V9" },
  { label: "Search", href: "/cars", path: "M20.5 20.5 16 16M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0" },
  { label: "Free check", href: "/vehicle-check", path: "m8 12 3 3 5-6M12 3 4 6v6c0 4.5 8 9 8 9s8-4.5 8-9V6l-8-3Z" },
  { label: "Saved", href: "/account#saved-items", path: "M20.8 4.8a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z" },
  { label: "Account", href: "/account", path: "M20 21a8 8 0 0 0-16 0M16.5 7.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0" },
];

export default function MobileNavigation() {
  const pathname = usePathname();
  const navigationRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    const updateHeight = () => document.documentElement.style.setProperty("--mekivo-mobile-nav-height", `${Math.ceil(navigation.getBoundingClientRect().height)}px`);
    updateHeight();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateHeight);
    observer?.observe(navigation);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeight);
      document.documentElement.style.removeProperty("--mekivo-mobile-nav-height");
    };
  }, []);
  return <nav ref={navigationRef} aria-label="Main navigation" className="mobile-navigation fixed inset-x-0 bottom-0 z-40 border-t border-outline/15 bg-panel md:hidden">
    <div className="mx-auto grid max-w-xl grid-cols-5 px-2">
      {items.map(item => {
        const active = item.label === "Home" ? pathname === "/"
          : item.label === "Search" ? ["/cars", "/motorbikes", "/parts"].includes(pathname)
          : item.href === "/vehicle-check" ? pathname === "/vehicle-check"
          : item.label === "Account" ? pathname === "/account" || pathname.startsWith("/account/") : false;
        return <Link key={item.label} href={item.href} aria-label={item.href === "/vehicle-check" ? "Free car check — tax and MOT" : undefined} aria-current={active ? "page" : undefined}
          className={`flex min-h-16 min-w-0 flex-col items-center justify-start gap-1 rounded-xl px-0 py-2 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-link ${active ? "text-link" : "text-muted hover:text-foreground"}`}>
          <span className={`grid h-8 w-11 shrink-0 place-items-center rounded-full ${active ? "bg-sky-400/10" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5"><path d={item.path} /></svg>
          </span>
          <span className="mobile-navigation-label">{item.label}</span>
        </Link>;
      })}
    </div>
  </nav>;
}
