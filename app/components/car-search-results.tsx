"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { marketplaceFilterNote, type EbayListing, type MarketplaceId, type SubmittedSearch } from "../lib/search";
import { trackGrowthEvent } from "../lib/growth-events";
import CarRecommendations from "./car-recommendations";
import EbayResults from "./ebay-results";
import SaveButton from "./save-button";
import ShareSearchButton from "./share-search-button";
import { getSavedSearchUrl } from "../lib/saved-search";

const marketplaces = [
  { id: "autotrader", name: "Auto Trader" },
  { id: "facebook", name: "Facebook Marketplace" },
  { id: "motors", name: "MOTORS / Cazoo" },
  { id: "gumtree", name: "Gumtree" },
  { id: "cargurus", name: "CarGurus" },
  { id: "pistonheads", name: "PistonHeads" },
  { id: "aacars", name: "AA Cars" },
  { id: "carandclassic", name: "Car & Classic" },
] as const;
const moreMarketplaceIds: MarketplaceId[] = ["gumtree", "cargurus", "pistonheads", "aacars", "carandclassic"];
type View = "live" | "prices" | "marketplaces";
export type CarSearchInfo = { checkedCount: number; pagesChecked: number; hasMore: boolean; partial: boolean };

export default function CarSearchResults({ search, items, loading, error, searchInfo, onRetry, onEdit, onSortChange }: {
  search: SubmittedSearch; items: EbayListing[]; loading: boolean; error: string;
  searchInfo?: CarSearchInfo | null;
  onRetry: () => void; onEdit: () => void;
  onSortChange?: (sort: "best_match" | "price_asc" | "price_desc" | "newest") => void;
}) {
  const hasLiveListings = search.platform === "all" || search.platform === "ebay";
  const [view, setView] = useState<View>(hasLiveListings ? "live" : "marketplaces");
  const toolbarRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<View, HTMLButtonElement>>>({});
  const tabs: { id: View; label: string }[] = [
    ...(hasLiveListings ? [{ id: "live" as const, label: "Live cars" }, { id: "prices" as const, label: "Price picks" }] : []),
    ...(search.platform !== "ebay" ? [{ id: "marketplaces" as const, label: "Other sites" }] : []),
  ];
  const selectedMarketplaces = marketplaces.filter(item => search.platform === "all" || search.platform === item.id || (search.platform === "more" && moreMarketplaceIds.includes(item.id)));
  const money = (value: string) => `£${Number(value).toLocaleString("en-GB")}`;
  const budget = search.minPrice && search.maxPrice ? `${money(search.minPrice)}–${money(search.maxPrice)}` : search.maxPrice ? `Up to ${money(search.maxPrice)}` : search.minPrice ? `From ${money(search.minPrice)}` : "Any budget";
  const postcode = typeof search.saveItem.data.postcode === "string" ? search.saveItem.data.postcode : "";

  const changeView = (next: View) => {
    setView(next);
    toolbarRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  };
  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, current: number) => {
    let next: number;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (current + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    changeView(tabs[next].id);
    tabRefs.current[tabs[next].id]?.focus({ preventScroll: true });
  };

  return <>
    <div ref={toolbarRef} className="sticky top-0 z-20 scroll-mt-2 rounded-2xl border border-outline/15 bg-background/95 px-3 pt-3 shadow-lg shadow-black/10 backdrop-blur-md sm:px-5 sm:pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-bold sm:text-xl">{search.title}</h2>
          <p className="mt-1 text-xs text-muted">{budget}{postcode ? ` · ${postcode}` : ""}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-start gap-2 sm:shrink-0">
          <button type="button" onClick={onEdit} className="min-h-11 shrink-0 rounded-xl border border-outline/15 px-3 py-2 text-sm font-semibold text-link hover:bg-overlay/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">Edit search</button>
          <ShareSearchButton item={search.saveItem} />
        </div>
      </div>
      <div role="tablist" aria-label="Car results views" className="mt-3 flex gap-1">
        {tabs.map((tab, index) => <button key={tab.id} type="button" role="tab" id={`car-tab-${tab.id}`} aria-controls={`car-panel-${tab.id}`}
          aria-selected={view === tab.id} tabIndex={view === tab.id ? 0 : -1}
          ref={element => { tabRefs.current[tab.id] = element || undefined; }}
          onClick={() => changeView(tab.id)} onKeyDown={event => handleTabKey(event, index)}
          className={`min-h-11 flex-1 whitespace-nowrap rounded-t-xl border-b-2 px-1 py-3 text-[13px] font-semibold transition sm:px-2 sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-sky-400 ${view === tab.id ? "border-sky-400 bg-sky-400/10 text-link" : "border-transparent text-muted hover:bg-overlay/5 hover:text-foreground"}`}>{tab.label}</button>)}
      </div>
    </div>
    {tabs.map(tab => <div key={tab.id} id={`car-panel-${tab.id}`} role="tabpanel" aria-labelledby={`car-tab-${tab.id}`} tabIndex={0} hidden={view !== tab.id} className="rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-sky-400">
      {tab.id === "live" && <>
        {onSortChange && <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-muted">Sort live results
            <select value={search.carSort || "best_match"} onChange={event => onSortChange(event.target.value as Parameters<NonNullable<typeof onSortChange>>[0])} className="min-h-11 rounded-xl border border-outline/15 bg-panel px-3 py-2 text-foreground">
              <option value="price_asc">Lowest price first</option><option value="price_desc">Highest price first</option><option value="newest">Newly listed</option><option value="best_match">Best match</option>
            </select>
          </label>
          {search.hideUnwanted && <p className="text-xs text-muted">Parts, repair and deposit adverts hidden</p>}
        </div>}
        {!loading && !error && searchInfo?.partial && <div role="status" className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm text-warning">eBay stopped responding before this search finished. {items.length > 0 ? "These cars were returned successfully. " : "No matching cars have been returned yet. "}<button type="button" onClick={onRetry} className="font-semibold underline underline-offset-4">Try again for more</button>.</div>}
        {!loading && !error && items.length === 0 && <p className="mt-4 text-sm text-muted">No cars remain in the checked results with your filters. Try a different budget or make, choose Best match, or use Edit search to include repair adverts.</p>}
        {!loading && !error && items.length > 0 && <p className="mt-4 text-sm font-semibold text-muted">{items.length} matching {items.length === 1 ? "car" : "cars"} returned{items.length > 3 ? " · Use Next below to browse more" : ""}</p>}
        <EbayResults items={items} loading={loading} error={error} fallbackUrl={search.fallbackUrl} searchUrl={getSavedSearchUrl(search.saveItem)} searchType="cars" onRetry={onRetry} />
        <p className="mt-3 text-xs leading-5 text-subtle">{!loading && !error && searchInfo ? `${searchInfo.checkedCount} eBay listings checked across ${searchInfo.pagesChecked} ${searchInfo.pagesChecked === 1 ? "batch" : "batches"}. ${searchInfo.hasMore ? "More listings may be available on eBay. " : ""}` : "Up to 192 eBay listings located in the UK checked per search, returning up to 48 matches. "}Budgets and price sorts use advertised purchase prices, not auction bids; delivery and fees may be extra. This does not compare every UK marketplace.</p>
      </>}
      {tab.id === "prices" && <div className="pt-4"><CarRecommendations search={search} items={items} loading={loading} error={error} compact /></div>}
      {tab.id === "marketplaces" && <section aria-labelledby="other-car-sites-heading" className="pt-5">
        <h3 id="other-car-sites-heading" className="font-bold">Compare on other car sites</h3>
        <p className="mt-2 text-sm leading-6 text-muted">Open your prepared search in a new tab. These sites show their listings on their own websites; live listings inside Mekivo currently come from eBay.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {selectedMarketplaces.map(item => <div key={item.id} className="rounded-xl border border-outline/10 bg-overlay/[0.035] p-3 sm:p-4">
            <a href={search.carLinks?.[item.id]} target="_blank" rel="noreferrer"
              onClick={() => trackGrowthEvent("marketplace_outbound", { marketplace: item.id, search_type: "cars", destination: "search_results" })}
              className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400">
              <h4 className="min-h-10 text-sm font-bold sm:min-h-0">{item.name}</h4>
              <span className="mt-2 inline-block text-xs font-semibold text-link">Open search ↗</span>
            </a>
            <details className="mt-3 text-xs leading-5 text-subtle"><summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-sky-400">Filters carried across</summary><p className="mt-2">{marketplaceFilterNote(item.id)}</p></details>
          </div>)}
        </div>
      </section>}
    </div>)}
    <SaveButton item={search.saveItem} label="Save search" />
  </>;
}
