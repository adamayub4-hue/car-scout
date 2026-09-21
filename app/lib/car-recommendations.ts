import type { EbayListing, SubmittedSearch } from "./search";

export type CarRecommendation = {
  item: EbayListing;
  url: string;
  pricePence: number;
  belowBudgetPence: number | null;
  purchaseFormat: "Fixed price" | "Classified ad";
};

// Title checks are deliberately conservative; they are not a vehicle inspection
// or a guarantee of the seller's full cash price, history or availability.
const EXCLUDED_OFFER = /\b(?:deposit|down\s*payment|pcm|p\s*\/\s*m|(?:per|a|each)\s+(?:calendar\s+)?month|monthly|weekly|(?:per|a|each)\s+week|lease|leasing|finance\s+(?:only|from|deal|offer)|instalments?|installments?|spares?|repairs?|salvage|breaking|breakers?|dismantling|scrap|damaged|non[ -]?runner|not\s+running|does\s+not\s+start|won'?t\s+start|project\s+car|restoration\s+project|write[ -]?off|category[\s-]*[abcdnsu]|cat[\s-]*[abcdnsu]|mot\s+fail(?:ure)?|no\s+mot|mot\s+expired)\b|\b\d+(?:\.\d+)?\s*pm\b/i;
const EXCLUDED_PART = /\b(?:parts?|accessories|bumper|bonnet|tailgate|headlights?|tail\s*lights?|wing\s+mirror|door\s+mirror|brake\s+(?:pads?|discs?|calipers?)|oil\s+filter|air\s+filter|spark\s+plugs?|injectors?|turbocharger|alternator|starter\s+motor|ecu|wiring\s+loom|key\s+fob|roof\s+rack|seat\s+covers?|floor\s+mats?|owners?\s+manual|workshop\s+manual|scale\s+model|diecast|die\s+cast|toy\s+car|shell\s+only)\b|\b(?:engine|gearbox|clutch|wheels?|doors?|seats?)\s+(?:only|for|assembly|unit|replacement|removed|tested|bare|complete)\b|\b1\s*[:/]\s*\d{1,3}\s*(?:scale|model)\b/i;
const EXCLUDED_CONDITION = /\b(?:parts?|not\s+working|damaged|salvage|repair)\b/i;

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

function priceInPence(value: string | undefined | null) {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [pounds, pence = ""] = value.trim().split(".");
  const amount = Number(pounds) * 100 + Number(pence.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
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
  if (!normalized(make)) return [];
  const maximum = priceInPence(search.maxPrice);
  if (search.maxPrice?.trim() && maximum === null) return [];
  const seen = new Set<string>();
  const candidates: CarRecommendation[] = [];

  for (const item of items) {
    if (typeof item.title !== "string" || item.currency !== "GBP") continue;
    const pricePence = priceInPence(item.price);
    if (pricePence === null || (maximum !== null && pricePence > maximum)) continue;
    const options = Array.isArray(item.buyingOptions) ? item.buyingOptions : [];
    const purchaseFormat = options.includes("FIXED_PRICE") ? "Fixed price" : options.includes("CLASSIFIED_AD") ? "Classified ad" : null;
    if (!purchaseFormat) continue;
    if (item.itemEndDate) {
      const end = Date.parse(item.itemEndDate);
      if (!Number.isFinite(end) || end <= now) continue;
    }
    const title = normalized(item.title);
    if (!makeMatches(title, make) || (model.trim() && !containsPhrase(title, model))) continue;
    if (year.trim()) {
      // The first full year in a car title is the strongest available summary
      // signal. A later MOT/service date must not stand in for the vehicle year.
      const firstYear = title.match(/\b(?:19|20)\d{2}\b/)?.[0];
      if (firstYear !== year.trim()) continue;
    }
    if (/\b(?:19|20)\d{2}\s*[-–/]\s*(?:19|20)\d{2}\b/.test(item.title)) continue;
    // "Part exchange welcome" is normal full-car wording, not a parts advert.
    const offerTitle = item.title.replace(/\bpart\s+exchange\b/gi, "");
    if (EXCLUDED_OFFER.test(offerTitle) || EXCLUDED_PART.test(offerTitle) || EXCLUDED_CONDITION.test(item.condition || "")) continue;
    const url = safeEbayListingUrl(item.url);
    if (!url) continue;
    const legacyId = new URL(url).pathname.match(/\/(\d+)\/?$/)![1];
    if (seen.has(legacyId)) continue;
    seen.add(legacyId);
    candidates.push({ item, url, pricePence, belowBudgetPence: maximum !== null && maximum > pricePence ? maximum - pricePence : null, purchaseFormat });
  }
  return candidates.sort((left, right) => left.pricePence - right.pricePence || left.item.title.localeCompare(right.item.title)).slice(0, 3);
}
