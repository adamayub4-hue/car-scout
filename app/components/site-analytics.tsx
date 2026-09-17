"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { analyticsAudience, filterAnalyticsEvent, initializeAnalyticsAudience, subscribeAnalyticsAudience } from "../lib/analytics-audience";

export function SiteAnalytics() {
  usePathname(); // Recheck excluded paths on client-side navigation.
  const audience = useSyncExternalStore(subscribeAnalyticsAudience, analyticsAudience, () => "pending");
  const [enabled, setEnabled] = useState(false);
  useEffect(initializeAnalyticsAudience, []);
  useEffect(() => {
    if (enabled || audience !== "included") return;
    const timer = window.setTimeout(() => setEnabled(true), 0);
    return () => window.clearTimeout(timer);
  }, [audience, enabled]);
  // Keep an initialized SDK mounted: remounting on token refresh duplicates pageviews.
  // The live beforeSend guard still blocks every pending/excluded event.
  if (!enabled) return null;
  return <><Analytics beforeSend={filterAnalyticsEvent} /><SpeedInsights beforeSend={filterAnalyticsEvent} /></>;
}
