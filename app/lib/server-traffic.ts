import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { OWNER_TRAFFIC_MARKETPLACES, ownerTrafficDateWindow, type OwnerTrafficRange, type OwnerTrafficReport, type OwnerTrafficSource, type OwnerTrafficDates, type OwnerTrafficClicks, type OwnerTrafficMarketplaceRow, type OwnerTrafficAppUsage } from "./owner-traffic";
import { BoundedTtlCache } from "./server-cache";
import { UpstreamTimeoutError, withUpstreamTimeout } from "./server-upstream";

const reports = new BoundedTtlCache<OwnerTrafficReport>(12, 5 * 60_000);
const RANGE_MS: Record<Exclude<OwnerTrafficRange, "custom">, number> = {
  "24h": 24 * 60 * 60_000,
  "7d": 7 * 24 * 60 * 60_000,
  "30d": 30 * 24 * 60 * 60_000,
};
const PRODUCTION_FILTER = "environment eq 'production'";
const EVENT_FILTER = `${PRODUCTION_FILTER} and (eventName eq 'search_submitted' or eventName eq 'marketplace_outbound')`;
const APP_USAGE_FILTER = `${PRODUCTION_FILTER} and (eventName eq 'app_open' or eventName eq 'browser_open' or eventName eq 'app_install')`;

export class OwnerTrafficError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "OwnerTrafficError";
  }
}

// This check deliberately runs for every request, including cache hits. The
// public Supabase key plus the caller's verified JWT applies the existing RLS.
export async function authorizeTrafficOwner(authorization: string | null): Promise<void> {
  const token = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token || token.length > 8_192) {
    throw new OwnerTrafficError(401, "unauthorized", "Sign in again to view website traffic.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new OwnerTrafficError(503, "auth_unavailable", "The owner check is unavailable. Please try again shortly.");
  }
  try {
    await withUpstreamTimeout(async (signal) => {
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: {
          headers: { Authorization: `Bearer ${token}` },
          fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal }),
        },
      });
      const { data, error } = await client.auth.getUser(token);
      if (signal.aborted) throw new UpstreamTimeoutError();
      if (error) {
        if (error.status === 400 || error.status === 401 || error.status === 403) {
          throw new OwnerTrafficError(401, "unauthorized", "Sign in again to view website traffic.");
        }
        throw new OwnerTrafficError(503, "auth_unavailable", "The owner check is unavailable. Please try again shortly.");
      }
      if (!data.user?.id) {
        throw new OwnerTrafficError(401, "unauthorized", "Sign in again to view website traffic.");
      }
      const membership = await client.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
      if (signal.aborted) throw new UpstreamTimeoutError();
      if (membership.error) {
        throw new OwnerTrafficError(503, "auth_unavailable", "The owner check is unavailable. Please try again shortly.");
      }
      if (membership.data?.user_id !== data.user.id) {
        throw new OwnerTrafficError(403, "forbidden", "Website traffic is only available to the owner.");
      }
    });
  } catch (error) {
    if (error instanceof OwnerTrafficError) throw error;
    if (error instanceof UpstreamTimeoutError) {
      throw new OwnerTrafficError(504, "auth_timeout", "The owner check took too long. Please try again.");
    }
    throw new OwnerTrafficError(503, "auth_unavailable", "The owner check is unavailable. Please try again shortly.");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

class AnalyticsQueryError extends Error {
  constructor(public readonly category: string, public readonly status?: number) {
    super("Analytics query failed");
  }
}

function parseFailure(error: unknown) {
  const categories: Record<string, string> = {
    "Invalid analytics response": "invalid_rows", "Invalid analytics context": "invalid_context",
    "Duplicate analytics context": "duplicate_context", "Conflicting analytics context": "conflicting_context", "Invalid analytics count": "invalid_count",
    "Unknown analytics event": "unknown_event", "Duplicate analytics event": "duplicate_event", "Invalid analytics event totals": "invalid_totals",
  };
  const message = error instanceof Error ? error.message : "";
  return new AnalyticsQueryError(Object.hasOwn(categories, message) ? categories[message] : "invalid_response");
}

function rows(payload: unknown, maxRows: number): Record<string, unknown>[] {
  if (!record(payload) || !Array.isArray(payload.data) || payload.data.length > maxRows || !payload.data.every(record)) {
    throw new Error("Invalid analytics response");
  }
  return payload.data;
}

function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid analytics count");
  }
  return value;
}

function parseTotals(payload: unknown) {
  // A single production group gives the period's visitor count directly.
  // Summing visitor counts grouped by days or sources would double-count people.
  const data = rows(payload, 1);
  if (data.length === 0) return { visitors: 0, pageviews: 0 };
  if (data[0].environment !== "production") throw new Error("Invalid analytics environment");
  return { visitors: count(data[0].visitors), pageviews: count(data[0].pageviews) };
}

function parseSources(payload: unknown): OwnerTrafficSource[] {
  // A top-eight query may additionally include Vercel's "Others" group.
  return rows(payload, 9).map((row) => {
    const source = row.referrerHostname;
    if (source !== null && (typeof source !== "string" || source.length > 255 || /[\u0000-\u001f\u007f]/.test(source))) {
      throw new Error("Invalid analytics source");
    }
    return {
      source: typeof source === "string" && source.trim() ? source.trim() : "Direct / unknown",
      visitors: count(row.visitors),
      pageviews: count(row.pageviews),
    };
  });
}

function parseEvents(payload: unknown) {
  const counts = { searches: 0, outboundClicks: 0 };
  const seen = new Set<string>();
  for (const row of rows(payload, 2)) {
    const name = row.eventName;
    if ((name !== "search_submitted" && name !== "marketplace_outbound") || seen.has(name)) {
      throw new Error("Invalid analytics event");
    }
    seen.add(name);
    counts[name === "search_submitted" ? "searches" : "outboundClicks"] = count(row.count);
  }
  return counts;
}

function parseAppUsage(payload: unknown): OwnerTrafficAppUsage {
  const usage = { appVisitors: 0, browserVisitors: 0, appOpens: 0, confirmedInstalls: 0 };
  const seen = new Set<string>();
  for (const row of rows(payload, 3)) {
    const name = row.eventName;
    if (name !== "app_open" && name !== "browser_open" && name !== "app_install") throw new Error("Unknown analytics event");
    if (seen.has(name)) throw new Error("Duplicate analytics event");
    seen.add(name);
    const eventCount = count(row.count);
    const visitors = count(row.visitors);
    if (visitors > eventCount) throw new Error("Invalid analytics event totals");
    // Event groups can overlap: use each provider visitor count directly rather
    // than summing them or subtracting them from the website's visitor total.
    if (name === "app_open") {
      usage.appVisitors = visitors;
      usage.appOpens = eventCount;
    } else if (name === "browser_open") {
      usage.browserVisitors = visitors;
    } else {
      usage.confirmedInstalls = eventCount;
    }
  }
  return usage;
}

function parseDestinations(payload: unknown): { summary: OwnerTrafficClicks; marketplaces: OwnerTrafficMarketplaceRow[]; total: number } {
  const summary: OwnerTrafficClicks = { ebayCars: 0, ebayParts: 0, otherMarketplaces: 0, unclassified: 0 };
  const marketplaces: { marketplace: typeof OWNER_TRAFFIC_MARKETPLACES[number]; cars: number; parts: number; motorbikes?: number; clicks: number }[] = OWNER_TRAFFIC_MARKETPLACES.map(marketplace => ({ marketplace, cars: 0, parts: 0, clicks: 0 }));
  const marketplaceRows = new Map<string, (typeof marketplaces)[number]>(marketplaces.map(row => [row.marketplace, row]));
  let total = 0;
  const seen = new Set<string | null>();
  // Production returns a literal "eventData/context" column. Vercel's guide
  // instead documents "eventData". Accept both, but never conflicting values.
  // The top-100 response may contain one additional "Others" row.
  for (const row of rows(payload, 101)) {
    try {
      const hasLiteralKey = Object.hasOwn(row, "eventData/context");
      if (hasLiteralKey && Object.hasOwn(row, "eventData") && row["eventData/context"] !== row.eventData) throw new Error("Conflicting analytics context");
      const context = hasLiteralKey ? row["eventData/context"] : row.eventData;
      if (context !== null && (typeof context !== "string" || context.length > 255 || /[\u0000-\u001f\u007f]/.test(context))) throw new Error("Invalid analytics context");
      if (seen.has(context as string | null)) throw new Error("Duplicate analytics context");
      seen.add(context as string | null);
      const parts = typeof context === "string" ? context.split(":") : [];
      const [type, marketplace, destination] = parts;
      const known = parts.length === 3 && ["cars", "motorbikes", "parts"].includes(type) && ["listing", "search_results", "all_results"].includes(destination);
      const clicks = count(row.count);
      total = count(total + clicks);
      const marketplaceRow = known ? marketplaceRows.get(marketplace) : undefined;
      const group = marketplaceRow && marketplace === "ebay" ? (type === "cars" ? "ebayCars" : type === "motorbikes" ? "ebayMotorbikes" : "ebayParts")
        : marketplaceRow ? "otherMarketplaces" : "unclassified";
      summary[group] = count((summary[group] ?? 0) + clicks);
      if (marketplaceRow) {
        const vehicleType = type as "cars" | "motorbikes" | "parts";
        marketplaceRow[vehicleType] = count((marketplaceRow[vehicleType] ?? 0) + clicks);
        marketplaceRow.clicks = count(marketplaceRow.clicks + clicks);
      }
    } catch (error) { throw parseFailure(error); }
  }
  return {
    summary,
    marketplaces: [...marketplaces, { marketplace: "unclassified", cars: null, parts: null, clicks: summary.unclassified }],
    total,
  };
}

// Call only after authorizeTrafficOwner. All configuration stays on the server.
export async function getOwnerTraffic(range: OwnerTrafficRange, dates?: OwnerTrafficDates): Promise<OwnerTrafficReport> {
  const token = process.env.MEKIVO_ANALYTICS_VERCEL_TOKEN?.trim();
  if (!token) {
    throw new OwnerTrafficError(503, "not_configured", "Website traffic reporting is not connected yet.");
  }
  const projectId = process.env.MEKIVO_ANALYTICS_PROJECT_ID?.trim() || "car-scout";
  const slug = process.env.MEKIVO_ANALYTICS_TEAM_SLUG?.trim() || "adamayub4-hues-projects";
  // Rotating credentials or changing the configured project cannot reuse an old
  // snapshot; the key contains a hash rather than retaining another raw token.
  const customWindow = range === "custom" && dates ? ownerTrafficDateWindow(dates) : null;
  if (range === "custom" && !customWindow) throw new OwnerTrafficError(400, "invalid_range", "Choose valid UK dates, up to 31 days inclusive, ending no later than today.");
  const cacheKey = JSON.stringify([projectId, slug, createHash("sha256").update(token).digest("hex"), range, dates?.from, dates?.to]);
  const cached = reports.get(cacheKey);
  if (cached) return cached;

  const now = Date.now();
  const since = customWindow?.since ?? new Date(now - RANGE_MS[range as Exclude<OwnerTrafficRange, "custom">]).toISOString();
  const until = customWindow?.until ?? new Date(now).toISOString();
  async function query<T>(dataset: "visits" | "events", by: string, filter: string, limit: number, parse: (payload: unknown) => T) {
    const url = new URL(`https://api.vercel.com/v1/query/web-analytics/${dataset}/aggregate`);
    url.search = new URLSearchParams({ projectId, slug, since, until, by, filter, limit: String(limit) }).toString();
    return withUpstreamTimeout(async (signal) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store", redirect: "error", signal,
      });
      if (!response.ok) throw new AnalyticsQueryError("http_error", response.status);
      let payload: unknown;
      try { payload = await response.json(); } catch { throw new AnalyticsQueryError("invalid_json"); }
      if (signal.aborted) throw new UpstreamTimeoutError();
      try { return parse(payload); } catch (error) {
        if (error instanceof AnalyticsQueryError) throw error;
        throw parseFailure(error);
      }
    });
  }

  const [totals, sources, events, destinations, appUsage] = await Promise.allSettled([
    query("visits", "environment", PRODUCTION_FILTER, 1, parseTotals),
    query("visits", "referrerHostname", PRODUCTION_FILTER, 8, parseSources),
    query("events", "eventName", EVENT_FILTER, 10, parseEvents),
    query("events", "eventData/context", `${PRODUCTION_FILTER} and eventName eq 'marketplace_outbound'`, 100, parseDestinations),
    query("events", "eventName", APP_USAGE_FILTER, 3, parseAppUsage),
  ]);
  if (totals.status === "rejected") {
    const timedOut = totals.reason instanceof UpstreamTimeoutError;
    throw new OwnerTrafficError(timedOut ? 504 : 502, timedOut ? "provider_timeout" : "provider_unavailable",
      timedOut ? "Website traffic took too long to load. Please try again." : "Website traffic is temporarily unavailable. Please try again shortly.");
  }
  const warnings: string[] = [];
  if (sources.status === "rejected") warnings.push("Traffic sources are temporarily unavailable.");
  if (events.status === "rejected") warnings.push("Search and outbound-click totals are temporarily unavailable.");
  if (appUsage.status === "rejected") {
    warnings.push("App usage is temporarily unavailable.");
    const failure = appUsage.reason;
    // Keep diagnostics server-only and limited to safe failure categories.
    console.warn("Owner traffic app usage unavailable", failure instanceof AnalyticsQueryError
      ? { reason: failure.category, ...(failure.status ? { status: failure.status } : {}) }
      : { reason: failure instanceof UpstreamTimeoutError ? "timeout" : "network_failure" });
  }
  // Queries can settle at different ingestion moments. Never present a split
  // that does not add up to the confirmed total, or fill a failed split with 0.
  const confirmedDestinations = destinations.status === "fulfilled" && events.status === "fulfilled"
    && destinations.value.total === events.value.outboundClicks ? destinations.value : null;
  const clicksByDestination = confirmedDestinations?.summary ?? null;
  const marketplaceClicks = confirmedDestinations?.marketplaces ?? null;
  if (destinations.status === "rejected") {
    const failure = destinations.reason;
    // Server-only diagnostics are deliberately limited to error categories,
    // and HTTP status. Never log schema, values, counts, tokens,
    // request URLs, filters or the provider response body.
    console.warn("Owner traffic destination breakdown unavailable", failure instanceof AnalyticsQueryError
      ? { reason: failure.category, ...(failure.status ? { status: failure.status } : {}) }
      : { reason: failure instanceof UpstreamTimeoutError ? "timeout" : "network_failure" });
  } else if (events.status === "fulfilled" && clicksByDestination === null) {
    console.warn("Owner traffic destination breakdown unavailable", { reason: "totals_mismatch" });
  }
  if (clicksByDestination === null && events.status === "fulfilled") warnings.push("The outbound-click breakdown is temporarily unavailable.");
  const report: OwnerTrafficReport = {
    range, since, until, fetchedAt: new Date(Date.now()).toISOString(),
    ...totals.value,
    sources: sources.status === "fulfilled" ? sources.value : null,
    searches: events.status === "fulfilled" ? events.value.searches : null,
    outboundClicks: events.status === "fulfilled" ? events.value.outboundClicks : null,
    clicksByDestination, marketplaceClicks,
    appUsage: appUsage.status === "fulfilled" ? appUsage.value : null,
    ...(range === "custom" && dates ? { calendarDates: dates } : {}),
    partial: warnings.length > 0, warnings,
  };
  // Let Retry recover optional sections immediately rather than caching errors.
  if (!report.partial) reports.set(cacheKey, report);
  return report;
}
