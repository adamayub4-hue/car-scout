"use client";

import { useSyncExternalStore } from "react";
import { browserExclusionStatus, excludeThisBrowser, subscribeAnalyticsAudience } from "../lib/analytics-audience";

export default function TrafficExclusionControl() {
  const status = useSyncExternalStore(subscribeAnalyticsAudience, browserExclusionStatus, () => "off");
  return <div className="mt-6 rounded-2xl border border-sky-300/25 bg-sky-400/5 p-5">
    <p role="status" className="font-semibold">{status === "saved" ? "This browser is excluded from visitor reports." : status === "temporary" ? "This page is excluded, but your browser could not save the setting." : "Exclude this browser before testing the website."}</p>
    <p className="mt-3 text-sm leading-6 text-muted">{status === "saved" ? "Your visits, searches and marketplace clicks will stay out of the reports, even after signing out. Clearing this site's browser data removes this setting." : status === "temporary" ? "Browser storage is blocked. Keep analytics=off in the address for each test page, or allow this site to save the setting." : "This saves a setting on this browser only. Use this page on any other phone, browser or private window you use for testing."}</p>
    <button onClick={excludeThisBrowser} disabled={status === "saved"} className="mt-4 rounded-xl bg-sky-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-60">{status === "saved" ? "Exclusion is on" : "Exclude this browser"}</button>
  </div>;
}
