"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { analyticsAudience, filterAnalyticsEvent, initializeAnalyticsAudience, subscribeAnalyticsAudience } from "../lib/analytics-audience";
import { initializeAppUsage, trackAppOpen } from "../lib/app-usage";
import { filterReturnVisitEvent, initializeReturnVisits, trackReturnVisitActivity } from "../lib/return-visits";

export function filterSiteAnalyticsEvent<T extends { url: string }>(event: T): T | null {
  const included = filterAnalyticsEvent(event);
  return included ? filterReturnVisitEvent(included) : null;
}

export function SiteAnalytics() {
  const pathname = usePathname();
  const audience = useSyncExternalStore(subscribeAnalyticsAudience, analyticsAudience, () => "pending");
  const [enabled, setEnabled] = useState(false);
  useEffect(initializeAnalyticsAudience, []);
  useEffect(initializeAppUsage, []);
  useEffect(initializeReturnVisits, []);
  useEffect(trackReturnVisitActivity, [pathname, audience]);
  // An excluded first route must not consume the document's open event.
  useEffect(trackAppOpen, [pathname, audience]);
  useEffect(() => {
    if (enabled || audience !== "included") return;
    const timer = window.setTimeout(() => setEnabled(true), 0);
    return () => window.clearTimeout(timer);
  }, [audience, enabled]);
  // Keep an initialized SDK mounted: remounting on token refresh duplicates pageviews.
  // The live beforeSend guard still blocks every pending/excluded event.
  if (!enabled) return null;
  return <><Analytics beforeSend={filterSiteAnalyticsEvent} /><SpeedInsights beforeSend={filterAnalyticsEvent} /></>;
}
