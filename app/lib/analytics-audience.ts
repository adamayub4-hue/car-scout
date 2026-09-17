import { getSupabaseBrowserClient } from "./supabase";
import { withRequestDeadline } from "./saved-search";

type Audience = "pending" | "included" | "excluded";
const exclusionKey = "mekivo_internal_traffic";
let audience: Audience = "pending";
let excludedInMemory = false;
let started = false;
let generation = 0;
const listeners = new Set<() => void>();

function notify() { listeners.forEach((listener) => listener()); }

export function subscribeAnalyticsAudience(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function browserExclusionStatus(): "saved" | "temporary" | "off" {
  if (typeof window === "undefined") return "off";
  try { if (window.localStorage.getItem(exclusionKey) === "1") return "saved"; } catch { /* Use memory when storage is blocked. */ }
  return excludedInMemory ? "temporary" : "off";
}

export function excludeThisBrowser() {
  excludedInMemory = true;
  try { window.localStorage.setItem(exclusionKey, "1"); } catch { /* The control explains that this lasts only for this page. */ }
  audience = "excluded";
  generation++;
  notify();
}

function productionHost(hostname: string) {
  return process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_VERCEL_ENV !== "preview"
    && ["mekivo.uk", "www.mekivo.uk"].includes(hostname);
}

function internalPath(pathname: string) {
  return ["/admin", "/traffic-settings", "/account", "/forgot-password", "/reset-password"]
    .some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function analyticsAudience(): Audience {
  if (typeof window === "undefined") return "excluded";
  if (!productionHost(window.location.hostname) || internalPath(window.location.pathname)
    || browserExclusionStatus() !== "off" || new URLSearchParams(window.location.search).get("analytics") === "off") return "excluded";
  return audience;
}

/** Also guard already-loaded SDKs, queued events, and client-side navigations. */
export function filterAnalyticsEvent<T extends { url: string }>(event: T): T | null {
  if (analyticsAudience() !== "included") return null;
  try {
    const url = new URL(event.url, window.location.origin);
    return productionHost(url.hostname) && !internalPath(url.pathname) && url.searchParams.get("analytics") !== "off" ? event : null;
  } catch { return null; }
}

export function initializeAnalyticsAudience() {
  if (typeof window === "undefined" || started) return;
  started = true;
  window.addEventListener("storage", (event) => {
    if (event.key === exclusionKey || event.key === null) notify();
  });
  if (new URLSearchParams(window.location.search).get("analytics") === "off") excludeThisBrowser();
  if (!productionHost(window.location.hostname) || browserExclusionStatus() !== "off") {
    audience = "excluded"; notify(); return;
  }
  const client = getSupabaseBrowserClient();
  if (!client) { audience = "excluded"; notify(); return; }

  const resolveUser = async (userId: string | undefined, version: number) => {
    try {
      const result = userId ? await withRequestDeadline(client.from("admins").select("user_id").eq("user_id", userId).maybeSingle(), 5000) : null;
      // Positive owner evidence stays useful even if sign-out won the async race.
      if (!result?.error && result?.data) { excludeThisBrowser(); return; }
      if (version !== generation) return;
      if (result?.error) throw result.error;
      audience = browserExclusionStatus() === "off" ? "included" : "excluded";
    } catch { if (version === generation) audience = "excluded"; }
    if (version === generation) notify();
  };
  // Keep this singleton listener for the lifetime of the page, including after SDK unmount.
  client.auth.onAuthStateChange((event, session) => {
    const uncertainSignOut = event === "SIGNED_OUT" && audience === "pending";
    const version = ++generation;
    audience = uncertainSignOut ? "excluded" : "pending";
    notify();
    // Do not release the first pageview as anonymous while an owner check is unresolved.
    // A late positive owner result still persists exclusion; otherwise this page stays out.
    if (uncertainSignOut) return;
    // Database work must run after Supabase releases its auth callback lock.
    window.setTimeout(() => { void resolveUser(session?.user.id, version); }, 0);
  });
  const version = ++generation;
  void withRequestDeadline(client.auth.getSession(), 5000).then(({ data, error }) => {
    if (version !== generation) return;
    if (error) throw error;
    return resolveUser(data.session?.user.id, version);
  }).catch(() => { if (version === generation) { audience = "excluded"; notify(); } });
}
