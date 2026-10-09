"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { initializeReturnVisits, returnVisitPreference, setReturnVisitPreference, subscribeReturnVisitPreference } from "../lib/return-visits";
import { analyticsAudience, subscribeAnalyticsAudience } from "../lib/analytics-audience";

export function ReturnVisitPreference({ settings = false }: { settings?: boolean }) {
  const pathname = usePathname();
  const preference = useSyncExternalStore(subscribeReturnVisitPreference, returnVisitPreference, () => "unknown");
  const audience = useSyncExternalStore(subscribeAnalyticsAudience, analyticsAudience, () => "pending");
  const [message, setMessage] = useState("");
  useEffect(initializeReturnVisits, []);
  const internal = ["/admin", "/account", "/traffic-settings", "/return-visit-settings", "/forgot-password", "/reset-password"]
    .some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const excludedProductionBrowser = typeof window !== "undefined" && ["mekivo.uk", "www.mekivo.uk"].includes(window.location.hostname) && audience === "excluded";
  if (!settings && (internal || excludedProductionBrowser || (preference !== "unknown" && !message))) return null;
  const choose = (choice: "allowed" | "declined") => {
    const saved = setReturnVisitPreference(choice);
    setMessage(`${choice === "allowed" ? "Return counting is allowed." : "Return counting is off and this browser’s return history has been removed where storage is available."}${saved ? "" : " Your browser could not save this choice; it applies to this page only. Check this setting again after reopening Mekivo."}`);
  };
  return <section aria-label="Optional return visit counting" className="mx-4 my-6 max-w-3xl rounded-2xl border border-outline/20 bg-panel p-5 text-foreground sm:mx-auto">
    {(settings || !message) && <>
      <h2 className="text-lg font-semibold">{settings ? "Return visit counting" : "May we count when you come back?"}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Optional: remember only the last time this browser was active. We count a return after at least 30 minutes without activity, using visit times less than 30 days old. Older history is ignored and replaced on your next allowed visit. We do not store a name, account or identifying code for this counter. Your usual visit reports and website features are unaffected.</p>
      <p className="mt-2 text-sm leading-6 text-muted">Returns mean visits by browsers that agree, rather than different people. Clearing storage or using another browser or device loses the history.</p>
      {settings && <p className="mt-3 text-sm font-medium">Current choice: {preference === "allowed" ? "Allowed" : preference === "declined" ? "Off" : "Not chosen — off"}.</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => choose("allowed")} className="rounded-lg border border-link px-4 py-2 text-sm font-semibold text-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link">Allow return counting</button>
        <button type="button" onClick={() => choose("declined")} className="rounded-lg border border-link px-4 py-2 text-sm font-semibold text-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link">{settings ? "Disable and delete return history" : "No thanks"}</button>
      </div>
    </>}
    {message && <p role="status" className="text-sm leading-6">{message}</p>}
    <p className="mt-3 text-sm"><Link href="/return-visit-settings" className="font-semibold text-link underline">Change return counting</Link> · <Link href="/privacy" className="text-link underline">Privacy information</Link></p>
  </section>;
}
