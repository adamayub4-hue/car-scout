import type { SavedSearchItem } from "./saved-search";
import { carExtraLabels, normalizeCarExtras, type CarExtra } from "./car-extras";

export type Mode = "cars" | "parts";
export type VehicleType = "cars" | "motorbikes";
export type SearchType = VehicleType | "parts";
export type EbayBuyingFormat = "fixed_price" | "auction" | "classified" | "mixed" | "unknown";

/** Observe the provider's offer format, never whether a commission is payable. */
export function ebayBuyingFormat(options: unknown): EbayBuyingFormat {
  if (!Array.isArray(options) || options.length > 16 || options.some(option => !["FIXED_PRICE", "AUCTION", "CLASSIFIED_AD", "BEST_OFFER"].includes(option))) return "unknown";
  const formats: EbayBuyingFormat[] = [];
  if (options.includes("FIXED_PRICE")) formats.push("fixed_price");
  if (options.includes("AUCTION")) formats.push("auction");
  if (options.includes("CLASSIFIED_AD")) formats.push("classified");
  return formats.length > 1 ? "mixed" : formats[0] ?? "unknown";
}
export type MarketplaceId = "autotrader" | "facebook" | "ebay" | "motors" | "gumtree" | "cargurus" | "pistonheads" | "aacars" | "carandclassic" | "carwow";
export type Platform = "all" | "more" | MarketplaceId;
export type VehicleFields = { make: string; model: string; year: string; engine: string; fuel: string; bodyStyle: string };
export type PartSearchFields = VehicleFields & { part: string; partNumber: string; partCategory: string; partMethod: string };
export type CarSort = "best_match" | "price_asc" | "price_desc" | "newest";
export type CarSearchFields = { make: string; model: string; year: string; price: string; postcode: string; platform: Platform; vehicleType?: VehicleType; minPrice?: string; sort?: CarSort; hideUnwanted?: boolean; carExtras?: CarExtra[] };
export type CarSearchCriteria = Pick<CarSearchFields, "make" | "model" | "year">;
export type PartSearchCriteria = Pick<PartSearchFields, "make" | "model" | "part" | "partNumber">;
export type SubmittedSearch = {
  mode: Mode; title: string; query: string; fallbackUrl: string; searchMethod: string;
  vehicleType?: VehicleType; minPrice?: string; maxPrice?: string; carSort?: CarSort; hideUnwanted?: boolean; carExtras?: CarExtra[]; platform: Platform; carCriteria?: CarSearchCriteria; partCriteria?: PartSearchCriteria; carLinks?: Partial<Record<MarketplaceId, string>>; saveItem: SavedSearchItem;
};
export type EbayListing = {
  id: string; title: string; url: string; image: string | null; price: string | null;
  affiliateUrl?: string | null;
  currency: string | null; condition: string | null; location: string | null;
  shortDescription?: string | null;
  buyingOptions?: string[]; itemEndDate?: string | null;
  buyingFormat?: EbayBuyingFormat;
  postage?: { price: string; currency: string } | null;
};

export const ebayAffiliateCampaignId = "5339201924";
const ebayAffiliateParams = { mkcid: "1", mkrid: "710-53481-19255-0", siteid: "3", campid: ebayAffiliateCampaignId, toolid: "10001", mkevt: "1" };

/** Keep eBay's native tracking payload, bound to the same listing and campaign. */
export function safeNativeEbayAffiliateUrl(value: unknown, listingUrl: string): string | null {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const affiliate = new URL(value);
    const listing = new URL(listingUrl);
    const hosts = ["ebay.co.uk", "www.ebay.co.uk", "ebay.com", "www.ebay.com", "m.ebay.co.uk", "m.ebay.com"];
    const itemId = (url: URL) => url.pathname.match(/^\/itm\/(?:[^/]+\/)?(\d{9,15})\/?$/)?.[1];
    for (const url of [affiliate, listing]) {
      if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.port || url.username || url.password || url.hash) return null;
    }
    if (!itemId(listing) || itemId(affiliate) !== itemId(listing)) return null;
    if (affiliate.searchParams.getAll("campid").length !== 1 || affiliate.searchParams.get("campid") !== ebayAffiliateCampaignId) return null;
    // Preserve the provider's hash, tracking payload and custom ID intact.
    return value;
  } catch { return null; }
}

export function ebayListingHref(item: EbayListing, fallbackCustomId: string) {
  return safeNativeEbayAffiliateUrl(item.affiliateUrl, item.url) ?? withEbayAffiliateTracking(item.url, fallbackCustomId);
}

export function withEbayAffiliateTracking(url: string, customId: string) {
  try {
    const tracked = new URL(url);
    Object.entries(ebayAffiliateParams).forEach(([key, value]) => tracked.searchParams.set(key, value));
    tracked.searchParams.set("customid", customId);
    return tracked.toString();
  } catch { return url; }
}

export function buildCarLinks(fields: CarSearchFields): Partial<Record<MarketplaceId, string>> & { ebay: string } {
  const { make, model, year, price, minPrice, postcode } = fields;
  const baseTerms = [make, model, year].filter(Boolean).join(" ");
  if (fields.vehicleType === "motorbikes") {
    // The first motorbike release uses eBay only. Car-specific marketplace
    // routes must never be offered as a prepared motorcycle search.
    // eBay UK Motorcycles & Scooters category (422).
    const ebay = new URLSearchParams({ _nkw: baseTerms, _sacat: "422" });
    if (minPrice) ebay.set("_udlo", minPrice);
    if (price) ebay.set("_udhi", price);
    if (postcode) ebay.set("_stpos", postcode);
    return { ebay: withEbayAffiliateTracking(`https://www.ebay.co.uk/sch/i.html?${ebay}`, "mekivo-motorbike-search") };
  }
  const terms = [baseTerms, ...carExtraLabels(normalizeCarExtras(fields.carExtras))].filter(Boolean).join(" ");
  // Keyword searches look for advert wording, so budget and location prose
  // would exclude relevant cars instead of setting the marketplace's filters.
  const query = terms;
  const autoTrader = new URLSearchParams();
  if (make) autoTrader.set("make", make);
  if (model) autoTrader.set("model", model);
  if (year) { autoTrader.set("year-from", year); autoTrader.set("year-to", year); }
  if (price) autoTrader.set("price-to", price);
  if (postcode) autoTrader.set("postcode", postcode);
  const ebay = new URLSearchParams({ _nkw: terms, _sacat: "9801" });
  if (minPrice) ebay.set("_udlo", minPrice);
  if (price) ebay.set("_udhi", price);
  if (postcode) ebay.set("_stpos", postcode);
  const aaCars = new URLSearchParams();
  if (query) aaCars.set("keywordsearch", query);
  if (minPrice) aaCars.set("pricefrom", minPrice);
  if (price) aaCars.set("priceto", price);
  const pistonHeads = new URLSearchParams();
  if (query) pistonHeads.set("keywords", query);
  if (price) {
    pistonHeads.append("price", minPrice || "0");
    pistonHeads.append("price", price);
  }
  const slug = (value: string) => value.toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const motorsPath = [slug(make), slug(model)].filter(Boolean).join("/");
  return {
    autotrader: `https://www.autotrader.co.uk/car-search?${autoTrader}`,
    facebook: `https://www.facebook.com/marketplace/uk/search?query=${encodeURIComponent(query || "cars")}`,
    ebay: withEbayAffiliateTracking(`https://www.ebay.co.uk/sch/i.html?${ebay}`, "mekivo-car-search"),
    motors: `https://www.cazoo.co.uk/cars/${motorsPath ? `${motorsPath}/` : ""}`,
    gumtree: `https://www.gumtree.com/search?search_category=cars&q=${encodeURIComponent(query)}`,
    cargurus: "https://www.cargurus.co.uk/shop/used",
    pistonheads: `https://www.pistonheads.com/buy/search?${pistonHeads}`,
    aacars: `https://www.theaa.com/used-cars/displaycars?${aaCars}`,
    carandclassic: `https://www.carandclassic.com/search?q=${encodeURIComponent(query)}`,
    // Carwow's public used-car entry point does not document a portable query
    // contract. Let the visitor choose their vehicle and filters there.
    carwow: "https://www.carwow.co.uk/used-cars",
  };
}

export function marketplaceFilterNote(id: MarketplaceId, hasExtras = false) {
  if (id === "autotrader") return hasExtras
    ? "Make, model, year and maximum price carried across. Reapply selected extras, minimum price, sorting and other filters on Auto Trader."
    : "Make, model, year and maximum price carried across. Check minimum price, sorting and other filters on Auto Trader.";
  if (id === "ebay") return hasExtras
    ? "Price range carried across; year and selected extras are search terms. Confirm the equipment with the seller and check sorting, unwanted listings and distance on eBay."
    : "Price range carried across; year is a search term. Check sorting, unwanted listings and distance on eBay.";
  if (id === "motors") return hasExtras
    ? "Make and model carried across. Reapply selected extras, budget, year and location on Cazoo."
    : "Make and model carried across. Reapply budget, year and location on Cazoo.";
  if (id === "aacars") return hasExtras
    ? "Price range carried across; year and selected extras are search terms. Confirm the equipment with the seller and check location, sorting and other filters on AA Cars."
    : "Price range carried across; year is a search term. Check location, sorting and other filters on AA Cars.";
  if (id === "pistonheads") return hasExtras
    ? "Maximum price and any accompanying minimum carried across. Year and selected extras are search terms. Confirm the equipment with the seller and check location, sorting and other filters on PistonHeads. Set a minimum-only budget there."
    : "Maximum price and any accompanying minimum carried across. Year is a search term. Check location, sorting and other filters on PistonHeads. Set a minimum-only budget there.";
  if (id === "cargurus") return "Choose make and model on CarGurus, then set your budget, year, extras and location there.";
  if (id === "carwow") return "Choose make and model on Carwow, then set your budget, year, extras and location there. Your Mekivo filters are not carried across.";
  if (id === "facebook") return hasExtras
    ? "Opens a keyword search including selected extras. Use a personal Facebook profile with Marketplace access. Check budget, year and location filters on Facebook and confirm the equipment with the seller."
    : "Opens a keyword search. Use a personal Facebook profile with Marketplace access. Check budget, year and location filters on Facebook.";
  return hasExtras
    ? "Opens a keyword search including selected extras. Confirm the equipment with the seller and check budget, year and location filters on the marketplace."
    : "Opens a keyword search. Check budget, year and location filters on the marketplace.";
}

export function createCarSearch(fields: CarSearchFields): SubmittedSearch {
  const carLinks = buildCarLinks(fields);
  const motorbike = fields.vehicleType === "motorbikes";
  const title = [fields.year, fields.make, fields.model].filter(Boolean).join(" ") || (motorbike ? "All motorbikes" : "All cars");
  const carCriteria = { make: fields.make, model: fields.model, year: fields.year };
  const savedFields = { ...fields };
  const carExtras = motorbike ? [] : normalizeCarExtras(fields.carExtras);
  delete savedFields.carExtras;
  if (carExtras.length) savedFields.carExtras = [...carExtras];
  if (motorbike) savedFields.platform = "ebay";
  else delete savedFields.vehicleType;
  return { mode: "cars", ...(motorbike ? { vehicleType: "motorbikes" as const } : {}), ...(carExtras.length ? { carExtras: [...carExtras] } : {}), title, query: [fields.make, fields.model, fields.year].filter(Boolean).join(" "), fallbackUrl: carLinks.ebay, minPrice: fields.minPrice, maxPrice: fields.price, carSort: fields.sort, hideUnwanted: fields.hideUnwanted, platform: savedFields.platform, carCriteria, carLinks, searchMethod: "vehicle", saveItem: { kind: "car_search", title, data: { ...savedFields, links: carLinks } } };
}

export function createPartSearch(fields: PartSearchFields, numberOnly = false): SubmittedSearch {
  // The submitted record is the single source for results, outbound links and saves.
  const data = numberOnly
    ? { make: "", model: "", year: "", engine: "", fuel: "", bodyStyle: "", part: "", partCategory: "", partNumber: fields.partNumber.trim(), partMethod: "search", searchMethod: "part_number" }
    : { ...fields, searchMethod: "vehicle" };
  delete (data as Record<string, unknown>).carExtras;
  const vehicleLabel = [data.year, data.make, data.model, data.engine, data.fuel, data.bodyStyle].filter(Boolean).join(" ");
  const title = [vehicleLabel, data.part || data.partNumber || data.partCategory].filter(Boolean).join(" · ");
  const query = [vehicleLabel, data.partCategory, data.part, data.partNumber].filter(Boolean).join(" ");
  const fallbackUrl = withEbayAffiliateTracking(`https://www.ebay.co.uk/sch/i.html?${new URLSearchParams({ _nkw: query, _sacat: "6030" })}`, "mekivo-parts-search");
  const partCriteria = { make: data.make, model: data.model, part: data.part, partNumber: data.partNumber };
  return { mode: "parts", title, query, fallbackUrl, platform: "ebay", partCriteria, searchMethod: numberOnly ? "part_number" : fields.partMethod, saveItem: { kind: "part_search", title, data: { ...data, vehicleLabel, link: fallbackUrl } } };
}

export function safeListingImage(value: string | null) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && url.hostname === "i.ebayimg.com" && !url.port && url.pathname.startsWith("/images/") ? url.toString() : null;
  } catch { return null; }
}

export function formatListingPrice(price: string | null, currency: string | null) {
  if (!price || !Number.isFinite(Number(price))) return "See price";
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "GBP", maximumFractionDigits: 2 }).format(Number(price)); }
  catch { return `${price} ${currency || ""}`.trim(); }
}
