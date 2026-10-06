import { analyticsAudience } from "./analytics-audience";
import { trackGrowthEvent } from "./growth-events";

type AppDisplayMode = "standalone" | "browser";
const openedModes = new Set<AppDisplayMode>();
let initialized = false;
let installRecorded = false;

export function appDisplayMode(): AppDisplayMode | null {
  if (typeof window === "undefined") return null;
  if (typeof navigator !== "undefined" && (navigator as Navigator & { standalone?: boolean }).standalone === true) return "standalone";
  try {
    // Generic browser fullscreen does not establish a home-screen/app launch.
    return window.matchMedia?.("(display-mode: standalone)").matches === true ? "standalone" : "browser";
  } catch { return "browser"; }
}

export function trackAppOpen() {
  try {
    if (analyticsAudience() === "excluded") return;
    const mode = appDisplayMode();
    if (!mode || openedModes.has(mode)) return;
    // Claim only an eligible mode. Pending owner checks and SDK startup use the
    // existing growth-event buffer; navigation and auth refresh cannot repeat it.
    openedModes.add(mode);
    trackGrowthEvent(mode === "standalone" ? "app_open" : "browser_open", {});
  } catch { /* Optional analytics must not affect the page. */ }
}

function trackConfirmedInstall() {
  try {
    if (installRecorded || analyticsAudience() === "excluded") return;
    installRecorded = true;
    trackGrowthEvent("app_install", {});
  } catch { /* Optional analytics must not affect installation. */ }
}

export function initializeAppUsage() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  // These document-lifetime listeners survive component remounts. Only the
  // browser's appinstalled signal confirms installation, never prompt acceptance.
  window.addEventListener("appinstalled", trackConfirmedInstall);
  try {
    const media = window.matchMedia?.("(display-mode: standalone)");
    if (typeof media?.addEventListener === "function") media.addEventListener("change", trackAppOpen);
    else media?.addListener?.(trackAppOpen);
  } catch { /* Browsers without display-mode observation still record launches. */ }
}
