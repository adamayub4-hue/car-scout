"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OWNER_TRAFFIC_MARKETPLACE_LABELS, ownerTrafficDateWindow, ownerTrafficUKDate, type OwnerTrafficDates, type OwnerTrafficMarketplaceRow, type OwnerTrafficRange, type OwnerTrafficReport } from "../lib/owner-traffic";
import { getSupabaseBrowserClient } from "../lib/supabase";

const RANGE_LABELS: Record<OwnerTrafficRange, string> = {
  "24h": "Last 24 hours", "7d": "Last 7 days", "30d": "Last 30 days", custom: "Choose dates (UK time)",
};
const number = new Intl.NumberFormat("en-GB");
const date = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
});

type TrafficState = { report: OwnerTrafficReport | null; loading: boolean; error: string | null };

function trafficSourceName(source: string) {
  const value = source.trim().toLowerCase();
  const known = [
    { name: "Facebook", domains: ["facebook.com", "facebook"] },
    { name: "Instagram", domains: ["instagram.com", "instagram"] },
    { name: "TikTok", domains: ["tiktok.com", "tiktok"] },
    { name: "Google", domains: ["google.com", "google.co.uk", "google"] },
    { name: "Bing", domains: ["bing.com", "bing"] },
    { name: "YouTube", domains: ["youtube.com", "youtu.be", "youtube"] },
    { name: "Reddit", domains: ["reddit.com", "reddit"] },
    { name: "DuckDuckGo", domains: ["duckduckgo.com", "duckduckgo"] },
  ];
  return known.find(({ domains }) => domains.some(domain => value === domain || (domain.includes(".") && value.endsWith(`.${domain}`))))?.name ?? source;
}

function MarketplaceClicksTable({ rows, caption }: { rows: OwnerTrafficMarketplaceRow[]; caption: string }) {
  return <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
    <caption className="sr-only">{caption}</caption>
    <thead><tr className="text-xs text-subtle">
      <th scope="col" className="py-2 pr-3 font-medium">Marketplace</th>
      <th scope="col" className="px-2 py-2 text-right font-medium">Car clicks</th>
      <th scope="col" className="px-2 py-2 text-right font-medium">Motorbike clicks</th>
      <th scope="col" className="px-2 py-2 text-right font-medium">Part clicks</th>
      <th scope="col" className="py-2 pl-3 text-right font-medium">Total</th>
    </tr></thead>
    <tbody>{rows.map(row => <tr key={row.marketplace} className="border-t border-outline/10">
      <th scope="row" className="py-2.5 pr-3 font-medium">{OWNER_TRAFFIC_MARKETPLACE_LABELS[row.marketplace]}</th>
      <td className="px-2 py-2.5 text-right tabular-nums">{row.cars === null ? <span aria-label="Not known">—</span> : number.format(row.cars)}</td>
      <td className="px-2 py-2.5 text-right tabular-nums">{row.marketplace === "unclassified" || row.motorbikes === null ? <span aria-label="Not known">—</span> : number.format(row.motorbikes ?? 0)}</td>
      <td className="px-2 py-2.5 text-right tabular-nums">{row.parts === null ? <span aria-label="Not known">—</span> : number.format(row.parts)}</td>
      <td className="py-2.5 pl-3 text-right font-semibold tabular-nums">{number.format(row.clicks)}</td>
    </tr>)}</tbody>
  </table></div>;
}

function MarketplaceClicks({ rows }: { rows: OwnerTrafficMarketplaceRow[] | null | undefined }) {
  if (rows == null) return <p className="mt-3 text-sm text-muted">The marketplace breakdown is temporarily unavailable. This does not mean there were no clicks.</p>;
  const sorted = [...rows].sort((a, b) => b.clicks - a.clicks || OWNER_TRAFFIC_MARKETPLACE_LABELS[a.marketplace].localeCompare(OWNER_TRAFFIC_MARKETPLACE_LABELS[b.marketplace], "en-GB"));
  const active = sorted.filter(row => row.clicks > 0);
  const zero = sorted.filter(row => row.clicks === 0 && row.marketplace !== "unclassified");
  return <>
    {active.length ? <MarketplaceClicksTable rows={active} caption="Marketplace clicks, highest total first" /> : <p className="mt-3 text-sm text-muted">No marketplace clicks recorded for this period.</p>}
    {zero.length > 0 && <details className="mt-3 border-t border-outline/10 pt-3">
      <summary className="cursor-pointer text-sm font-medium text-link">Show {zero.length} marketplaces with no clicks</summary>
      <MarketplaceClicksTable rows={zero} caption="Marketplaces with no clicks this period" />
    </details>}
  </>;
}

function AppUsage({ report }: { report: OwnerTrafficReport }) {
  const beforeTracking = ownerTrafficUKDate(Date.parse(report.until)) < "2026-10-06";
  const usage = report.appUsage;
  return <section aria-labelledby="app-usage-heading" className="mt-6 rounded-xl border border-outline/10 bg-panel p-4 sm:p-5">
    <h3 id="app-usage-heading" className="font-bold">App and browser usage</h3>
    <p className="mt-2 text-xs leading-5 text-subtle">Counting starts with the update on 6 October 2026. Earlier visits cannot be separated. Same reporting period as above. App visitors are included in the main Visitors total; app and browser visitor counts can overlap.</p>
    {beforeTracking ? <p className="mt-3 text-sm text-muted">App and browser usage was not tracked during this period. Choose dates from 6 October 2026 onwards.</p> : <>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "App visitors", value: usage?.appVisitors, detail: "Estimated visitors opening Mekivo as an app." },
          { label: "Browser visitors", value: usage?.browserVisitors, detail: "Estimated visitors using a browser tab." },
          { label: "App opens", value: usage?.appOpens, detail: "New loads or switches into app mode." },
          { label: "Confirmed installs", value: usage?.confirmedInstalls, detail: "Install confirmations from supporting browsers." },
        ].map(({ label, value, detail }) => <div key={label} className="rounded-lg border border-outline/10 p-3 sm:p-4"><p className="text-sm font-semibold text-muted">{label}</p><p className={`mt-2 font-bold ${value == null ? "text-base" : "text-2xl sm:text-3xl"}`}>{value == null ? "Unavailable" : number.format(value)}</p><p className="mt-2 text-xs leading-5 text-subtle">{detail}</p></div>)}
      </div>
      {usage == null && <p className="mt-3 text-sm text-muted">App figures are temporarily unavailable. This does not mean there were no app visits or installs.</p>}
    </>}
    <details className="mt-3 text-xs leading-5 text-subtle">
      <summary className="cursor-pointer font-medium text-link">How these figures work</summary>
      <p className="mt-2">App visitors are already included in the main Visitors total. The same person can use both the app and browser, so do not add these visitor counts together. New tracking may reach the report at a different time from page views.</p>
      <p className="mt-2">App opens count new page loads or a switch into app mode, not every return to an already-open app. Confirmed installs are events, not the total number of people with Mekivo installed. iPhone home-screen additions are not reported as installs, but their app visits can still count.</p>
    </details>
  </section>;
}

// Kept separate from loading so the real dashboard layout can be reviewed locally.
export function OwnerTrafficView({ range, state, onRangeChange, onRefresh, onCustomDates, hasCustomDates = false }: {
  range: OwnerTrafficRange;
  state: TrafficState;
  onRangeChange: (range: OwnerTrafficRange) => void;
  onRefresh: () => void;
  onCustomDates?: (dates: OwnerTrafficDates) => void;
  hasCustomDates?: boolean;
}) {
  const { report, loading, error } = state;
  return <section aria-labelledby="website-traffic-heading" className="mt-7 rounded-2xl border border-sky-300/25 bg-sky-400/5 p-5 sm:p-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-xl">
        <p className="text-xs font-bold uppercase tracking-wider text-link">Your website results</p>
        <h2 id="website-traffic-heading" className="mt-1 text-2xl font-bold">Website traffic</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Visitors, page views and searches, including people who browse without signing in.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-muted">Reporting period
          <select value={range} onChange={event => onRangeChange(event.target.value as OwnerTrafficRange)} className="mt-1 block rounded-lg border border-outline/20 bg-panel px-3 py-2.5 text-sm text-foreground">
            {Object.entries(RANGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" disabled={loading || (range === "custom" && !hasCustomDates)} onClick={onRefresh} className="rounded-lg bg-sky-300 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">{loading ? "Loading…" : "Refresh traffic"}</button>
      </div>
    </div>
    {range === "custom" && <form className="mt-5 rounded-xl border border-outline/10 bg-panel p-4" onSubmit={event => {
      event.preventDefault();
      const form = event.currentTarget;
      onCustomDates?.({ from: (form.elements.namedItem("from") as HTMLInputElement).value, to: (form.elements.namedItem("to") as HTMLInputElement).value });
    }}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-muted">From (UK date)<input name="from" type="date" required max={ownerTrafficUKDate()} defaultValue={report?.calendarDates?.from} className="mt-1 block rounded-lg border border-outline/20 bg-background px-3 py-2 text-sm text-foreground" /></label>
        <label className="text-xs font-semibold text-muted">To (UK date, included)<input name="to" type="date" required max={ownerTrafficUKDate()} defaultValue={report?.calendarDates?.to} className="mt-1 block rounded-lg border border-outline/20 bg-background px-3 py-2 text-sm text-foreground" /></label>
        <button type="submit" disabled={loading} className="rounded-lg bg-sky-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">Apply dates</button>
      </div>
      <p className="mt-3 text-xs leading-5 text-subtle">Up to 31 calendar days, including both dates. Europe/London time, with UK clock changes applied. Today is counted only up to the report time. Match the dates and timezone in your eBay report before comparing.</p>
    </form>}
    {loading && <p role="status" className="mt-6 rounded-xl border border-outline/10 p-5 text-sm text-muted">Loading your visitor report…</p>}
    {error && <div role="alert" className="mt-6 rounded-xl border border-amber-300/30 bg-amber-300/5 p-5"><p className="font-semibold">Visitor figures unavailable</p><p className="mt-2 text-sm leading-6 text-muted">{error}</p></div>}
    {report && !loading && !error && <>
      <p className="mt-5 text-xs leading-5 text-subtle">{date.format(new Date(report.since))} – {date.format(new Date(report.until))} · UK time</p>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Visitors", value: report.visitors, detail: "Includes visitors without an account." },
          { label: "Page views", value: report.pageviews, detail: "Pages opened, including repeat views." },
          { label: "Searches", value: report.searches, detail: "Car, motorbike and parts searches made." },
          { label: "Listing clicks", value: report.outboundClicks, detail: "Clicks through to a seller or marketplace." },
        ].map(({ label, value, detail }) => <div key={label} className="rounded-xl border border-outline/10 bg-panel p-4 sm:p-5"><p className="text-sm font-semibold text-muted">{label}</p><p className={`mt-2 font-bold ${value === null ? "text-base" : "text-3xl sm:text-4xl"}`}>{value === null ? "Unavailable" : number.format(value)}</p><p className="mt-2 text-xs leading-5 text-subtle">{detail}</p></div>)}
      </div>
      {report.partial && <p role="status" className="mt-4 text-sm text-warning">Some sections could not be loaded. The available figures are shown; try refreshing in a few minutes.</p>}
      <AppUsage report={report} />
      <div className="mt-6 rounded-xl border border-outline/10 bg-panel p-4 sm:p-5">
        <h3 className="font-bold">Where listing clicks went</h3>
        <MarketplaceClicks rows={report.marketplaceClicks} />
        <p className="mt-3 text-xs leading-5 text-subtle">Same reporting period as the totals above. Includes links to individual listings and marketplace search results; repeated clicks are counted. Unidentified destination means older or unknown labels could not identify the marketplace; a dash means the car, motorbike or part type is not known. Website actions are not eBay-credited clicks or sales, and the two services can count differently.</p>
      </div>
      <div className="mt-6 rounded-xl border border-outline/10 bg-panel p-4 sm:p-5">
        <h3 className="font-bold">Where visitors came from</h3>
        {report.sources === null ? <p className="mt-3 text-sm text-muted">Traffic sources are temporarily unavailable.</p> : report.sources.length === 0 ? <p className="mt-3 text-sm text-muted">No traffic sources recorded for this period.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-xs text-subtle"><th scope="col" className="py-2 pr-3 font-medium">Source</th><th scope="col" className="py-2 text-right font-medium">Visitors</th><th scope="col" className="py-2 pl-3 text-right font-medium">Page views</th></tr></thead><tbody>{report.sources.map((source, index) => {
          const name = trafficSourceName(source.source);
          return <tr key={`${source.source}-${index}`} className="border-t border-outline/10"><th scope="row" className="max-w-48 break-words py-2.5 pr-3 font-medium">{name}{name !== source.source && <span className="mt-0.5 block text-xs font-normal text-subtle">{source.source}</span>}</th><td className="py-2.5 text-right tabular-nums">{number.format(source.visitors)}</td><td className="py-2.5 pl-3 text-right tabular-nums">{number.format(source.pageviews)}</td></tr>;
        })}</tbody></table></div>}
        <p className="mt-3 text-xs leading-5 text-subtle">Direct / unknown means no source was supplied. Apps can hide this, so some ad visitors may appear there. A visitor can appear under more than one source.</p>
      </div>
      <p className="mt-4 text-xs leading-5 text-subtle">Updated {date.format(new Date(report.fetchedAt))} · Reports are saved for up to 5 minutes between refreshes. New activity may take time to arrive. Source: Vercel Web Analytics. Visitor estimates can count the same person again on another day or device.</p>
    </>}
    <div className="mt-5 border-t border-outline/10 pt-4 text-sm leading-6 text-muted">
      <p>Signed-in owner visits and browsers marked for testing are excluded. <Link href="/traffic-settings" className="font-semibold text-link underline">Check this browser’s exclusion</Link>.</p>
      <p className="mt-2 text-xs leading-5 text-subtle">Reports covering time before 17 September 2026, 4:04pm UK time include earlier testing. Compare the same dates as your ads. Searches and listing clicks are actions, not extra people or confirmed sales.</p>
    </div>
  </section>;
}

export default function OwnerTraffic() {
  const [range, setRange] = useState<OwnerTrafficRange>("7d");
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<TrafficState>({ report: null, loading: true, error: null });
  const [customDates, setCustomDates] = useState<OwnerTrafficDates | null>(null);

  useEffect(() => {
    if (range === "custom" && !customDates) return;
    const client = getSupabaseBrowserClient();
    const controller = new AbortController();
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let loadedUserId: string | undefined;
    let observedUserId: string | null | undefined;
    const load = async () => {
      setState({ report: null, loading: true, error: null });
      try {
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error("The visitor report took too long to load. Please try again.")); }, 20_000);
        });
        const report = await Promise.race([deadline, (async () => {
          if (!client) throw new Error("Please sign in to your owner account again.");
          const { data, error } = await client.auth.getSession();
          if (error || !data.session?.access_token) throw new Error("Please sign in to your owner account again.");
          // An auth change may arrive while getSession is still resolving.
          // Never use an older owner's token after that identity has changed.
          if (observedUserId !== undefined && observedUserId !== data.session.user.id) throw new Error("Please sign in to your owner account again to view this report.");
          loadedUserId = data.session.user.id;
          if (!active || controller.signal.aborted) throw new Error("Request cancelled");
          const query = new URLSearchParams({ range, ...(range === "custom" && customDates ? customDates : {}) });
          const response = await fetch(`/api/admin/traffic?${query}`, {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
            cache: "no-store", signal: controller.signal,
          });
          if (!response.ok) {
            const failure = await response.json().catch(() => ({}));
            if (failure.code === "not_configured") throw new Error("The private connection to the visitor report needs to be set up. Your website is still collecting eligible visitor activity.");
            if (response.status === 401 || response.status === 403) throw new Error("Please sign in to your owner account again to view this report.");
            throw new Error("The visitor report could not be loaded. Please try again in a few minutes. This does not mean there were no visitors.");
          }
          return await response.json() as OwnerTrafficReport;
        })()]);
        if (active) setState({ report, loading: false, error: null });
      } catch (error) {
        if (active) setState({ report: null, loading: false, error: error instanceof Error ? error.message : "The visitor report is temporarily unavailable." });
      } finally { clearTimeout(timer); }
    };
    const start = setTimeout(() => void load(), 0);
    const subscription = client?.auth.onAuthStateChange((_event, session) => {
      observedUserId = session?.user.id ?? null;
      if (!session || (loadedUserId && session.user.id !== loadedUserId)) {
        active = false;
        clearTimeout(start); clearTimeout(timer); controller.abort();
        setState({ report: null, loading: false, error: "Please sign in to your owner account again to view this report." });
      }
    });
    return () => { active = false; clearTimeout(start); clearTimeout(timer); controller.abort(); subscription?.data.subscription.unsubscribe(); };
  }, [range, refresh, customDates]);

  return <OwnerTrafficView range={range} state={state} hasCustomDates={customDates !== null}
    onRangeChange={value => { setState({ report: null, loading: value !== "custom" || customDates !== null, error: null }); setRange(value); }}
    onCustomDates={dates => {
      if (!ownerTrafficDateWindow(dates)) { setState({ report: null, loading: false, error: "Choose valid UK dates, up to 31 days inclusive, ending no later than today." }); return; }
      setState({ report: null, loading: true, error: null }); setCustomDates(dates);
    }}
    onRefresh={() => { setState({ report: null, loading: true, error: null }); setRefresh(value => value + 1); }} />;
}
