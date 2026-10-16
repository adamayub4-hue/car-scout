import { trackGrowthEvent } from "./growth-events";

let recorded = false;
/** One landing per document, including when a visitor moves between search pages. */
export function trackCampaignLanding(landingMode: "cars" | "motorbikes" | "parts") {
  if (recorded || typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!["utm_source", "utm_medium", "utm_campaign", "utm_content"].some(key => params.has(key))) return;
  recorded = true;
  trackGrowthEvent("campaign_landing", { landing_mode: landingMode });
}
