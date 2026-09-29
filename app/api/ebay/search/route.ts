import { NextRequest, NextResponse } from "next/server";
import { getApplicationToken, clearEbayApplicationToken } from "../../../lib/server-ebay-token";
import { createHash } from "node:crypto";
import { BoundedTtlCache } from "../../../lib/server-cache";
import { UpstreamTimeoutError, withUpstreamTimeout } from "../../../lib/server-upstream";

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
const resultsCache = new BoundedTtlCache<PublicListing[]>(100, 30_000);

function cacheKey(query: string, type: string, maxPrice: string) {
  // Do not retain searches resembling a registration or VIN. Keys for ordinary
  // catalogue searches are hashed; no caller identity is included in the cache.
  if (/\b[A-HJ-NPR-Z0-9]{17}\b|\b[A-Z]{2}\d{2}\s?[A-Z]{3}\b|\b[A-Z]\d{1,3}\s?[A-Z]{3}\b|\b[A-Z]{3}\s?\d{1,3}[A-Z]\b/i.test(query)) return null;
  const registrationCandidates = query.matchAll(/\b(?:[A-Z]{1,3}\s?\d{1,4}|\d{1,4}\s?[A-Z]{1,3})\b/gi);
  if ([...registrationCandidates].some(([candidate]) => candidate.replace(/\s/g, "").length >= 5)) return null;
  return createHash("sha256").update(JSON.stringify([query.toLowerCase(), type, maxPrice])).digest("hex");
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
  const priceInput = type === "cars" ? request.nextUrl.searchParams.get("maxPrice")?.trim() ?? "" : "";
  if (query.length < 2 || query.length > 160) {
    return json({ error: "Enter a search between 2 and 160 characters." }, 400);
  }
  if (type !== "cars" && type !== "parts") return json({ error: "Choose cars or parts." }, 400);
  if (priceInput && (!/^\d+(?:\.\d{1,2})?$/.test(priceInput) || Number(priceInput) <= 0 || Number(priceInput) > 100_000_000)) {
    return json({ error: "Enter a valid maximum price in pounds." }, 400);
  }
  const maxPrice = priceInput ? String(Number(priceInput)) : "";
  const key = cacheKey(query, type, maxPrice);
  const cachedItems = key ? resultsCache.get(key) : undefined;
  if (cachedItems) return json({ items: cachedItems });

  try {
    const token = await getApplicationToken();
    const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "12");
    // eBay UK: Cars (9801) and Vehicle Parts & Accessories (6030).
    url.searchParams.set("category_ids", type === "cars" ? "9801" : "6030");
    if (type === "cars" && maxPrice && Number(maxPrice) > 0) {
      url.searchParams.set("filter", `price:[..${maxPrice}],priceCurrency:GBP`);
    }

    const items = await withUpstreamTimeout(async (signal) => {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
          "Accept-Language": "en-GB",
        },
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        if (response.status === 401) clearEbayApplicationToken();
        // Log only provider status, never a caller's search or identifier.
        throw new Error(`EBAY_SEARCH_${response.status}`);
      }

      const payload = (await response.json()) as { itemSummaries?: EbayItemSummary[] };
      if (!payload || (payload.itemSummaries !== undefined && !Array.isArray(payload.itemSummaries))) throw new Error("EBAY_RESULTS_INVALID");
      return (payload.itemSummaries ?? [])
        .filter((item) => item && typeof item.title === "string" && typeof item.itemWebUrl === "string" && item.title && item.itemWebUrl)
        .slice(0, 12)
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
    });

    if (key) resultsCache.set(key, items);
    return json({ items });
  } catch (error) {
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
