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
const EXCLUDED_SWAP = /\b(?:swaps?|exchange)\s+only\b|\bonly\s+(?:swaps?|exchange)\b|\bpart[\s-]+exchange\s+only\b/i;
const EXCLUDED_SMALL_COMPONENT = /\b(?:(?:petrol|fuel|diesel)\s+(?:filler\s+)?cap|battery\s+conditioner|(?:lower|upper)\s+grill(?:e)?|(?:full\s+black|interior\s+trim)\s+(?:trims?|set)|rolling\s+shell)\b/i;
const WHEEL_SET_AT_START = /^(?:set\s+of\s+)?[234](?:\s*x)?\s+.*\b(?:alloy|steel)\s+wheels?\b/i;
// These titles name a component as the item being sold. Preserve clear full-car
// descriptions of fitted equipment or completed maintenance.
const COMPONENT_AS_PRODUCT = /\b(?:gearbox\s*$|engine\s*(?:£\s*\d[\d,]*(?:\.\d{1,2})?)?\s*$|(?:manifold\s+to\s+cat|exhaust)\s+pipe\b|rear\s+spoiler\b|boot\s*lid\b|dpf\b|diesel\s+particulate\s+filter\b)/i;
const FULL_CAR_CONTEXT = /\b(?:mot|mileage|\d[\d,]*\s+miles|fsh|full\s+service\s+history|drives?|runs?|owners?|v5c|logbook|(?:gearbox|exhaust|spoiler|engine|dpf|boot\s*lid|diesel\s+particulate\s+filter)\s+(?:replaced|fitted|included|repaired|rebuilt|reconditioned)|(?:new|replaced|replacement|rebuilt|reconditioned)\s+(?:gearbox|engine|dpf|boot\s*lid|diesel\s+particulate\s+filter))\b/i;
// An engine advertised on its own can still say it runs or was tested. That is
// component condition, rather than evidence that a complete car is being sold.
const BARE_ENGINE_AS_PRODUCT = /\bbare\s+engine\b|^(?:(?:genuine|oem|new|used)[\s-]+)*engine\s+for\b/i;
const MOTORCYCLE_AS_PRODUCT = /\b(?:motorcycles?|motorbikes?|scooters?|mopeds?)\b/i;
const COMPLETED_BARE_ENGINE_WORK = /\bbare\s+engine\s+(?:replaced|fitted|rebuilt|repaired|reconditioned)\b/i;
const COMPLETE_CAR_EVIDENCE = /\b(?:mot|mileage|\d[\d,]*\s+miles|fsh|full\s+service\s+history|v5c|logbook)\b/i;

function normalizedCarText(value: string) {
  const separated = value.replace(compactMakePrefix, (name, offset, source: string) => {
    const next = source[offset + name.length];
    return next === next.toUpperCase() || name.toLowerCase() === "vw" ? `${name} ` : name;
  }).replace(/\b(golf)(plus)\b/gi, "$1 $2");
  return separated.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/([a-z])([0-9])/g, "$1 $2").replace(/([0-9])([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function containsCarPhrase(title: string, phrase: string) {
  return (` ${title} `).includes(` ${phrase} `);
}

const makeAliases: Record<string, string[]> = {
  volkswagen: ["volkswagen", "vw"], vw: ["volkswagen", "vw"],
  mercedes: ["mercedes", "mercedes benz"], "mercedes benz": ["mercedes", "mercedes benz"],
  "land rover": ["land rover", "range rover"],
};
const namedCarMakes = ["alfa romeo", "audi", "bmw", "citroen", "dacia", "daihatsu", "ford", "honda", "hyundai", "infiniti", "jaguar", "jeep", "kia", "land rover", "lexus", "mazda", "mercedes", "mini", "mitsubishi", "nissan", "peugeot", "porsche", "range rover", "renault", "saab", "seat", "skoda", "smart", "subaru", "suzuki", "tesla", "toyota", "vauxhall", "volkswagen", "volvo", "vw"];
const compactMakePrefix = new RegExp(`\\b(?:${namedCarMakes.join("|")})(?=[a-z])`, "gi");

// Explicit submitted criteria are separate from free-text q. Missing make/model
// means a broad search; title matching cannot verify the seller's vehicle data.
export function matchesCarCriteria(title: string, criteria: { make?: string; model?: string } = {}) {
  const text = normalizedCarText(title);
  const make = normalizedCarText(criteria.make || "");
  const model = normalizedCarText(criteria.model || "");
  if (make) {
    const names = Object.hasOwn(makeAliases, make) ? makeAliases[make] : [make];
    if (!names.some(name => containsCarPhrase(text, name))) return false;
    // Keyword tails such as "Audi A3 ... VW Golf Polo" do not change a clear
    // make at the start of the advert. Avoid guessing when no make leads it.
    const subject = text.replace(/^(?:\d{2,4}\s+)+/, "");
    const leadingMake = namedCarMakes.find(name => subject === name || subject.startsWith(`${name} `));
    if (leadingMake && !names.includes(leadingMake)) return false;
    if (model && names.includes("volkswagen") && leadingMake) {
      const leadingModel = subject.slice(leadingMake.length).trim().match(/^(polo|golf|passat|tiguan)\b/)?.[1];
      if (leadingModel && model !== leadingModel && !model.startsWith(`${leadingModel} `)) return false;
    }
  }
  if (!model || containsCarPhrase(text, model)) return true;
  // Site series choices include BMW 1/3/5 Series. Advertisers commonly use
  // badges such as 320d or 530d rather than spelling out the series name.
  const bmwSeries = make === "bmw" ? model.match(/^([135]) series$/)?.[1] : undefined;
  return Boolean(bmwSeries && new RegExp(`\\b(?:m\\s+)?${bmwSeries}\\d{2}\\s*(?:i|d|e|ci|cd|ti|tds)\\b`).test(text));
}

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
  const rawTitle = item.title.replace(/([a-z])([A-Z])/g, "$1 $2");
  const title = rawTitle.replace(/\bpart[\s-]+exchange\b/gi, "");
  // A mobility-scooter hoist/carrier is fitted car equipment, not a scooter ad.
  const vehicleTitle = rawTitle
    .replace(/\bmobility[\s-]+scooter[\s-]+(?:hoist|carrier|ramp|lift)\b/gi, "")
    .replace(/\b(?:motorcycles?|motorbikes?|scooters?|mopeds?)\s+part[\s-]+exchange\s+(?:welcome|considered)\b|\bpart[\s-]+exchange\s+(?:motorcycles?|motorbikes?|scooters?|mopeds?)\s+(?:welcome|considered)\b/gi, "");
  const completedBareEngineWork = COMPLETED_BARE_ENGINE_WORK.test(title) && COMPLETE_CAR_EVIDENCE.test(title);
  return EXCLUDED_SWAP.test(rawTitle) || EXCLUDED_SMALL_COMPONENT.test(title) || WHEEL_SET_AT_START.test(title.trim()) ||
    (BARE_ENGINE_AS_PRODUCT.test(title.trim()) && !completedBareEngineWork) || MOTORCYCLE_AS_PRODUCT.test(vehicleTitle) ||
    (COMPONENT_AS_PRODUCT.test(title) && !FULL_CAR_CONTEXT.test(title)) ||
    EXCLUDED_OFFER.test(title) || EXCLUDED_PART.test(title) || EXCLUDED_COMPONENT.test(title) || COMPONENT_AT_START.test(title.trim()) ||
    (REGISTRATION_AT_START.test(title.trim()) && !/\b(?:plates?|registration)\s+included\b/i.test(title)) ||
    EXCLUDED_CONDITION.test(item.condition || "") ||
    /\bauction[ -]+only\b/i.test(title) ||
    (Array.isArray(item.buyingOptions) && item.buyingOptions.includes("AUCTION") && !hasCarPurchasePrice(item));
}

export type CarListingFilters = {
  make?: string;
  model?: string;
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
    if (!matchesCarCriteria(item.title, filters)) return false;
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
