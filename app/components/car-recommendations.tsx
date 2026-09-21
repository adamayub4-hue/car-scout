"use client";

import { getCarRecommendations } from "../lib/car-recommendations";
import { trackGrowthEvent } from "../lib/growth-events";
import { withEbayAffiliateTracking, type EbayListing, type SubmittedSearch } from "../lib/search";
import { ListingPhoto } from "./ebay-results";

const pounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 });

export default function CarRecommendations({ search, items, loading, error }: {
  search: SubmittedSearch; items: EbayListing[]; loading: boolean; error: string;
}) {
  if (search.mode !== "cars") return null;
  const hasLivePrices = search.platform === "all" || search.platform === "ebay";
  const recommendations = !loading && !error ? getCarRecommendations(items, search) : [];
  return <section aria-labelledby="car-recommendations-heading" className="mb-5 rounded-2xl border border-sky-300/30 bg-sky-400/[0.06] p-4 sm:p-6">
    <p className="text-xs font-bold uppercase tracking-wider text-link">A starting point for your comparison</p>
    <h2 id="car-recommendations-heading" className="mt-2 text-xl font-bold sm:text-2xl">{hasLivePrices ? "Lowest-priced matches" : "Compare asking prices"}</h2>
    <p className="mt-2 text-sm font-semibold text-foreground">{search.title}</p>
    {!hasLivePrices ? <p className="mt-3 text-sm leading-6 text-muted">Open your chosen marketplace below and sort its results by price. Live price comparisons in Mekivo currently cover eBay only; other marketplaces may have a better offer.</p> : <>
      <p className="mt-2 text-sm leading-6 text-muted">Lowest advertised GBP prices among the matching eBay results returned for this search. Other marketplaces may have a better offer.</p>
      {loading ? <p role="status" className="mt-4 text-sm text-muted">Checking the returned eBay listings for matching cars and clear asking prices…</p>
        : error ? <p role="status" className="mt-4 text-sm text-warning">The price shortlist is temporarily unavailable. Use the marketplace links below or retry the eBay results.</p>
          : recommendations.length === 0 ? <p role="status" className="mt-4 text-sm leading-6 text-muted">We couldn’t identify a matching full-car listing with a clear GBP asking price in these results. Try another year or budget, or compare the marketplaces below.</p>
            : <>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recommendations.map(({ item, url, pricePence, belowBudgetPence, purchaseFormat }, index) => <a
                  key={item.id} href={withEbayAffiliateTracking(url, "mekivo-cars-shortlist")}
                  target="_blank" rel="sponsored noreferrer"
                  onClick={() => trackGrowthEvent("marketplace_outbound", { marketplace: "ebay", search_type: "cars", destination: "listing" })}
                  className="flex min-w-0 flex-col rounded-2xl border border-outline/15 bg-panel p-3 transition hover:border-sky-400/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
                >
                  <ListingPhoto item={item} />
                  <p className="mt-3 text-xs font-semibold text-link">{index === 0 ? "Lowest in this shortlist" : `Price option ${index + 1}`} · eBay</p>
                  <h3 className="mt-2 line-clamp-3 text-sm font-bold leading-5">{item.title}</h3>
                  <p className="mt-3 text-2xl font-black">{pounds.format(pricePence / 100)}</p>
                  <p className="mt-1 text-xs text-subtle">Advertised price · {purchaseFormat}</p>
                  {belowBudgetPence !== null && <p className="mt-2 text-xs font-semibold text-success">{pounds.format(belowBudgetPence / 100)} below your maximum</p>}
                  <p className="mt-2 text-xs leading-5 text-subtle">{[item.condition, item.location].filter(Boolean).join(" · ") || "Confirm condition and location with the seller"}</p>
                  <span className="mt-auto pt-4 text-sm font-bold text-link">View original eBay listing →</span>
                </a>)}
              </div>
              <p className="mt-4 text-xs leading-5 text-subtle">Up to 3 title matches from {items.length} returned eBay listings, ordered by advertised price. Delivery and extra fees are not included. Check the full asking price, mileage, history and availability with the seller. Mekivo may earn a commission.</p>
            </>}
    </>}
  </section>;
}
