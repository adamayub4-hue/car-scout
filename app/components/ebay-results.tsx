"use client";

import Image from "next/image";
import { useState } from "react";
import { formatListingPrice, safeListingImage, withEbayAffiliateTracking, type EbayListing, type Mode } from "../lib/search";
import { trackGrowthEvent } from "../lib/growth-events";

export function ListingPhoto({ item }: { item: EbayListing }) {
  const [failed, setFailed] = useState(false);
  const src = safeListingImage(item.image);
  return <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
    {src && !failed ? <Image src={src} alt={item.title} fill sizes="(max-width: 640px) 85vw, (max-width: 1024px) 40vw, 300px" className="object-contain" onError={() => setFailed(true)} /> : <span className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-slate-500">Photo unavailable · View on eBay</span>}
    <span className="absolute bottom-2 left-2 rounded-md bg-white/95 px-2 py-1 text-[11px] font-bold text-slate-800">eBay listing</span>
  </div>;
}

export default function EbayResults({ items, loading, error, fallbackUrl, searchType, onRetry }: { items: EbayListing[]; loading: boolean; error: string; fallbackUrl: string; searchType: Mode; onRetry: () => void }) {
  const trackClick = (destination: "all_results" | "listing") => trackGrowthEvent("marketplace_outbound", { marketplace: "ebay", search_type: searchType, destination });
  if (loading) return <div role="status" className="mt-4 rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5 text-sm text-muted">Loading live eBay listings…</div>;
  if (error || items.length === 0) return <div role="status" className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5 text-sm text-warning">
    <p>{error || "No live eBay listings matched this search."}</p>
    <div className="mt-3 flex flex-wrap items-center gap-5">{error && <button type="button" onClick={onRetry} className="rounded-lg border border-current px-3 py-2 font-semibold">Try again</button>}<a href={fallbackUrl} target="_blank" rel="sponsored noreferrer" onClick={() => trackClick("all_results")} className="font-bold underline underline-offset-4">Search directly on eBay</a></div>
  </div>;
  return <section className="mt-5" aria-label="Live eBay listings">
    <div className="flex items-center justify-between gap-4"><div><h3 className="text-sm font-bold text-link">Live eBay listings</h3><p className="mt-1 text-xs leading-5 text-subtle">Check price, availability and compatibility on eBay. Mekivo may earn a commission.</p></div><a href={fallbackUrl} target="_blank" rel="sponsored noreferrer" onClick={() => trackClick("all_results")} className="shrink-0 text-sm font-semibold text-link">See all →</a></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.slice(0, 6).map(item => <a key={item.id} href={withEbayAffiliateTracking(item.url, `mekivo-${searchType}-live`)} target="_blank" rel="sponsored noreferrer" onClick={() => trackClick("listing")} className="rounded-2xl border border-outline/10 bg-overlay/[0.04] p-3 transition hover:border-sky-400/50 focus-visible:outline-2 focus-visible:outline-sky-400">
      <ListingPhoto item={item} /><h4 className="mt-3 line-clamp-3 text-sm font-bold leading-5">{item.title}</h4><p className="mt-2 text-lg font-black">{formatListingPrice(item.price, item.currency)}</p><p className="mt-1 text-xs text-subtle">{[item.condition, item.location].filter(Boolean).join(" · ") || "View listing details"}</p><span className="mt-3 inline-block text-xs font-semibold text-link">View original listing →</span>
    </a>)}</div>
  </section>;
}
