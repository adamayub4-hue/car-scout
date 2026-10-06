import type { CarSort, EbayListing } from "./search";

// Title checks are deliberately conservative; they are not a vehicle inspection
// or a guarantee of the seller's full cash price, history or availability.
const EXCLUDED_OFFER = /\b(?:deposit|down\s*payment|pcm|p\s*\/\s*m|(?:per|a|each)\s+(?:calendar\s+)?month|monthly|weekly|(?:per|a|each)\s+week|lease|leasing|finance\s+(?:only|from|deal|offer)|instalments?|installments?|spares?|repairs?|salvage|breaking|breakers?|dismantling|scrap|damaged|non[ -]?runner|not\s+running|does\s+not\s+start|won'?t\s+start|project\s+car|restoration\s+project|write[ -]?off|category[\s-]*[abcdnsu]|cat[\s-]*[abcdnsu]|mot\s+fail(?:ure)?|no\s+mot|mot\s+expired)\b|\b\d+(?:\.\d+)?\s*pm\b/i;
const EXCLUDED_PART = /\b(?:parts?|accessories|bumper|bonnet|tailgate|headlights?|tail\s*lights?|wing\s+mirror|door\s+mirror|brake\s+(?:pads?|discs?|calipers?)|oil\s+filter|air\s+filter|spark\s+plugs?|injectors?|turbocharger|alternator|starter\s+motor|ecu|wiring\s+loom|key\s+fob|roof\s+rack|seat\s+covers?|floor\s+mats?|owners?\s+manual|workshop\s+manual|scale\s+model|diecast|die\s+cast|toy\s+car|shell\s+only)\b|\b(?:engine|gearbox|clutch|wheels?|doors?|seats?)\s+(?:only|for|assembly|unit|replacement|removed|tested|bare|complete)\b|\b1\s*[:/]\s*\d{1,3}\s*(?:scale|model)\b/i;
const EXCLUDED_CONDITION = /\b(?:parts?|not\s+working|damaged|salvage|repair)\b/i;
// Misclassified components can appear in the cars category. Match specific
// component names rather than "sensor" anywhere: parking sensors, for example,
// are normal car equipment. These checks still cannot identify every bad advert.
const EXCLUDED_COMPONENT = /\b(?:(?:temperature|coolant|crankshaft|camshaft|oxygen|lambda|nox|abs|map|maf|oil\s+pressure|fuel\s+pressure|tyre\s+pressure)\s+sensors?|(?:engine|gearbox|transmission|airbag|abs|body|comfort|electronic)\s+(?:control\s+)?(?:units?|modules?)|control\s+modules?|headrest|(?:front|rear|left|right)[\s-]+(?:left[\s-]+|right[\s-]+)*headrests?|suspension\s+struts?|shock\s+absorbers?|radiators?|intercoolers?|steering\s+racks?|wishbones?|drive\s*shafts?)\b/i;
const COMPONENT_AT_START = /^(?:(?:genuine|oem|new|used|bosch|denso|delphi|continental)[\s-]+)*(?:sensors?|modules?)\b/i;
const REGISTRATION_AT_START = /^(?:(?:private|cherished|personalised|personalized|dateless|dvla)[\s-]+)*(?:(?:number|registration)[\s-]*plates?|(?:private|cherished|personalised|personalized)[\s-]+(?:plate|registration)|registration[\s-]+(?:number|transfer))\b/i;

export function carPriceInPence(value: string | undefined | null) {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [pounds, pence = ""] = value.trim().split(".");
  const amount = Number(pounds) * 100 + Number(pence.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function hasCarPurchasePrice(item: EbayListing) {
  return Array.isArray(item.buyingOptions) &&
    (item.buyingOptions.includes("FIXED_PRICE") || item.buyingOptions.includes("CLASSIFIED_AD"));
}

export function isUnwantedCarListing(item: EbayListing) {
  // Dealer finance availability and part exchange are normal full-car wording.
  const title = item.title.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\bpart[\s-]+exchange\b/gi, "");
  return EXCLUDED_OFFER.test(title) || EXCLUDED_PART.test(title) || EXCLUDED_COMPONENT.test(title) || COMPONENT_AT_START.test(title.trim()) ||
    (REGISTRATION_AT_START.test(title.trim()) && !/\b(?:plates?|registration)\s+included\b/i.test(title)) ||
    EXCLUDED_CONDITION.test(item.condition || "") ||
    /\bauction[ -]+only\b/i.test(title) ||
    (Array.isArray(item.buyingOptions) && item.buyingOptions.includes("AUCTION") && !hasCarPurchasePrice(item));
}

export type CarListingFilters = {
  hideUnwanted?: boolean;
  minPrice?: string;
  maxPrice?: string;
  sort?: CarSort;
};

export function filterCarListings(items: readonly EbayListing[], filters: CarListingFilters = {}): EbayListing[] {
  const minimum = filters.minPrice?.trim() === "0" ? 0 : carPriceInPence(filters.minPrice);
  const maximum = carPriceInPence(filters.maxPrice);
  if ((filters.minPrice?.trim() && minimum === null) || (filters.maxPrice?.trim() && maximum === null)) return [];
  if (minimum !== null && maximum !== null && minimum > maximum) return [];
  const priceSort = filters.sort === "price_asc" || filters.sort === "price_desc";
  // The provider sorts before its limit, but includes delivery in that order.
  // Rank the returned cards by their displayed asking price. This only covers
  // the returned batch, not every eBay listing or other marketplaces.
  const filtered = items.filter(item => {
    if (filters.hideUnwanted && isUnwantedCarListing(item)) return false;
    if (priceSort || minimum !== null || maximum !== null) {
      const price = carPriceInPence(item.price);
      if (item.currency !== "GBP" || price === null) return false;
      if (minimum !== null && price < minimum) return false;
      if (maximum !== null && price > maximum) return false;
      // A budget is a purchase-price ceiling, regardless of sort order or the
      // repair-advert toggle. An auction starting price is not a cash price.
      if (!hasCarPurchasePrice(item)) return false;
    }
    return true;
  });
  if (priceSort) filtered.sort((left, right) => (carPriceInPence(left.price)! - carPriceInPence(right.price)!) * (filters.sort === "price_desc" ? -1 : 1));
  return filtered;
}
