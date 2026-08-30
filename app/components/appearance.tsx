"use client";

import { useEffect, useSyncExternalStore } from "react";

const key = "mekivo-appearance";
type Preference = "light" | "dark" | "system";
let memoryPreference: Preference | null = null;

function preference(): Preference {
  if (memoryPreference) return memoryPreference;
  try {
    const saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* Appearance remains usable when storage is blocked. */ }
  return "system";
}

function snapshot() {
  const mode = preference();
  return `${mode}:${mode === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode}`;
}

function subscribe(notify: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const storage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      memoryPreference = null;
      notify();
    }
  };
  window.addEventListener("mekivo-appearance-change", notify);
  window.addEventListener("storage", storage);
  media.addEventListener("change", notify);
  return () => {
    window.removeEventListener("mekivo-appearance-change", notify);
    window.removeEventListener("storage", storage);
    media.removeEventListener("change", notify);
  };
}

function useAppearance() {
  return useSyncExternalStore(subscribe, snapshot, () => "system:dark").split(":");
}

function choose(mode: Preference) {
  memoryPreference = mode;
  try { localStorage.setItem(key, mode); } catch { /* Keep the in-memory choice. */ }
  window.dispatchEvent(new Event("mekivo-appearance-change"));
}

/** Mounted in the root layout so device changes also apply on account/support pages. */
export function AppearanceRuntime() {
  const [mode, resolved] = useAppearance();
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.appearance = mode;
  }, [mode, resolved]);
  return null;
}

export default function AppearanceControl() {
  const [mode, resolved] = useAppearance();
  const dark = resolved === "dark";
  return (
    <div className="appearance-control" role="group" aria-label="Appearance">
      <button type="button" role="switch" aria-checked={dark} aria-label="Dark appearance"
        title={dark ? "Switch to light appearance" : "Switch to dark appearance"}
        className="appearance-toggle" onClick={() => choose(dark ? "light" : "dark")}>
        <span className="appearance-track" aria-hidden="true"><span className="appearance-thumb">{dark ? "☾" : "☀"}</span></span>
        <span className="hidden lg:inline">{dark ? "Dark" : "Light"}</span>
      </button>
      <button type="button" aria-pressed={mode === "system"} aria-label="Use device appearance setting"
        title="Use device setting — automatically follow your phone or computer"
        className="appearance-device" onClick={() => choose("system")}>
        <svg width="16" height="18" viewBox="0 0 16 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="1" width="10" height="18" rx="2"/><path d="M6 4h4M7 16h2"/></svg>
        <span>Device</span>
      </button>
      <span className="sr-only" role="status">{mode === "system" ? `Following device setting: ${resolved}` : `${resolved} appearance selected`}</span>
    </div>
  );
}
