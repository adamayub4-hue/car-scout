import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BoundedTtlCache } from "../../../lib/server-cache";
import { getApplicationToken, clearEbayApplicationToken } from "../../../lib/server-ebay-token";
import { withUpstreamTimeout, UpstreamTimeoutError } from "../../../lib/server-upstream";
import { createSavedListing, parseSavedListing } from "../../../lib/saved-listings";
import type { EbayListing } from "../../../lib/search";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
type Details = { item: EbayListing | null; checkedAt: string; unavailable?: true };
const cache = new BoundedTtlCache<Details>(200, 5 * 60_000);
const pending = new Map<string, Promise<Details>>();
// Instance-local abuse brake; not a distributed quota guarantee.
const activity = new BoundedTtlCache<{ count: number }>(500, 60_000);
class ListingError extends Error { constructor(public status: number, message: string) { super(message); } }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

async function checkOwnership(authorization: string | null, id: string) {
  const token = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token || token.length > 8192) throw new ListingError(401, "Sign in to view your saved listing.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new ListingError(503, "Accounts are temporarily unavailable.");
  await withUpstreamTimeout(async signal => {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal }) },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) throw new ListingError(error && ![400, 401, 403].includes(error.status || 0) ? 503 : 401, "Please sign in again to load this listing.");
    const rate = activity.get(data.user.id);
    if (rate && rate.count >= 60) throw new ListingError(429, "Please wait a minute before checking more saved listings.");
    if (rate) rate.count++; else activity.set(data.user.id, { count: 1 });
    // The owner role can read customer rows, so the user filter is mandatory.
    const saved = await client.from("saved_items").select("kind,title,data").eq("user_id", data.user.id)
      .in("kind", ["car_listing", "part_listing"]).eq("data->>id", id).limit(1);
    if (signal.aborted) throw new UpstreamTimeoutError();
    if (saved.error) throw new ListingError(503, "Your saved listing could not be checked. Try again.");
    if (!saved.data?.some(row => parseSavedListing(row)?.data.id === id)) throw new ListingError(404, "This listing is not saved in your account.");
  });
}

async function loadDetails(id: string): Promise<Details> {
  const token = await getApplicationToken();
  const [legacy, variation = "0"] = id.split(":");
  return withUpstreamTimeout(async signal => {
    const response = await fetch(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(`v1|${legacy}|${variation}`)}`, {
      headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB", "Accept-Language": "en-GB" }, cache: "no-store", signal,
    });
    const checkedAt = new Date().toISOString();
    if (response.status === 404 || response.status === 410) return { item: null, checkedAt, unavailable: true };
    if (!response.ok) {
      if (response.status === 401) clearEbayApplicationToken();
      throw new ListingError(502, "The latest eBay details are temporarily unavailable.");
    }
    const payload = await response.json();
    if (!payload || typeof payload !== "object") throw new ListingError(502, "eBay returned incomplete listing details.");
    if ((payload.itemEndDate && Date.parse(payload.itemEndDate) <= Date.now()) || payload.estimatedAvailabilities?.some((entry: { estimatedAvailabilityStatus?: string }) => entry.estimatedAvailabilityStatus === "OUT_OF_STOCK")) return { item: null, checkedAt, unavailable: true };
    const shipping = payload.shippingOptions?.[0];
    const normalized = createSavedListing({
      id: payload.itemId, title: payload.title, url: payload.itemWebUrl,
      image: payload.image?.imageUrl ?? null, price: payload.price?.value ?? null, currency: payload.price?.currency ?? null,
      condition: payload.condition ?? null, location: payload.itemLocation?.postalCode ?? payload.itemLocation?.country ?? null,
      itemEndDate: payload.itemEndDate ?? null,
      postage: shipping?.shippingCostType === "FIXED" ? { price: shipping.shippingCost?.value, currency: shipping.shippingCost?.currency } : null,
    }, "parts");
    if (!normalized || normalized.data.id !== id) throw new ListingError(502, "eBay returned incomplete listing details.");
    return { item: { ...normalized.data, title: normalized.title }, checkedAt };
  });
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams, id = params.get("id") || "";
    if (params.getAll("id").length !== 1 || !/^\d{9,15}(?::\d{1,20})?$/.test(id)) return json({ error: "Choose a saved listing." }, 400);
    await checkOwnership(request.headers.get("authorization"), id);
    const cached = cache.get(id);
    if (cached) return json(cached);
    let work = pending.get(id);
    if (!work) {
      work = loadDetails(id).then(result => { cache.set(id, result); return result; }).finally(() => { pending.delete(id); });
      pending.set(id, work);
    }
    return json(await work);
  } catch (error) {
    if (error instanceof ListingError) return json({ error: error.message }, error.status);
    if (error instanceof UpstreamTimeoutError) return json({ error: "The listing check took too long. Please try again." }, 504);
    return json({ error: "The latest listing details are temporarily unavailable. Your bookmark is still saved." }, 502);
  }
}
