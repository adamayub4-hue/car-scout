"use client";

import { getPartRecommendations, partPostageLabel } from "../lib/part-recommendations";
import { trackGrowthEvent } from "../lib/growth-events";
import { withEbayAffiliateTracking, type EbayListing, type SubmittedSearch } from "../lib/search";
import { ListingPhoto } from "./ebay-results";

const pounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export default function PartRecommendations({ search, items, loading, error }: {
  search: SubmittedSearch; items: EbayListing[]; loading: boolean; error: string;
}) {
  if (search.mode !== "parts") return null;
  const recommendations = !loading && !error ? getPartRecommendations(items, search) : [];
  return <section aria-labelledby="part-recommendations-heading" className="mt-4 rounded-2xl border border-sky-300/30 bg-sky-400/[0.06] p-4 sm:p-6">
    <p className="text-xs font-bold uppercase tracking-wider text-link">A starting point for your comparison</p>
    <h3 id="part-recommendations-heading" className="mt-2 text-xl font-bold sm:text-2xl">Lowest item prices in these results</h3>
    <p className="mt-2 text-sm leading-6 text-muted">Up to 3 fixed-price GBP listings whose titles match your part number, or your part name and vehicle make/model. Ranked by item price, before postage.</p>
    {loading ? <p role="status" className="mt-4 text-sm text-muted">Checking the returned eBay listings for title matches and clear item prices…</p>
      : error ? <p role="status" className="mt-4 text-sm text-warning">The price shortlist is temporarily unavailable. Choose Live parts to retry, or edit your search.</p>
        : recommendations.length === 0 ? <p role="status" className="mt-4 text-sm leading-6 text-muted">We couldn’t identify a clear title match with a fixed GBP item price. Choose Live parts to browse all returned listings, or refine your part number or name.</p>
          : <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {recommendations.map(({ item, url, pricePence }, index) => <a key={item.id}
              href={withEbayAffiliateTracking(url, "mekivo-parts-shortlist")} target="_blank" rel="sponsored noreferrer"
              onClick={() => trackGrowthEvent("marketplace_outbound", { marketplace: "ebay", search_type: "parts", destination: "listing" })}
              className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-outline/15 bg-panel p-3 transition hover:border-sky-400/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400 sm:flex sm:flex-col">
              <div className="w-full"><ListingPhoto item={item} sizes="(max-width: 639px) 88px, (max-width: 1024px) 28vw, 240px" /></div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-xs font-semibold text-link">{index === 0 ? "Lowest item price here" : `Price option ${index + 1}`} · eBay</p>
                <h4 className="mt-2 line-clamp-3 text-sm font-bold leading-5">{item.title}</h4>
                <p className="mt-2 text-2xl font-black">{pounds.format(pricePence / 100)}</p>
                <p className="mt-1 text-xs text-subtle">Item price · Buy it now</p>
                <p className="mt-2 text-xs leading-5 text-subtle">{partPostageLabel(item)}</p>
                <p className="mt-2 text-xs leading-5 text-subtle">{item.condition || "Check condition with the seller"}</p>
                <span className="mt-auto pt-3 text-xs font-bold text-link">Check fit and view on eBay →</span>
              </div>
            </a>)}
          </div>}
    <p className="mt-4 text-xs leading-5 text-subtle">Title matches do not confirm compatibility. Brands, condition, quantity and side can differ. Confirm the exact part number, fitment, postage and full cost with the seller. This compares only the returned eBay listings; other sellers may offer a better deal. Mekivo may earn a commission.</p>
  </section>;
}
