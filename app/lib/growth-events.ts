import { track } from "@vercel/analytics";

const campaignKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

function campaignProperties() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const properties: Record<string, string> = {};
  campaignKeys.forEach((key) => {
    const current = params.get(key)?.slice(0, 80);
    let stored: string | null = null;
    try { stored = window.sessionStorage.getItem(`mekivo_${key}`); } catch { /* Private browser storage can be unavailable. */ }
    const value = current || stored;
    if (current) { try { window.sessionStorage.setItem(`mekivo_${key}`, current); } catch { /* Attribution stays optional. */ } }
    if (value) properties[key] = value;
  });
  return properties;
}

export function trackGrowthEvent(name: string, properties: Record<string, string | number | boolean> = {}) {
  try {
    track(name, { ...campaignProperties(), ...properties });
  } catch { /* Analytics must never block a search or outbound click. */ }
}
