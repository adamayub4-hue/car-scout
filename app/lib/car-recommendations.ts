import type { EbayListing, SubmittedSearch } from "./search";
import { carPriceInPence, filterCarListings, isUnwantedCarListing } from "./car-filters";

export type CarRecommendation = {
  item: EbayListing;
  url: string;
  pricePence: number;
  belowBudgetPence: number | null;
  purchaseFormat: "Fixed price" | "Classified ad";
};

function normalized(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/([a-z])([0-9])/g, "$1 $2").replace(/([0-9])([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function containsPhrase(title: string, phrase: string) {
  return (` ${title} `).includes(` ${normalized(phrase)} `);
}

function makeMatches(title: string, make: string) {
  const aliases: Record<string, string[]> = {
    volkswagen: ["volkswagen", "vw"],
    "land rover": ["land rover", "range rover"],
    mercedes: ["mercedes"],
    "mercedes benz": ["mercedes", "mercedes benz"],
  };
  const makeKey = normalized(make);
  const names = Object.hasOwn(aliases, makeKey) ? aliases[makeKey] : [makeKey];
  return names.some(name => containsPhrase(title, name));
}

export function safeEbayListingUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const hosts = ["ebay.co.uk", "www.ebay.co.uk", "ebay.com", "www.ebay.com", "m.ebay.co.uk", "m.ebay.com"];
    if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.port || url.username || url.password) return null;
    if (!/^\/itm\/(?:[^/]+\/)?\d{9,15}\/?$/.test(url.pathname)) return null;
    return url.toString();
  } catch { return null; }
}

export function getCarRecommendations(items: readonly EbayListing[], search: SubmittedSearch, now = Date.now()): CarRecommendation[] {
  if (search.mode !== "cars" || !search.carCriteria || (search.platform !== "all" && search.platform !== "ebay")) return [];
  const { make, model, year } = search.carCriteria;
  const maximum = carPriceInPence(search.maxPrice);
  if (search.maxPrice?.trim() && maximum === null) return [];
  const seen = new Set<string>();
  const candidates: CarRecommendation[] = [];

  for (const item of filterCarListings(items, { minPrice: search.minPrice, maxPrice: search.maxPrice, vehicleType: search.vehicleType, ...(search.vehicleType === "motorbikes" ? { make, model } : {}) })) {
    if (typeof item.title !== "string" || item.currency !== "GBP") continue;
    const pricePence = carPriceInPence(item.price);
    if (pricePence === null || (maximum !== null && pricePence > maximum)) continue;
    const options = Array.isArray(item.buyingOptions) ? item.buyingOptions : [];
    const purchaseFormat = options.includes("FIXED_PRICE") ? "Fixed price" : options.includes("CLASSIFIED_AD") ? "Classified ad" : null;
    if (!purchaseFormat) continue;
    if (item.itemEndDate) {
      const end = Date.parse(item.itemEndDate);
      if (!Number.isFinite(end) || end <= now) continue;
    }
    const title = normalized(item.title);
    if (search.vehicleType !== "motorbikes" && ((make.trim() && !makeMatches(title, make)) || (model.trim() && !containsPhrase(title, model)))) continue;
    if (year.trim()) {
      // The first full year in a car title is the strongest available summary
      // signal. A later MOT/service date must not stand in for the vehicle year.
      const firstYear = title.match(/\b(?:19|20)\d{2}\b/)?.[0];
      if (firstYear !== year.trim()) continue;
    }
    if (/\b(?:19|20)\d{2}\s*[-–/]\s*(?:19|20)\d{2}\b/.test(item.title)) continue;
    if (isUnwantedCarListing(item, search.vehicleType)) continue;
    const url = safeEbayListingUrl(item.url);
    if (!url) continue;
    const legacyId = new URL(url).pathname.match(/\/(\d+)\/?$/)![1];
    if (seen.has(legacyId)) continue;
    seen.add(legacyId);
    candidates.push({ item, url, pricePence, belowBudgetPence: maximum !== null && maximum > pricePence ? maximum - pricePence : null, purchaseFormat });
  }
  return candidates.sort((left, right) => left.pricePence - right.pricePence || left.item.title.localeCompare(right.item.title)).slice(0, 3);
}
