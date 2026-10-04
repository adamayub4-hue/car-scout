"use client";

import { useId, useRef, useState } from "react";
import { getSharedSearchUrl, type SavedSearchItem } from "../lib/saved-search";
import { shareSearchLink } from "../lib/share-search";

export default function ShareSearchButton({ item }: { item: SavedSearchItem }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fallbackLink, setFallbackLink] = useState("");
  const [attemptPath, setAttemptPath] = useState("");
  const pending = useRef(false);
  const statusId = useId();
  const currentPath = getSharedSearchUrl(item);
  const currentMessage = attemptPath === currentPath ? message : "";
  const currentFallback = attemptPath === currentPath ? fallbackLink : "";
  const share = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setAttemptPath(currentPath); setMessage(""); setFallbackLink("");
    let url = "";
    try {
      url = new URL(currentPath, window.location.origin).toString();
      const result = await shareSearchLink(url, item.kind === "car_search" ? "Mekivo car search" : "Mekivo parts search", navigator);
      setMessage(result === "shared" ? "Search shared." : result === "copied" ? "Search link copied." : "Sharing cancelled.");
    } catch {
      setMessage("Could not share or copy automatically. Select and copy the link below.");
      setFallbackLink(url);
    } finally { pending.current = false; setBusy(false); }
  };

  return <div className="min-w-0 flex-1 sm:max-w-72">
    <button type="button" onClick={share} disabled={busy} aria-describedby={statusId}
      className="min-h-11 rounded-xl border border-outline/15 px-3 py-2 text-sm font-semibold text-link hover:bg-overlay/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-wait disabled:opacity-60">
      {busy ? "Sharing…" : "Share this search"}
    </button>
    <p id={statusId} role="status" className="mt-1 text-xs leading-5 text-muted">{currentMessage || "Postcode and registration are excluded."}</p>
    {currentFallback && <input aria-label="Search link to copy" readOnly value={currentFallback} onFocus={event => event.currentTarget.select()}
      className="mt-2 min-h-11 w-full rounded-lg border border-outline/20 bg-panel px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-sky-400" />}
  </div>;
}
