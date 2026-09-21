import type { SavedSearchItem } from "./saved-search";

export type Mode = "cars" | "parts";
export type MarketplaceId = "autotrader" | "facebook" | "ebay" | "motors" | "gumtree" | "cargurus" | "pistonheads" | "aacars" | "carandclassic";
export type Platform = "all" | "more" | MarketplaceId;
export type VehicleFields = { make: string; model: string; year: string; engine: string; fuel: string; bodyStyle: string };
export type PartSearchFields = VehicleFields & { part: string; partNumber: string; partCategory: string; partMethod: string };
export type CarSearchFields = { make: string; model: string; year: string; price: string; postcode: string; platform: Platform };
export type CarSearchCriteria = Pick<CarSearchFields, "make" | "model" | "year">;
export type SubmittedSearch = {
  mode: Mode; title: string; query: string; fallbackUrl: string; searchMethod: string;
  maxPrice?: string; platform: Platform; carCriteria?: CarSearchCriteria; carLinks?: Record<MarketplaceId, string>; saveItem: SavedSearchItem;
};
export type EbayListing = {
  id: string; title: string; url: string; image: string | null; price: string | null;
  currency: string | null; condition: string | null; location: string | null;
  buyingOptions?: string[]; itemEndDate?: string | null;
};

const ebayAffiliateParams = { mkcid: "1", mkrid: "710-53481-19255-0", siteid: "3", campid: "5339201924", toolid: "10001", mkevt: "1" };

export function withEbayAffiliateTracking(url: string, customId: string) {
  try {
    const tracked = new URL(url);
    Object.entries(ebayAffiliateParams).forEach(([key, value]) => tracked.searchParams.set(key, value));
    tracked.searchParams.set("customid", customId);
    return tracked.toString();
  } catch { return url; }
}

export function buildCarLinks(fields: CarSearchFields): Record<MarketplaceId, string> {
  const { make, model, year, price, postcode } = fields;
  const terms = [make, model, year].filter(Boolean).join(" ");
  const query = [terms, price ? `under £${price}` : "", postcode ? `near ${postcode}` : ""].filter(Boolean).join(" ");
  const autoTrader = new URLSearchParams();
  if (make) autoTrader.set("make", make);
  if (model) autoTrader.set("model", model);
  if (year) { autoTrader.set("year-from", year); autoTrader.set("year-to", year); }
  if (price) autoTrader.set("price-to", price);
  if (postcode) autoTrader.set("postcode", postcode);
  const ebay = new URLSearchParams({ _nkw: terms, _sacat: "9801" });
  if (price) ebay.set("_udhi", price);
  if (postcode) ebay.set("_stpos", postcode);
  const slug = (value: string) => value.toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const motorsPath = [slug(make), slug(model)].filter(Boolean).join("/");
  return {
    autotrader: `https://www.autotrader.co.uk/car-search?${autoTrader}`,
    facebook: `https://www.facebook.com/marketplace/uk/search?query=${encodeURIComponent(query)}`,
    ebay: withEbayAffiliateTracking(`https://www.ebay.co.uk/sch/i.html?${ebay}`, "mekivo-car-search"),
    motors: `https://www.cazoo.co.uk/cars/${motorsPath ? `${motorsPath}/` : ""}`,
    gumtree: `https://www.gumtree.com/search?search_category=cars&q=${encodeURIComponent(query)}`,
    cargurus: `https://www.cargurus.co.uk/Cars/forsale?keywords=${encodeURIComponent(query)}`,
    pistonheads: `https://www.pistonheads.com/buy/search?keyword=${encodeURIComponent(query)}`,
    aacars: `https://www.theaa.com/used-cars/displaycars?keyword=${encodeURIComponent(query)}`,
    carandclassic: `https://www.carandclassic.com/search?search=${encodeURIComponent(query)}`,
  };
}

export function marketplaceFilterNote(id: MarketplaceId) {
  if (id === "autotrader") return "Make, model, year and budget carried across. Check distance on Auto Trader.";
  if (id === "ebay") return "Budget carried across; year is a search term. Set distance on eBay.";
  if (id === "motors") return "Make and model carried across. Reapply budget, year and location on Cazoo.";
  return "Opens a keyword search. Check budget, year and location filters on the marketplace.";
}

export function createCarSearch(fields: CarSearchFields): SubmittedSearch {
  const carLinks = buildCarLinks(fields);
  const title = [fields.year, fields.make, fields.model].filter(Boolean).join(" ");
  const carCriteria = { make: fields.make, model: fields.model, year: fields.year };
  return { mode: "cars", title, query: [fields.make, fields.model, fields.year].filter(Boolean).join(" "), fallbackUrl: carLinks.ebay, maxPrice: fields.price, platform: fields.platform, carCriteria, carLinks, searchMethod: "vehicle", saveItem: { kind: "car_search", title, data: { ...fields, links: carLinks } } };
}

export function createPartSearch(fields: PartSearchFields, numberOnly = false): SubmittedSearch {
  // The submitted record is the single source for results, outbound links and saves.
  const data = numberOnly
    ? { make: "", model: "", year: "", engine: "", fuel: "", bodyStyle: "", part: "", partCategory: "", partNumber: fields.partNumber.trim(), partMethod: "search", searchMethod: "part_number" }
    : { ...fields, searchMethod: "vehicle" };
  const vehicleLabel = [data.year, data.make, data.model, data.engine, data.fuel, data.bodyStyle].filter(Boolean).join(" ");
  const title = [vehicleLabel, data.part || data.partNumber || data.partCategory].filter(Boolean).join(" · ");
  const query = [vehicleLabel, data.partCategory, data.part, data.partNumber].filter(Boolean).join(" ");
  const fallbackUrl = withEbayAffiliateTracking(`https://www.ebay.co.uk/sch/i.html?${new URLSearchParams({ _nkw: query, _sacat: "6030" })}`, "mekivo-parts-search");
  return { mode: "parts", title, query, fallbackUrl, platform: "ebay", searchMethod: numberOnly ? "part_number" : fields.partMethod, saveItem: { kind: "part_search", title, data: { ...data, vehicleLabel, link: fallbackUrl } } };
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
