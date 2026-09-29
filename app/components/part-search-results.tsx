"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { EbayListing, SubmittedSearch } from "../lib/search";
import EbayResults from "./ebay-results";
import PartRecommendations from "./part-recommendations";
import SaveButton from "./save-button";
import { getSavedSearchUrl } from "../lib/saved-search";

const tabs = [{ id: "live", label: "Live parts" }, { id: "prices", label: "Price picks" }] as const;
type View = typeof tabs[number]["id"];

export default function PartSearchResults({ search, items, loading, error, onRetry, onEdit }: {
  search: SubmittedSearch; items: EbayListing[]; loading: boolean; error: string;
  onRetry: () => void; onEdit: () => void;
}) {
  const [view, setView] = useState<View>("live");
  const toolbarRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<View, HTMLButtonElement>>>({});
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="break-words text-lg font-bold sm:text-xl">{search.title}</h2><p className="mt-1 text-xs text-muted">Live listings from eBay · check fit before buying</p></div>
        <button type="button" onClick={onEdit} className="min-h-11 shrink-0 rounded-xl border border-outline/15 px-3 py-2 text-sm font-semibold text-link hover:bg-overlay/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">Edit search</button>
      </div>
      <div role="tablist" aria-label="Parts results views" className="mt-3 flex gap-1">
        {tabs.map((tab, index) => <button key={tab.id} type="button" role="tab" id={`part-tab-${tab.id}`} aria-controls={`part-panel-${tab.id}`}
          aria-selected={view === tab.id} tabIndex={view === tab.id ? 0 : -1}
          ref={element => { tabRefs.current[tab.id] = element || undefined; }}
          onClick={() => changeView(tab.id)} onKeyDown={event => handleTabKey(event, index)}
          className={`min-h-11 flex-1 rounded-t-xl border-b-2 px-2 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-sky-400 ${view === tab.id ? "border-sky-400 bg-sky-400/10 text-link" : "border-transparent text-muted hover:bg-overlay/5 hover:text-foreground"}`}>{tab.label}</button>)}
      </div>
    </div>
    {tabs.map(tab => <div key={tab.id} id={`part-panel-${tab.id}`} role="tabpanel" aria-labelledby={`part-tab-${tab.id}`} tabIndex={0} hidden={view !== tab.id} className="rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-sky-400">
      {tab.id === "live" ? <EbayResults items={items} loading={loading} error={error} fallbackUrl={search.fallbackUrl} searchUrl={getSavedSearchUrl(search.saveItem)} searchType="parts" onRetry={onRetry} />
        : <PartRecommendations search={search} items={items} loading={loading} error={error} />}
    </div>)}
    <SaveButton item={search.saveItem} label="Save search" />
  </>;
}
