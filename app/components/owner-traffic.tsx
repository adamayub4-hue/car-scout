"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { OwnerTrafficRange, OwnerTrafficReport } from "../lib/owner-traffic";
import { getSupabaseBrowserClient } from "../lib/supabase";

const RANGE_LABELS: Record<OwnerTrafficRange, string> = {
  "24h": "Last 24 hours", "7d": "Last 7 days", "30d": "Last 30 days",
};
const number = new Intl.NumberFormat("en-GB");
const date = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
});

type TrafficState = { report: OwnerTrafficReport | null; loading: boolean; error: string | null };

// Kept separate from loading so the real dashboard layout can be reviewed locally.
export function OwnerTrafficView({ range, state, onRangeChange, onRefresh }: {
  range: OwnerTrafficRange;
  state: TrafficState;
  onRangeChange: (range: OwnerTrafficRange) => void;
  onRefresh: () => void;
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
        <button type="button" disabled={loading} onClick={onRefresh} className="rounded-lg bg-sky-300 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">{loading ? "Loading…" : "Refresh traffic"}</button>
      </div>
    </div>
    {loading && <p role="status" className="mt-6 rounded-xl border border-outline/10 p-5 text-sm text-muted">Loading your visitor report…</p>}
    {error && <div role="alert" className="mt-6 rounded-xl border border-amber-300/30 bg-amber-300/5 p-5"><p className="font-semibold">Visitor figures unavailable</p><p className="mt-2 text-sm leading-6 text-muted">{error}</p></div>}
    {report && !loading && !error && <>
      <p className="mt-5 text-xs leading-5 text-subtle">{date.format(new Date(report.since))} – {date.format(new Date(report.until))} · UK time</p>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Visitors", value: report.visitors, detail: "Includes visitors without an account." },
          { label: "Page views", value: report.pageviews, detail: "Pages opened, including repeat views." },
          { label: "Searches", value: report.searches, detail: "Car and parts searches made." },
          { label: "Listing clicks", value: report.outboundClicks, detail: "Clicks through to a seller or marketplace." },
        ].map(({ label, value, detail }) => <div key={label} className="rounded-xl border border-outline/10 bg-panel p-4 sm:p-5"><p className="text-sm font-semibold text-muted">{label}</p><p className={`mt-2 font-bold ${value === null ? "text-base" : "text-3xl sm:text-4xl"}`}>{value === null ? "Unavailable" : number.format(value)}</p><p className="mt-2 text-xs leading-5 text-subtle">{detail}</p></div>)}
      </div>
      {report.partial && <p role="status" className="mt-4 text-sm text-warning">Some sections could not be loaded. The available figures are shown; try refreshing in a few minutes.</p>}
      <div className="mt-6 rounded-xl border border-outline/10 bg-panel p-4 sm:p-5">
        <h3 className="font-bold">Where visitors came from</h3>
        {report.sources === null ? <p className="mt-3 text-sm text-muted">Traffic sources are temporarily unavailable.</p> : report.sources.length === 0 ? <p className="mt-3 text-sm text-muted">No traffic sources recorded for this period.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-xs text-subtle"><th scope="col" className="py-2 pr-3 font-medium">Source</th><th scope="col" className="py-2 text-right font-medium">Visitors</th><th scope="col" className="py-2 pl-3 text-right font-medium">Page views</th></tr></thead><tbody>{report.sources.map((source, index) => <tr key={`${source.source}-${index}`} className="border-t border-outline/10"><th scope="row" className="max-w-48 break-words py-3 pr-3 font-medium">{source.source}</th><td className="py-3 text-right tabular-nums">{number.format(source.visitors)}</td><td className="py-3 pl-3 text-right tabular-nums">{number.format(source.pageviews)}</td></tr>)}</tbody></table></div>}
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

  useEffect(() => {
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
          const response = await fetch(`/api/admin/traffic?range=${range}`, {
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
  }, [range, refresh]);

  return <OwnerTrafficView range={range} state={state} onRangeChange={value => { setState({ report: null, loading: true, error: null }); setRange(value); }} onRefresh={() => { setState({ report: null, loading: true, error: null }); setRefresh(value => value + 1); }} />;
}
