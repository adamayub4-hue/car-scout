import type { SupabaseClient } from "@supabase/supabase-js";
import { safeEbayListingUrl } from "./car-recommendations";
import { getSavedSearchUrl, parseSavedSearchParams, safeSearchReturnUrl, withRequestDeadline } from "./saved-search";
import { safeListingImage, type EbayListing, type SearchType } from "./search";

export type SavedListingData = {
  version: 1;
  id: string;
  url: string;
  image: string | null;
  price: string | null;
  currency: string | null;
  condition: string | null;
  location: string | null;
  postage: { price: string; currency: string } | null;
  itemEndDate: string | null;
  searchUrl: string;
};
export type SavedListingItem = {
  kind: "car_listing" | "part_listing";
  title: string;
  data: SavedListingData;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const PENDING_KEY = "mekivo:pending-listing:v1";
export const PENDING_LISTING_TTL = 24 * 60 * 60 * 1_000;
const LISTING_SNAPSHOT_TTL = 6 * 60 * 60 * 1_000;
const text = (value: unknown, max: number) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : "";
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const money = (value: unknown) => typeof value === "string" && /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value.trim()) ? value.trim() : null;
const currency = (value: unknown) => typeof value === "string" && /^[A-Z]{3}$/.test(value) ? value : null;

function listingIdentity(value: unknown, apiId?: unknown) {
  if (typeof value !== "string" || value.length > 4_096) return null;
  const safeUrl = safeEbayListingUrl(value);
  if (!safeUrl) return null;
  const original = new URL(safeUrl);
  const id = original.pathname.match(/\/(\d+)\/?$/)![1];
  const apiParts = typeof apiId === "string" ? apiId.match(/^v1\|(\d{9,15})\|(\d{1,20})$/) : null;
  const requestedVariation = original.searchParams.get("var");
  // A selected variation is part of the saved identity. Never retain tracking,
  // redirect, seller-supplied or arbitrary query parameters in saved links.
  const variation = requestedVariation && /^\d{1,20}$/.test(requestedVariation) && requestedVariation !== "0"
    ? requestedVariation : apiParts?.[1] === id && apiParts[2] !== "0" ? apiParts[2] : null;
  const url = new URL(`https://${original.hostname}/itm/${id}`);
  if (variation) url.searchParams.set("var", variation);
  return { id: variation ? `${id}:${variation}` : id, url: url.toString() };
}

function imageUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2_048) return null;
  const safe = safeListingImage(value);
  if (!safe) return null;
  const url = new URL(safe);
  return url.username || url.password ? null : safe;
}

function endDate(value: unknown) {
  if (typeof value !== "string" || value.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

/** Treat browser storage and database snapshots as untrusted input. */
export function parseSavedListing(value: unknown): SavedListingItem | null {
  const item = object(value), data = object(item?.data);
  if (!item || !data || (item.kind !== "car_listing" && item.kind !== "part_listing") || data.version !== 1) return null;
  const identity = listingIdentity(data.url);
  const title = text(item.title, 160);
  if (!identity || !title || data.id !== identity.id) return null;
  const shipping = object(data.postage);
  const shippingPrice = money(shipping?.price), shippingCurrency = currency(shipping?.currency);
  return {
    kind: item.kind,
    title,
    data: {
      version: 1, ...identity,
      image: imageUrl(data.image), price: money(data.price), currency: currency(data.currency),
      condition: text(data.condition, 120) || null, location: text(data.location, 120) || null,
      postage: shippingPrice !== null && shippingCurrency ? { price: shippingPrice, currency: shippingCurrency } : null,
      itemEndDate: endDate(data.itemEndDate),
      searchUrl: safeSearchReturnUrl(typeof data.searchUrl === "string" && data.searchUrl.length <= 4_096 ? data.searchUrl : null) || `/?mode=${item.kind === "car_listing" ? "cars" : "parts"}`,
    },
  };
}

export function createSavedListing(item: EbayListing, searchType: SearchType, searchUrl?: string): SavedListingItem | null {
  if (!item || (searchType !== "cars" && searchType !== "motorbikes" && searchType !== "parts")) return null;
  const identity = listingIdentity(item.url, item.id);
  if (!identity) return null;
  if (searchType === "motorbikes") {
    const safe = safeSearchReturnUrl(searchUrl || null);
    const restored = safe ? parseSavedSearchParams(new URL(safe, "https://mekivo.uk").searchParams) : null;
    searchUrl = getSavedSearchUrl({ kind: "car_search", title: "Motorbike search", data: { ...(restored?.mode === "cars" ? restored : {}), vehicleType: "motorbikes", platform: "ebay" } });
  }
  return parseSavedListing({ kind: searchType === "parts" ? "part_listing" : "car_listing", title: item.title, data: { ...item, ...identity, version: 1, searchUrl } });
}

export function savedListingSearchType(item: SavedListingItem): SearchType {
  if (item.kind === "part_listing") return "parts";
  try {
    const search = parseSavedSearchParams(new URL(item.data.searchUrl, "https://mekivo.uk").searchParams);
    return search?.vehicleType === "motorbikes" ? "motorbikes" : "cars";
  } catch { return "cars"; }
}

export function savedListingLabel(item: SavedListingItem): "car" | "motorbike" | "part" {
  const type = savedListingSearchType(item);
  return type === "motorbikes" ? "motorbike" : type === "cars" ? "car" : "part";
}

function bookmark(item: SavedListingItem) {
  const search = parseSavedSearchParams(new URL(item.data.searchUrl, "https://mekivo.uk").searchParams);
  const context = search ? [search.year, search.make, search.model, ...(item.kind === "part_listing" ? [search.partNumber || search.part || search.partCategory] : [])].filter(Boolean).join(" ") : "";
  return {
    kind: item.kind,
    title: text(context, 160) || `Saved ${savedListingLabel(item)}`,
    data: { version: 1 as const, id: item.data.id, url: item.data.url, searchUrl: item.data.searchUrl },
  };
}

/** Read/insert only: users have no UPDATE permission on saved_items.
 * Store the bookmark and user's search context, not indefinite eBay content.
 * The account refreshes listing details through the authenticated API.
 */
export async function saveListingToAccount(client: SupabaseClient, userId: string, value: SavedListingItem): Promise<{ id: string; alreadySaved: boolean }> {
  const item = parseSavedListing(value);
  if (!item || !userId) throw new Error("Invalid saved listing");
  const confirmedId = (row: unknown) => {
    const record = object(row), saved = parseSavedListing(row);
    return record && typeof record.id === "string" && record.id && record.user_id === userId && saved?.kind === item.kind && saved.data.id === item.data.id ? record.id : null;
  };
  const find = async () => {
    const result = await withRequestDeadline(client.from("saved_items").select("id,user_id,kind,title,data").eq("user_id", userId).eq("kind", item.kind).eq("data->>id", item.data.id).maybeSingle());
    if (result.error) throw result.error;
    if (!result.data) return null;
    const id = confirmedId(result.data);
    if (!id) throw new Error("Could not verify saved listing");
    return id;
  };
  const existing = await find();
  if (existing) return { id: existing, alreadySaved: true };
  const result = await withRequestDeadline(client.from("saved_items").insert({ user_id: userId, ...bookmark(item) }).select("id,user_id,kind,title,data").single());
  if (result.error && result.error.code !== "23505") throw result.error;
  const inserted = result.error ? null : confirmedId(result.data);
  if (inserted) return { id: inserted, alreadySaved: false };
  // Concurrent tabs can reach INSERT together. The database unique index is
  // authoritative; re-read the winning row rather than requiring an upsert.
  const verified = await find();
  if (!verified) throw new Error("Could not confirm this listing was saved");
  return { id: verified, alreadySaved: Boolean(result.error) };
}

function storageOrNull(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}

type PendingListing = { version: 1; token: string; createdAt: number; item: SavedListingItem };
function pending(storage: StorageLike | null, now: number): PendingListing | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PENDING_KEY);
    if (!raw) return null;
    if (raw.length > 16_384) { storage.removeItem(PENDING_KEY); return null; }
    const entry = object(JSON.parse(raw));
    const item = parseSavedListing(entry?.item);
    if (entry?.version !== 1 || typeof entry.token !== "string" || !/^[a-f0-9-]{36}$/.test(entry.token) || typeof entry.createdAt !== "number" || !Number.isSafeInteger(entry.createdAt) || entry.createdAt > now || now - entry.createdAt >= PENDING_LISTING_TTL || !item) {
      storage.removeItem(PENDING_KEY);
      return null;
    }
    const current = now - entry.createdAt >= LISTING_SNAPSHOT_TTL ? parseSavedListing(bookmark(item))! : item;
    if (current !== item) {
      // A return after several hours keeps the user's bookmark intent while
      // discarding old marketplace details from the browser's stored record.
      storage.setItem(PENDING_KEY, JSON.stringify({ version: 1, token: entry.token, createdAt: entry.createdAt, item: bookmark(item) }));
    }
    return { version: 1, token: entry.token, createdAt: entry.createdAt, item: current };
  } catch { return null; }
}

export function stagePendingListing(value: SavedListingItem, storage?: StorageLike, now = Date.now()): string | null {
  const item = parseSavedListing(value), target = storageOrNull(storage);
  if (!item || !target || !Number.isSafeInteger(now)) return null;
  try {
    const token = globalThis.crypto.randomUUID();
    const entry: PendingListing = { version: 1, token, createdAt: now, item };
    target.setItem(PENDING_KEY, JSON.stringify(entry));
    return pending(target, now)?.token === token ? token : null;
  } catch { return null; }
}

export function getPendingListingToken(storage?: StorageLike, now = Date.now()): string | null {
  return pending(storageOrNull(storage), now)?.token || null;
}

export function readPendingListing(token: string, storage?: StorageLike, now = Date.now()): SavedListingItem | null {
  const entry = pending(storageOrNull(storage), now);
  return entry?.token === token ? entry.item : null;
}

export function getPendingListingExpiresAt(token: string, storage?: StorageLike, now = Date.now()): number | null {
  const entry = pending(storageOrNull(storage), now);
  return entry?.token === token ? entry.createdAt + PENDING_LISTING_TTL : null;
}

export function getPendingListingSnapshotExpiresAt(token: string, storage?: StorageLike, now = Date.now()): number | null {
  const entry = pending(storageOrNull(storage), now);
  return entry?.token === token ? entry.createdAt + LISTING_SNAPSHOT_TTL : null;
}

export function clearPendingListing(token: string, storage?: StorageLike, now = Date.now()): void {
  const target = storageOrNull(storage);
  try { if (target && pending(target, now)?.token === token) target.removeItem(PENDING_KEY); } catch { /* Storage may be blocked; never clear another pending save. */ }
}
