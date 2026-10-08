"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { formatListingPrice, withEbayAffiliateTracking } from "../lib/search";
import { createSavedListing, savedListingLabel, savedListingSearchType, type SavedListingItem } from "../lib/saved-listings";
import { getSupabaseBrowserClient } from "../lib/supabase";
import { withRequestDeadline } from "../lib/saved-search";
import { partPostageLabel } from "../lib/part-recommendations";
import { trackGrowthEvent } from "../lib/growth-events";

type ListingDetails = {
  key: string;
  status: "loading" | "ready" | "unavailable" | "error";
  item?: SavedListingItem;
  checkedAt?: number;
};
const MAX_DETAILS_AGE = 6 * 60 * 60 * 1_000;

export default function SavedListingCard({ item, savedAt, userId, action }: { item: SavedListingItem; savedAt?: string; userId?: string; action?: ReactNode }) {
  const [failedImage, setFailedImage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [details, setDetails] = useState<ListingDetails | null>(null);
  const isCar = item.kind === "car_listing";
  const searchType = savedListingSearchType(item);
  const listingLabel = savedListingLabel(item);
  const savedDate = savedAt ? new Date(savedAt) : null;
  const key = `${userId || ""}:${item.data.id}`;

  useEffect(() => {
    if (!savedAt || !userId) return;
    let active = true;
    let expiresAt = 0;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const expire = () => {
      if (!active) return;
      setDetails({ key, status: "loading" });
      setRefresh(value => value + 1);
    };
    const visible = () => { if (document.visibilityState === "visible" && expiresAt && Date.now() >= expiresAt) expire(); };
    document.addEventListener("visibilitychange", visible);
    const load = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) throw new Error("Account unavailable");
        const { data, error } = await withRequestDeadline(supabase.auth.getSession());
        if (error || !data.session?.access_token || data.session.user.id !== userId) throw error || new Error("Account changed");
        if (!active) return;
        const response = await withRequestDeadline(fetch(`/api/ebay/saved-listing?id=${encodeURIComponent(item.data.id)}`, { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store", signal: controller.signal }));
        if (!response.ok) throw new Error("Listing details could not be checked");
        const result = await withRequestDeadline(response.json());
        if (!active) return;
        if (result.unavailable === true && result.item === null) {
          setDetails({ key, status: "unavailable" });
          return;
        }
        const fresh = createSavedListing(result.item, searchType, item.data.searchUrl);
        const checkedAt = typeof result.checkedAt === "string" ? Date.parse(result.checkedAt) : NaN;
        if (!fresh || fresh.data.id !== item.data.id || !Number.isFinite(checkedAt) || checkedAt > Date.now() + 300_000 || Date.now() - checkedAt >= MAX_DETAILS_AGE) throw new Error("Listing details are out of date");
        expiresAt = checkedAt + MAX_DETAILS_AGE;
        setDetails({ key, status: "ready", item: fresh, checkedAt });
        expiryTimer = setTimeout(expire, Math.max(1, expiresAt - Date.now()));
      } catch {
        if (active) setDetails({ key, status: "error" });
      } finally { controller.abort(); }
    };
    void load();
    return () => { active = false; controller.abort(); if (expiryTimer) clearTimeout(expiryTimer); document.removeEventListener("visibilitychange", visible); };
  }, [savedAt, userId, key, item.data.id, item.data.searchUrl, searchType, refresh]);

  const current = details?.key === key ? details : null;
  // Saved rows contain a bookmark only. Provider details must come from a fresh,
  // authenticated check, never an old database snapshot.
  const shown = savedAt ? current?.status === "ready" ? current.item : null : item;
  const retry = () => { setDetails({ key, status: "loading" }); setRefresh(value => value + 1); };

  return (
    <article className="rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5">
      <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-overlay/[0.06]">
          {shown?.data.image && failedImage !== shown.data.image ? <Image src={shown.data.image} alt={shown.title} fill sizes="(max-width: 639px) 85vw, 144px" className="object-contain" onError={() => setFailedImage(shown.data.image || "")} /> : <span className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-subtle">{savedAt && (!current || current.status === "loading") ? "Checking listing…" : "Photo unavailable"}</span>}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-link">{listingLabel === "motorbike" ? "Motorbike listing" : isCar ? "Car listing" : "Part listing"} · eBay</p>
          <h2 className="mt-2 break-words font-bold">{shown?.title || item.title}</h2>
          {shown && <><p className="mt-2 text-lg font-bold">{formatListingPrice(shown.data.price, shown.data.currency)}</p><p className="mt-1 text-xs text-subtle">{savedAt ? "Latest checked price" : "Price shown when selected"}{!isCar ? " · Item price" : ""}</p>{savedAt && current?.checkedAt && <p className="mt-1 text-xs text-subtle">Checked {new Date(current.checkedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</p>}{!isCar && <p className="mt-1 text-xs text-subtle">{partPostageLabel({ ...shown.data, title: shown.title })}</p>}<p className="mt-2 text-sm text-muted">{[shown.data.condition, shown.data.location].filter(Boolean).join(" · ") || "Condition: check the original listing"}</p></>}
          {savedDate && !Number.isNaN(savedDate.getTime()) && <p className="mt-2 text-xs text-subtle">Saved {savedDate.toLocaleDateString("en-GB")}</p>}
          {savedAt && (!current || current.status === "loading") && <p role="status" className="mt-2 text-sm text-muted">Checking the latest listing details…</p>}
          {savedAt && current?.status === "unavailable" && <p className="mt-2 text-sm text-muted">This listing is no longer available from eBay. Your saved link is still here; try a similar search.</p>}
          {savedAt && current?.status === "error" && <p role="status" className="mt-2 text-sm text-muted">We could not check this listing right now. Your saved link has not been removed.</p>}
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-muted">Prices and availability can change, and listings may end. Confirm {isCar ? "the vehicle details" : "compatibility and postage"} with the seller. Mekivo may earn a commission.</p>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-semibold">
        <a href={withEbayAffiliateTracking(item.data.url, `mekivo-${searchType}-saved`)} target="_blank" rel="sponsored noreferrer" onClick={() => trackGrowthEvent("marketplace_outbound", { marketplace: "ebay", search_type: searchType, destination: "listing" })} className="text-link">View original listing →</a>
        <Link href={item.data.searchUrl} className="text-link">Search for similar {searchType} →</Link>
        {savedAt && (current?.status === "error" || current?.status === "unavailable") && <button type="button" onClick={retry} className="text-link">Check listing again</button>}
        {action}
      </div>
    </article>
  );
}
