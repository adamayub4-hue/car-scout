import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { OwnerTrafficRange, OwnerTrafficReport, OwnerTrafficSource } from "./owner-traffic";
import { BoundedTtlCache } from "./server-cache";
import { UpstreamTimeoutError, withUpstreamTimeout } from "./server-upstream";

const reports = new BoundedTtlCache<OwnerTrafficReport>(12, 5 * 60_000);
const RANGE_MS: Record<OwnerTrafficRange, number> = {
  "24h": 24 * 60 * 60_000,
  "7d": 7 * 24 * 60 * 60_000,
  "30d": 30 * 24 * 60 * 60_000,
};
const PRODUCTION_FILTER = "environment eq 'production'";
const EVENT_FILTER = `${PRODUCTION_FILTER} and (eventName eq 'search_submitted' or eventName eq 'marketplace_outbound')`;

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

// Call only after authorizeTrafficOwner. All configuration stays on the server.
export async function getOwnerTraffic(range: OwnerTrafficRange): Promise<OwnerTrafficReport> {
  const token = process.env.MEKIVO_ANALYTICS_VERCEL_TOKEN?.trim();
  if (!token) {
    throw new OwnerTrafficError(503, "not_configured", "Website traffic reporting is not connected yet.");
  }
  const projectId = process.env.MEKIVO_ANALYTICS_PROJECT_ID?.trim() || "car-scout";
  const slug = process.env.MEKIVO_ANALYTICS_TEAM_SLUG?.trim() || "adamayub4-hues-projects";
  // Rotating credentials or changing the configured project cannot reuse an old
  // snapshot; the key contains a hash rather than retaining another raw token.
  const cacheKey = JSON.stringify([projectId, slug, createHash("sha256").update(token).digest("hex"), range]);
  const cached = reports.get(cacheKey);
  if (cached) return cached;

  const now = Date.now();
  const since = new Date(now - RANGE_MS[range]).toISOString();
  const until = new Date(now).toISOString();
  async function query<T>(dataset: "visits" | "events", by: string, filter: string, limit: number, parse: (payload: unknown) => T) {
    const url = new URL(`https://api.vercel.com/v1/query/web-analytics/${dataset}/aggregate`);
    url.search = new URLSearchParams({ projectId, slug, since, until, by, filter, limit: String(limit) }).toString();
    return withUpstreamTimeout(async (signal) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store", redirect: "error", signal,
      });
      if (!response.ok) throw new Error("Analytics provider unavailable");
      const payload: unknown = await response.json();
      if (signal.aborted) throw new UpstreamTimeoutError();
      return parse(payload);
    });
  }

  const [totals, sources, events] = await Promise.allSettled([
    query("visits", "environment", PRODUCTION_FILTER, 1, parseTotals),
    query("visits", "referrerHostname", PRODUCTION_FILTER, 8, parseSources),
    query("events", "eventName", EVENT_FILTER, 10, parseEvents),
  ]);
  if (totals.status === "rejected") {
    const timedOut = totals.reason instanceof UpstreamTimeoutError;
    throw new OwnerTrafficError(timedOut ? 504 : 502, timedOut ? "provider_timeout" : "provider_unavailable",
      timedOut ? "Website traffic took too long to load. Please try again." : "Website traffic is temporarily unavailable. Please try again shortly.");
  }
  const warnings: string[] = [];
  if (sources.status === "rejected") warnings.push("Traffic sources are temporarily unavailable.");
  if (events.status === "rejected") warnings.push("Search and outbound-click totals are temporarily unavailable.");
  const report: OwnerTrafficReport = {
    range, since, until, fetchedAt: new Date(Date.now()).toISOString(),
    ...totals.value,
    sources: sources.status === "fulfilled" ? sources.value : null,
    searches: events.status === "fulfilled" ? events.value.searches : null,
    outboundClicks: events.status === "fulfilled" ? events.value.outboundClicks : null,
    partial: warnings.length > 0, warnings,
  };
  // Let Retry recover optional sections immediately rather than caching errors.
  if (!report.partial) reports.set(cacheKey, report);
  return report;
}
