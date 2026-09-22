import { track } from "@vercel/analytics";
import { analyticsAudience, initializeAnalyticsAudience } from "./analytics-audience";

const campaignKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
// Only approved marketing labels: never retain arbitrary query text or identifiers.
// Add new campaign/creative labels here before publishing their links.
const campaignLabels: Record<typeof campaignKeys[number], readonly string[]> = {
  utm_source: ["meta", "facebook", "instagram", "tiktok"],
  utm_medium: ["paid_social", "organic_social"],
  utm_campaign: ["september_demo", "september_validation"],
  utm_content: ["budget_car", "part_number", "visual_guide", "wrong_part_v1", "car_search_v1", "part_number_v1", "car_shortlist_v1", "part_number_v2", "visual_guide_v2", "car_shortlist_v1_audio", "part_number_v2_audio", "visual_guide_v2_audio"],
};
const campaignStorageKey = "mekivo_campaign_v2";
const segmentLimit = 48;
let rememberedCampaign: string | null = null;

function campaignSegment(key: typeof campaignKeys[number], value: string | null) {
  if (!value || value.length > segmentLimit) return "unknown";
  const normalized = value.trim().toLowerCase();
  return /^[a-z][a-z0-9_-]*$/.test(normalized) && campaignLabels[key].includes(normalized) ? normalized : "unknown";
}

function campaignProperty() {
  const params = new URLSearchParams(window.location.search);
  if (campaignKeys.some((key) => params.has(key))) {
    // A new campaign replaces the whole tuple, including missing/invalid fields.
    rememberedCampaign = campaignKeys.map((key) => campaignSegment(key, params.get(key))).join("|");
    try { window.sessionStorage.setItem(campaignStorageKey, rememberedCampaign); } catch { /* Attribution stays optional. */ }
  } else if (rememberedCampaign === null) {
    rememberedCampaign = "direct";
    try {
      const stored = window.sessionStorage.getItem(campaignStorageKey);
      if (stored && stored.length <= segmentLimit * 4 + 3) {
        const segments = stored.split("|");
        if (segments.length === campaignKeys.length) {
          rememberedCampaign = campaignKeys.map((key, index) => campaignSegment(key, segments[index])).join("|");
        }
      }
    } catch { /* Private browser storage can be unavailable. */ }
  }
  return rememberedCampaign;
}

type EventProperties = Record<string, string | number | boolean>;
const marketplaces = ["all", "more", "autotrader", "facebook", "ebay", "motors", "gumtree", "cargurus", "pistonheads", "aacars", "carandclassic"];
const searchMethods = ["vehicle", "diagram", "catalogue", "search", "part_number"];

function choice(value: unknown, allowed: readonly string[]) {
  return typeof value === "string" && allowed.includes(value) ? value : "unknown";
}

function eventContext(name: string, properties: EventProperties) {
  const type = choice(properties.search_type, ["cars", "parts"]);
  const method = choice(properties.search_method, searchMethods);
  const marketplace = choice(properties.marketplace, marketplaces);
  switch (name) {
    case "campaign_landing":
      return choice(properties.landing_mode, ["cars", "parts"]);
    case "vehicle_lookup_success":
      return `parts:${properties.has_model === true ? "model_found" : "model_missing"}`;
    case "search_submitted":
      return `${type}:${type === "cars" ? marketplace : method}`;
    case "results_shown":
    case "results_empty":
      return `${type}:${properties.result_kind === "marketplace_links" ? "marketplace_links" : method}`;
    case "results_error":
      return `${type}:${method}:${choice(properties.reason, ["timeout", "unavailable"])}`;
    case "marketplace_outbound":
      return `${type}:${marketplace}:${choice(properties.destination, ["search_results", "listing", "all_results"])}`;
    default:
      return null;
  }
}

type GrowthEvent = { name: string; properties: { campaign: string; context: string } };
const pendingEvents: GrowthEvent[] = [];
const startupWaitMs = 2000;
const audienceWaitMs = 11000;
let audienceDeadline = 0;
let startupDeadline = 0;
let startupTimer: ReturnType<typeof setTimeout> | undefined;

function sendEvent(event: GrowthEvent) {
  if (analyticsAudience() !== "included") return;
  try { track(event.name, event.properties); } catch { /* Analytics never blocks a search or outbound click. */ }
}

function flushPendingEvents() {
  const audience = analyticsAudience();
  if (audience === "pending" && Date.now() < audienceDeadline) return false;
  if (audience === "included" && startupDeadline === 0) startupDeadline = Date.now() + startupWaitMs;
  const expired = audience !== "included" || Date.now() >= startupDeadline;
  if (!expired && typeof window.va !== "function") return false;
  if (startupTimer !== undefined) clearTimeout(startupTimer);
  startupTimer = undefined;
  startupDeadline = 0;
  const events = pendingEvents.splice(0);
  if (!expired) events.forEach(sendEvent);
  return true;
}

function awaitAnalytics() {
  startupTimer = undefined;
  if (!flushPendingEvents()) startupTimer = setTimeout(awaitAnalytics, 50);
}

export function trackGrowthEvent(name: string, properties: EventProperties = {}) {
  try {
    if (typeof window === "undefined") return;
    initializeAnalyticsAudience();
    const audience = analyticsAudience();
    if (audience === "excluded") { flushPendingEvents(); return; }
    const context = eventContext(name, properties);
    if (context === null) return;
    const event = { name, properties: { campaign: campaignProperty(), context } };
    if (audience === "included" && typeof window.va === "function") {
      flushPendingEvents();
      sendEvent(event);
    } else {
      // The SDK's track() silently drops calls before <Analytics> initializes va.
      // Keep only a short, bounded startup buffer; never inject another SDK/script.
      if (pendingEvents.length < 20) pendingEvents.push(event);
      if (startupTimer === undefined) {
        audienceDeadline = Date.now() + audienceWaitMs;
        startupDeadline = audience === "included" ? Date.now() + startupWaitMs : 0;
        startupTimer = setTimeout(awaitAnalytics, 50);
      }
    }
  } catch { /* Optional analytics/storage must not affect the visitor's action. */ }
}
