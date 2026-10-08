import { NextRequest, NextResponse } from "next/server";
import { getApplicationToken, clearEbayApplicationToken } from "../../../lib/server-ebay-token";
import { createHash } from "node:crypto";
import { BoundedTtlCache } from "../../../lib/server-cache";
import { UpstreamTimeoutError, withUpstreamTimeout } from "../../../lib/server-upstream";
import { filterCarListings, type CarListingFilters } from "../../../lib/car-filters";

export const runtime = "nodejs";

type EbayItemSummary = {
  itemId?: string;
  title?: string;
  itemWebUrl?: string;
  image?: { imageUrl?: string };
  price?: { value?: string; currency?: string };
  buyingOptions?: string[];
  itemEndDate?: string;
  condition?: string;
  itemLocation?: { postalCode?: string; country?: string };
  shippingOptions?: { shippingCostType?: string; shippingCost?: { value?: string; currency?: string } }[];
};

type PublicListing = {
  id: string; title: string; url: string; image: string | null; price: string | null;
  currency: string | null; condition: string | null; location: string | null;
  buyingOptions: string[]; itemEndDate: string | null;
  postage: { price: string; currency: string } | null;
};
type SearchInfo = { checkedCount: number; pagesChecked: number; hasMore: boolean; partial: boolean };
type SearchResult = { items: PublicListing[]; searchInfo?: SearchInfo };
const resultsCache = new BoundedTtlCache<SearchResult>(100, 30_000);
const maxCarPages = 4;
const carSorts = { best_match: "", price_asc: "price", price_desc: "-price", newest: "newlyListed" } as const;

function cacheKey(query: string, type: string, minPrice: string, maxPrice: string, sort: string, hideUnwanted: boolean, make: string, model: string, vehicleType: string) {
  // Do not retain searches resembling a registration or VIN. Keys for ordinary
  // catalogue searches are hashed; no caller identity is included in the cache.
  const searchTerms = [query, make, model].join(" ");
  if (/\b[A-HJ-NPR-Z0-9]{17}\b|\b[A-Z]{2}\d{2}\s?[A-Z]{3}\b|\b[A-Z]\d{1,3}\s?[A-Z]{3}\b|\b[A-Z]{3}\s?\d{1,3}[A-Z]\b/i.test(searchTerms)) return null;
  const registrationCandidates = searchTerms.matchAll(/\b(?:[A-Z]{1,3}\s?\d{1,4}|\d{1,4}\s?[A-Z]{1,3})\b/gi);
  if ([...registrationCandidates].some(([candidate]) => candidate.replace(/\s/g, "").length >= 5)) return null;
  return createHash("sha256").update(JSON.stringify([query.toLowerCase(), type, minPrice, maxPrice, sort, hideUnwanted, make.toLowerCase(), model.toLowerCase(), vehicleType])).digest("hex");
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().replace(/\s+/g, " ") ?? "";
  const type = request.nextUrl.searchParams.get("type") ?? "parts";
  const vehicleInput = type === "cars" ? request.nextUrl.searchParams.get("vehicleType") ?? "cars" : "cars";
  if (vehicleInput !== "cars" && vehicleInput !== "motorbikes") return json({ error: "Choose cars or motorbikes." }, 400);
  const vehicleType = vehicleInput;
  const priceInput = type === "cars" ? request.nextUrl.searchParams.get("maxPrice")?.trim() ?? "" : "";
  const minimumInput = type === "cars" ? request.nextUrl.searchParams.get("minPrice")?.trim() ?? "" : "";
  const sortInput = type === "cars" ? request.nextUrl.searchParams.get("sort") ?? "best_match" : "best_match";
  const hideInput = type === "cars" ? request.nextUrl.searchParams.get("hideUnwanted") ?? "0" : "0";
  const make = type === "cars" ? (request.nextUrl.searchParams.get("make") ?? "").trim().replace(/\s+/g, " ") : "";
  const model = type === "cars" ? (request.nextUrl.searchParams.get("model") ?? "").trim().replace(/\s+/g, " ") : "";
  if (type !== "cars" && type !== "parts") return json({ error: "Choose cars or parts." }, 400);
  if (make.length > 60 || model.length > 60) return json({ error: "Enter a make and model of up to 60 characters each." }, 400);
  // An empty car query searches the Cars category across makes. Parts still
  // require a useful keyword/number; a one-character query is never useful.
  if ((query.length < 2 && !(type === "cars" && query.length === 0)) || query.length > 160) {
    return json({ error: "Enter a search between 2 and 160 characters." }, 400);
  }
  if (priceInput && (!/^\d+(?:\.\d{1,2})?$/.test(priceInput) || Number(priceInput) <= 0 || Number(priceInput) > 100_000_000)) {
    return json({ error: "Enter a valid maximum price in pounds." }, 400);
  }
  if (minimumInput && (!/^\d+(?:\.\d{1,2})?$/.test(minimumInput) || Number(minimumInput) > 100_000_000)) {
    return json({ error: "Enter a valid minimum price in pounds." }, 400);
  }
  if (minimumInput && priceInput && Number(minimumInput) > Number(priceInput)) {
    return json({ error: "Minimum price must not be higher than maximum price." }, 400);
  }
  if (!Object.hasOwn(carSorts, sortInput)) return json({ error: "Choose a valid car sort order." }, 400);
  if (!["0", "1", "false", "true"].includes(hideInput)) return json({ error: "Choose whether to hide unwanted car adverts." }, 400);
  const minPrice = minimumInput ? String(Number(minimumInput)) : "";
  const maxPrice = priceInput ? String(Number(priceInput)) : "";
  const sort = carSorts[sortInput as keyof typeof carSorts];
  const hideUnwanted = hideInput === "1" || hideInput === "true";
  const limit = type === "cars" ? 48 : 12;
  const key = cacheKey(query, type, minPrice, maxPrice, sort, hideUnwanted, make, model, vehicleType);
  const cachedResult = key ? resultsCache.get(key) : undefined;
  if (cachedResult) return json(cachedResult);
  const collected: PublicListing[] = [];
  const searchInfo: SearchInfo | undefined = type === "cars"
    ? { checkedCount: 0, pagesChecked: 0, hasMore: false, partial: false }
    : undefined;
  const carFilters: CarListingFilters = { minPrice, maxPrice, sort: sortInput as keyof typeof carSorts, hideUnwanted, make, model, vehicleType };
  const result = (): SearchResult => ({
    items: (type === "cars" ? filterCarListings(collected, carFilters) as PublicListing[] : collected).slice(0, limit),
    ...(searchInfo ? { searchInfo } : {}),
  });

  try {
    const token = await getApplicationToken();
    const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
    if (query) url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));
    // eBay UK: Cars (9801), Motorcycles & Scooters (422), Car Parts (6030).
    // Category 32073 belongs to a different marketplace, not the UK bike tree.
    url.searchParams.set("category_ids", type === "cars" ? vehicleType === "motorbikes" ? "422" : "9801" : "6030");
    if (type === "cars") {
      // Selecting the UK marketplace alone can include overseas listings.
      // Restrict the provider's candidate set before sorting or taking a page.
      const filters = ["itemLocationCountry:GB"];
      if (minPrice || maxPrice) {
        const range = maxPrice ? `${minPrice}..${maxPrice}` : minPrice;
        filters.push(`price:[${range}]`, "priceCurrency:GBP");
      }
      url.searchParams.set("filter", filters.join(","));
    }
    // Sort the provider's catalogue before taking a page. eBay price order
    // includes shipping; it is not a guarantee of the cheapest complete car.
    if (type === "cars" && sort) url.searchParams.set("sort", sort);
    // The same car checks run here and in the client, so hidden adverts do not
    // consume the whole returned batch. Browse buyingOptions filters require
    // a leaf category rather than our broad Cars category.

    await withUpstreamTimeout(async (signal) => {
      const seen = new Set<string>();
      for (let page = 0; page < (type === "cars" ? maxCarPages : 1); page++) {
        if (signal.aborted) throw new UpstreamTimeoutError();
        // next only indicates another page. Rebuild the trusted endpoint with
        // a bounded offset; never follow a provider-supplied URL with our token.
        const pageUrl = new URL(url);
        if (type === "cars") pageUrl.searchParams.set("offset", String(page * limit));
        const response = await fetch(pageUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
            "Accept-Language": "en-GB",
          },
          cache: "no-store",
          signal,
        });
        if (signal.aborted) throw new UpstreamTimeoutError();

        if (!response.ok) {
          if (response.status === 401) clearEbayApplicationToken();
          // Log only provider status, never a caller's search or identifier.
          throw new Error(`EBAY_SEARCH_${response.status}`);
        }

        const payload = (await response.json()) as { itemSummaries?: EbayItemSummary[]; next?: unknown };
        if (signal.aborted) throw new UpstreamTimeoutError();
        if (!payload || typeof payload !== "object" || Array.isArray(payload) || (payload.itemSummaries !== undefined && !Array.isArray(payload.itemSummaries))) throw new Error("EBAY_RESULTS_INVALID");
        const candidates = type === "cars" ? (payload.itemSummaries ?? []).slice(0, limit) : payload.itemSummaries ?? [];
        if (searchInfo) {
          searchInfo.checkedCount += candidates.length;
          searchInfo.pagesChecked++;
          searchInfo.hasMore = typeof payload.next === "string" && payload.next.trim().length > 0;
        }
        const batch: PublicListing[] = candidates
          .filter((item) => item && typeof item.title === "string" && typeof item.itemWebUrl === "string" && item.title && item.itemWebUrl)
          .slice(0, limit)
          .map((item) => ({
            id: item.itemId ?? item.itemWebUrl!,
            title: item.title!,
            url: item.itemWebUrl!,
            image: item.image?.imageUrl ?? null,
            price: item.price?.value ?? null,
            currency: item.price?.currency ?? null,
            // price is the advertised purchase price. Never substitute the
            // separate currentBidPrice when building a price comparison.
            buyingOptions: Array.isArray(item.buyingOptions) ? item.buyingOptions.filter((option): option is string => typeof option === "string") : [],
            itemEndDate: typeof item.itemEndDate === "string" ? item.itemEndDate : null,
            condition: item.condition ?? null,
            location: item.itemLocation?.postalCode ?? item.itemLocation?.country ?? null,
            // Search summaries are not a quote for the customer's address. Only
            // expose an explicitly fixed amount; absent/calculated is unknown.
            postage: fixedPostage(item.shippingOptions),
          }));
        const unique = type === "cars" ? batch.filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        }) : batch;
        collected.push(...(type === "cars" ? filterCarListings(unique, carFilters) as PublicListing[] : unique));
        // total is indicative in Browse and must not control pagination.
        if (type !== "cars" || collected.length >= limit || !searchInfo?.hasMore || candidates.length === 0) break;
      }
    });

    const completeResult = result();
    if (key) resultsCache.set(key, completeResult);
    return json(completeResult);
  } catch (error) {
    if (searchInfo && collected.length > 0) {
      // A later backfill failure should not erase successfully checked cars.
      // Do not cache this incomplete response, including its metadata.
      searchInfo.partial = true;
      searchInfo.hasMore = true;
      return json(result());
    }
    if (error instanceof UpstreamTimeoutError) {
      return json({ error: "eBay search took too long. Please try again." }, 504);
    }
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "EBAY_NOT_CONFIGURED") {
      return json({ error: "Live eBay search is not configured yet." }, 503);
    }
    console.error("eBay integration error", /^EBAY_[A-Z_0-9]+$/.test(message) ? message : "UPSTREAM_FAILURE");
    return json({ error: "eBay search is temporarily unavailable." }, 502);
  }
}

function fixedPostage(options: EbayItemSummary["shippingOptions"]): PublicListing["postage"] {
  if (!Array.isArray(options) || !options.length) return null;
  const option = options[0];
  const value = option?.shippingCost?.value, currency = option?.shippingCost?.currency;
  if (option?.shippingCostType !== "FIXED" || typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value) || typeof currency !== "string") return null;
  return { price: value, currency };
}
