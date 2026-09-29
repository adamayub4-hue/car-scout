"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { formatListingPrice, safeListingImage, withEbayAffiliateTracking, type EbayListing, type Mode } from "../lib/search";
import { partPostageLabel } from "../lib/part-recommendations";
import { trackGrowthEvent } from "../lib/growth-events";
import SaveListingButton from "./save-listing-button";

export function ListingPhoto({ item, sizes = "(max-width: 640px) 85vw, (max-width: 1024px) 40vw, 300px" }: { item: EbayListing; sizes?: string }) {
  const [failed, setFailed] = useState(false);
  const src = safeListingImage(item.image);
  return <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
    {src && !failed ? <Image src={src} alt={item.title} fill sizes={sizes} className="object-contain" onError={() => setFailed(true)} /> : <span className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-slate-500">Photo unavailable · View on eBay</span>}
    <span className="absolute bottom-2 left-2 rounded-md bg-white/95 px-2 py-1 text-[11px] font-bold text-slate-800">eBay listing</span>
  </div>;
}

export default function EbayResults({ items, loading, error, fallbackUrl, searchType, searchUrl, onRetry }: { items: EbayListing[]; loading: boolean; error: string; fallbackUrl: string; searchType: Mode; searchUrl?: string; onRetry: () => void }) {
  const [pagination, setPagination] = useState({ items, page: 0 });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isCars = searchType === "cars";
  const pageSize = 3;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = pagination.items === items ? Math.min(pagination.page, pageCount - 1) : 0;
  const visibleItems = items.slice(page * pageSize, (page + 1) * pageSize);
  const changePage = (next: number) => {
    setPagination({ items, page: Math.max(0, Math.min(next, pageCount - 1)) });
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  };
  const trackClick = (destination: "all_results" | "listing") => trackGrowthEvent("marketplace_outbound", { marketplace: "ebay", search_type: searchType, destination });
  if (loading) return <div role="status" className="mt-4 rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5 text-sm text-muted">Loading live eBay listings…</div>;
  if (error || items.length === 0) return <div role="status" className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5 text-sm text-warning">
    <p>{error || "No live eBay listings matched this search."}</p>
    <div className="mt-3 flex flex-wrap items-center gap-5">{error && <button type="button" onClick={onRetry} className="rounded-lg border border-current px-3 py-2 font-semibold">Try again</button>}<a href={fallbackUrl} target="_blank" rel="sponsored noreferrer" onClick={() => trackClick("all_results")} className="font-bold underline underline-offset-4">Search directly on eBay</a></div>
  </div>;
  return <section className="mt-5" aria-label="Live eBay listings">
    <div className="flex items-center justify-between gap-4"><div><h3 ref={headingRef} tabIndex={-1} className="scroll-mt-44 text-sm font-bold text-link outline-none">Live eBay listings</h3><p className="mt-1 text-xs leading-5 text-subtle">Check price, availability and {isCars ? "vehicle details" : "compatibility"} on eBay. Mekivo may earn a commission.</p></div><a href={fallbackUrl} target="_blank" rel="sponsored noreferrer" onClick={() => trackClick("all_results")} className="shrink-0 text-sm font-semibold text-link">See all →</a></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">{visibleItems.map(item => <article key={item.id} className="flex min-w-0 flex-col rounded-2xl border border-outline/10 bg-overlay/[0.04] p-3">
      <a href={withEbayAffiliateTracking(item.url, `mekivo-${searchType}-live`)} target="_blank" rel="sponsored noreferrer" onClick={() => trackClick("listing")} className="grid flex-1 grid-cols-[6.5rem_minmax(0,1fr)] gap-3 rounded-xl transition hover:text-link focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400 sm:block">
      <ListingPhoto item={item} sizes="(max-width: 639px) 104px, (max-width: 1024px) 28vw, 270px" /><div><h4 className="line-clamp-3 text-sm font-bold leading-5 sm:mt-3">{item.title}</h4><p className="mt-2 text-lg font-black">{formatListingPrice(item.price, item.currency)}</p>{!isCars && <><p className="mt-1 text-xs text-subtle">Item price</p><p className="mt-1 text-xs leading-5 text-subtle">{partPostageLabel(item)}</p></>}<p className="mt-1 text-xs text-subtle">{[item.condition, item.location].filter(Boolean).join(" · ") || "View listing details"}</p><span className="mt-3 inline-block text-xs font-semibold text-link">View original listing →</span></div>
      </a><SaveListingButton item={item} searchType={searchType} searchUrl={searchUrl} />
    </article>)}</div>
    <nav aria-label={isCars ? "Car listings pages" : "Parts listings pages"} className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={() => changePage(page - 1)} disabled={page === 0} className="min-h-11 rounded-xl border border-outline/15 px-3 py-2 text-sm font-semibold text-link disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-sky-400">← Previous</button>
      <p role="status" aria-live="polite" className="text-xs text-muted">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, items.length)} of {items.length} returned</p>
      <button type="button" onClick={() => changePage(page + 1)} disabled={page === pageCount - 1} className="min-h-11 rounded-xl border border-outline/15 px-3 py-2 text-sm font-semibold text-link disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-sky-400">Next →</button>
    </nav>
  </section>;
}
