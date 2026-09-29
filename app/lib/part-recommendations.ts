import { safeEbayListingUrl } from "./car-recommendations";
import type { EbayListing, PartSearchCriteria, SubmittedSearch } from "./search";

export type PartRecommendation = { item: EbayListing; url: string; pricePence: number };
const pounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

function amountInPence(value: unknown, allowZero = false) {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, decimal = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && (allowZero ? amount >= 0 : amount > 0) ? amount : null;
}

export function partPostageLabel(item: EbayListing) {
  const price = item.postage?.currency === "GBP" ? amountInPence(item.postage.price, true) : null;
  if (price === null) return "Postage: check on eBay";
  return price === 0 ? "Free postage shown · confirm on eBay" : `Postage shown: ${pounds.format(price / 100)} · confirm on eBay`;
}

const normalise = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const phraseIn = (title: string, value: string) => (` ${title} `).includes(` ${normalise(value)} `);
const tokens = (value: string) => normalise(value).split(" ").filter(Boolean).map(token => token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token);

function titleMatches(title: string, criteria: PartSearchCriteria) {
  const number = criteria.partNumber.replace(/[^a-z0-9]/gi, "");
  if (number) {
    // Require the complete number, allowing common printed separators but not
    // a prefix/suffix match. Title matching still cannot establish fitment.
    if (number.length < 4 || !/\d/.test(number)) return false;
    const pattern = number.split("").join("[\\s./-]*");
    return new RegExp(`(?:^|[^a-z0-9])${pattern}(?:$|[^a-z0-9])`, "i").test(title);
  }
  const partTokens = tokens(criteria.part);
  if (!partTokens.length || !criteria.make.trim() || !criteria.model.trim()) return false;
  const normalizedTitle = normalise(title), titleTokens = new Set(tokens(title));
  // Cheap fittings for a named component must not masquerade as that component
  // in the shortlist. They remain available in the ordinary live results.
  const accessoryWords = ["screw", "bolt", "washer", "nut", "clip", "sensor", "cover", "bracket", "seal", "gasket", "adapter", "connector", "wiring", "sticker", "manual", "tool"];
  if (accessoryWords.some(word => titleTokens.has(word) && !partTokens.includes(word))) return false;
  if (/\b(?:repair|fitting|fitting\s+accessory)\s+kit\b/.test(normalizedTitle) && !partTokens.includes("kit")) return false;
  if (partTokens.includes("disc") && titleTokens.has("pad") && !partTokens.includes("pad")) return false;
  if (partTokens.includes("pad") && titleTokens.has("disc") && !partTokens.includes("disc")) return false;
  const make = normalise(criteria.make);
  const makeNames = make === "volkswagen" ? ["volkswagen", "vw"] : make === "mercedes benz" ? ["mercedes", "mercedes benz"] : [make];
  return makeNames.some(name => phraseIn(normalizedTitle, name)) && phraseIn(normalizedTitle, criteria.model)
    && partTokens.every(token => titleTokens.has(token));
}

// These are title matches ranked by item price, not a catalogue fitment check
// or a comparison of identical brands, condition, quantities or delivered cost.
export function getPartRecommendations(items: readonly EbayListing[], search: SubmittedSearch, now = Date.now()): PartRecommendation[] {
  if (search.mode !== "parts" || search.platform !== "ebay" || !search.partCriteria) return [];
  const seen = new Set<string>(), candidates: PartRecommendation[] = [];
  for (const item of items) {
    if (typeof item.title !== "string" || item.currency !== "GBP" || !Array.isArray(item.buyingOptions) || !item.buyingOptions.includes("FIXED_PRICE")) continue;
    const pricePence = amountInPence(item.price);
    if (pricePence === null || !titleMatches(item.title, search.partCriteria)) continue;
    if (/\b(?:deposit|repair\s+service|exchange\s+only|spares\s+or\s+repair|not\s+working|choose|choice\s+of|select\s+from)\b/i.test(item.title) || /\b(?:not\s+working|damaged|repair)\b/i.test(item.condition || "")) continue;
    if (item.itemEndDate && (!Number.isFinite(Date.parse(item.itemEndDate)) || Date.parse(item.itemEndDate) <= now)) continue;
    const url = safeEbayListingUrl(item.url);
    if (!url) continue;
    const id = new URL(url).pathname.match(/\/(\d+)\/?$/)![1];
    if (seen.has(id)) continue;
    seen.add(id);
    candidates.push({ item, url, pricePence });
  }
  return candidates.sort((left, right) => left.pricePence - right.pricePence || left.item.title.localeCompare(right.item.title)).slice(0, 3);
}
