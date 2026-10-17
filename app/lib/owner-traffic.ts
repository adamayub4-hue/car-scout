import type { EbayBuyingFormat, SearchType } from "./search";

export const OWNER_TRAFFIC_RANGES = ["all", "24h", "7d", "30d", "custom"] as const;
// Analytics was enabled and the first recorded test visit verified on this UK
// date. See docs/analytics-tracking.md; this is not inferred from campaign dates.
export const OWNER_TRAFFIC_FIRST_RECORDED_DATE = "2026-09-16";

export type OwnerTrafficRange = (typeof OWNER_TRAFFIC_RANGES)[number];
export type OwnerTrafficDates = { from: string; to: string };
export type OwnerTrafficClicks = { ebayCars: number; ebayParts: number; ebayMotorbikes?: number; otherMarketplaces: number; unclassified: number };
export const OWNER_TRAFFIC_MARKETPLACES = ["ebay", "autotrader", "facebook", "motors", "gumtree", "cargurus", "pistonheads", "aacars", "carandclassic", "carwow"] as const;
export type OwnerTrafficMarketplace = (typeof OWNER_TRAFFIC_MARKETPLACES)[number] | "unclassified";
export const OWNER_TRAFFIC_MARKETPLACE_LABELS: Record<OwnerTrafficMarketplace, string> = {
  ebay: "eBay",
  autotrader: "Auto Trader",
  facebook: "Facebook Marketplace",
  motors: "MOTORS",
  gumtree: "Gumtree",
  cargurus: "CarGurus",
  pistonheads: "PistonHeads",
  aacars: "AA Cars",
  carandclassic: "Car & Classic",
  carwow: "Carwow",
  unclassified: "Unidentified destination",
};
export type OwnerTrafficMarketplaceRow = {
  marketplace: OwnerTrafficMarketplace;
  cars: number | null;
  motorbikes?: number | null;
  parts: number | null;
  clicks: number;
};

export type OwnerTrafficOutboundRow = {
  searchType: SearchType | null;
  marketplace: OwnerTrafficMarketplace;
  destination: "listing" | "search_results" | "all_results" | "unknown";
  buyingFormat: EbayBuyingFormat;
  measurement: "legacy" | "v2" | "unknown";
  clicks: number;
};

const DAY_MS = 86_400_000;
const ukDateFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });

export function ownerTrafficUKDate(now = Date.now()) {
  const parts = ukDateFormatter.formatToParts(new Date(now));
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function validDate(value: string) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
}

function ukMidnight(utcDate: number) {
  // At 00:00 UTC London is either 00:00 GMT or 01:00 BST. UK clock
  // changes happen later, so midnight is unambiguous even on transition days.
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).format(new Date(utcDate)));
  return utcDate - hour * 3_600_000;
}

export function ownerTrafficAllTimeWindow(now = Date.now()) {
  const firstDay = Date.parse(`${OWNER_TRAFFIC_FIRST_RECORDED_DATE}T00:00:00.000Z`);
  return { since: new Date(ukMidnight(firstDay)).toISOString(), until: new Date(now).toISOString() };
}

export function ownerTrafficDateWindow(dates: OwnerTrafficDates, now = Date.now()) {
  const from = validDate(dates.from), to = validDate(dates.to);
  if (from === null || to === null || to < from || (to - from) / DAY_MS >= 31 || dates.to > ownerTrafficUKDate(now)) return null;
  return { since: new Date(ukMidnight(from)).toISOString(), until: new Date(Math.min(ukMidnight(to + DAY_MS) - 1, now)).toISOString() };
}

export type OwnerTrafficSource = {
  source: string;
  visitors: number;
  pageviews: number;
};

export type OwnerTrafficAppUsage = {
  appVisitors: number;
  browserVisitors: number;
  appOpens: number;
  confirmedInstalls: number;
};

export type OwnerTrafficReport = {
  range: OwnerTrafficRange;
  since: string;
  until: string;
  fetchedAt: string;
  visitors: number;
  pageviews: number;
  searches: number | null;
  outboundClicks: number | null;
  clicksByDestination: OwnerTrafficClicks | null;
  marketplaceClicks: OwnerTrafficMarketplaceRow[] | null;
  outboundDetails?: OwnerTrafficOutboundRow[] | null;
  appUsage: OwnerTrafficAppUsage | null;
  returnVisits?: number | null;
  calendarDates?: OwnerTrafficDates;
  sources: OwnerTrafficSource[] | null;
  partial: boolean;
  warnings: string[];
};
