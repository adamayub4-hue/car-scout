import { track } from "@vercel/analytics";
import { analyticsAudience, subscribeAnalyticsAudience } from "./analytics-audience";

export type ReturnVisitPreference = "unknown" | "allowed" | "declined";
const preferenceKey = "mekivo_return_visit_preference_v1";
const historyKey = "mekivo_return_visit_last_seen_v1";
const visitGapMs = 30 * 60 * 1000;
const historyLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const startupWaitMs = 2000;
const activityWriteGapMs = 1000;
let preferenceInMemory: ReturnVisitPreference | undefined;
let initialized = false;
let lastActivityWrite = 0;
let startFresh = false;
let activityQueued = false;
let revision = 0;
let pending: { revision: number; expiresAt: number } | undefined;
let startupTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export function returnVisitPreference(): ReturnVisitPreference {
  if (typeof window === "undefined") return "unknown";
  if (preferenceInMemory !== undefined) return preferenceInMemory;
  try {
    const value = window.localStorage.getItem(preferenceKey);
    return value === "allowed" || value === "declined" ? value : "unknown";
  } catch { return "unknown"; }
}

export function subscribeReturnVisitPreference(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify() { listeners.forEach((listener) => listener()); }
function eligible() {
  if (returnVisitPreference() !== "allowed" || analyticsAudience() !== "included") return false;
  // Check the shared choice again rather than waiting for an asynchronous
  // storage event from another tab. Unreadable storage fails closed as well.
  try { return window.localStorage.getItem(preferenceKey) === "allowed"; } catch { return false; }
}
function visible() { return typeof document === "undefined" || document.visibilityState === "visible"; }

function cancelPending() {
  revision++;
  pending = undefined;
  if (startupTimer !== undefined) clearTimeout(startupTimer);
  startupTimer = undefined;
  // A slow SDK can still have its own startup queue. Withdraw only this optional
  // event; pageviews, marketing events and the shared beforeSend stay untouched.
  if (typeof window !== "undefined" && Array.isArray(window.vaq)) {
    for (let index = window.vaq.length - 1; index >= 0; index--) {
      const [command, value] = window.vaq[index];
      if (command === "event" && (value as { name?: unknown } | undefined)?.name === "return_visit") window.vaq.splice(index, 1);
    }
  }
}

function deleteHistory() {
  lastActivityWrite = 0;
  try { window.localStorage.removeItem(historyKey); } catch { /* In-memory preference still stops all history access. */ }
}

/** Saves only a choice. Allowing starts fresh rather than replaying old history. */
export function setReturnVisitPreference(choice: "allowed" | "declined"): boolean {
  if (typeof window === "undefined") return false;
  preferenceInMemory = choice;
  startFresh = true;
  cancelPending();
  deleteHistory();
  let saved = false;
  try { window.localStorage.setItem(preferenceKey, choice); saved = true; }
  catch {
    // A quota failure can leave a previous Allow value readable. Remove it when
    // possible so a later reload defaults to unknown instead of resurrecting it.
    try { window.localStorage.removeItem(preferenceKey); } catch { /* Explain that the change is only for this page. */ }
  }
  notify();
  if (choice === "allowed") trackReturnVisitActivity();
  return saved;
}

function sendPending() {
  startupTimer = undefined;
  const event = pending;
  if (!event) return;
  if (event.revision !== revision || !eligible() || Date.now() >= event.expiresAt) { pending = undefined; return; }
  if (typeof window.va !== "function") { startupTimer = setTimeout(sendPending, 50); return; }
  pending = undefined;
  try { track("return_visit", { context: "browser" }); } catch { /* Optional counting never affects the website. */ }
}

/** A return is a remembered browser becoming active after 30 minutes without activity. */
export function trackReturnVisitActivity() {
  try {
    if (typeof window === "undefined" || typeof navigator === "undefined" || !eligible() || !visible()
      || typeof navigator.locks?.request !== "function" || activityQueued) return;
    const expectedRevision = revision;
    activityQueued = true;
    // The fixed origin-scoped lock prevents two tabs reading the same old time
    // and both reporting one return. Without atomic updates, skip this counter.
    void navigator.locks.request("mekivo-return-visit-counter-v1", () => {
      try {
        if (expectedRevision !== revision || !eligible() || !visible()) return;
        const now = Date.now();
        if (lastActivityWrite !== 0 && now >= lastActivityWrite && now - lastActivityWrite < activityWriteGapMs) return;
        const stored = startFresh ? null : window.localStorage.getItem(historyKey);
        const previous = stored === null || !/^\d{1,16}$/.test(stored) ? NaN : Number(stored);
        const age = now - previous;
        const returning = Number.isSafeInteger(previous) && previous > 0 && age >= visitGapMs && age < historyLifetimeMs;
        // No timestamp write means no reliable memory, so do not emit a return.
        window.localStorage.setItem(historyKey, String(now));
        startFresh = false;
        lastActivityWrite = now;
        if (!returning || pending) return;
        pending = { revision, expiresAt: now + startupWaitMs };
        sendPending();
      } catch { /* Blocked or full storage means no return count. */ }
      finally { activityQueued = false; }
    }).catch(() => { activityQueued = false; });
  } catch { activityQueued = false; /* Optional counting never blocks the page. */ }
}

/** The runtime SDK exposes custom names in payload, beyond its public types. */
export function filterReturnVisitEvent<T extends { url: string; type?: string; payload?: { name?: unknown }; name?: unknown }>(event: T): T | null {
  if (event.type !== "event" || (event.payload?.name ?? event.name) !== "return_visit") return event;
  if (!eligible()) return null;
  // No search query, campaign, account or browser ID is sent for this counter.
  return { ...event, url: new URL("/", window.location.origin).href, payload: { name: "return_visit", data: { context: "browser" } } };
}

export function initializeReturnVisits() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== preferenceKey && event.key !== null) return;
    preferenceInMemory = undefined;
    startFresh = true;
    cancelPending();
    if (returnVisitPreference() !== "allowed") deleteHistory();
    notify();
    if (returnVisitPreference() === "allowed") trackReturnVisitActivity();
  });
  subscribeAnalyticsAudience(() => {
    if (analyticsAudience() !== "included") { cancelPending(); return; }
    trackReturnVisitActivity();
  });
  const activity = () => trackReturnVisitActivity();
  window.addEventListener("focus", activity);
  window.addEventListener("pageshow", activity);
  window.addEventListener("pointerdown", activity, { passive: true });
  window.addEventListener("keydown", activity);
  window.addEventListener("scroll", activity, { passive: true });
  document.addEventListener("visibilitychange", activity);
  trackReturnVisitActivity();
}
