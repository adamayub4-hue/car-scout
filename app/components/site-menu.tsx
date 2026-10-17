"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import AppearanceControl from "./appearance";

export default function SiteMenu() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    const dismissOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [open]);

  const close = () => setOpen(false);
  return <div ref={container} className="relative shrink-0">
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={panelId}
      onClick={() => setOpen(value => !value)}
      className="flex min-h-11 items-center gap-2 rounded-full border border-outline/15 bg-panel px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className="h-5 w-5"><path strokeLinecap="round" d={open ? "M6 6l12 12M6 18 18 6" : "M4 6h16M4 12h16M4 18h16"} /></svg>
      Menu
    </button>
    {open && <div id={panelId} className="absolute right-0 top-full mt-3 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-outline/20 bg-panel p-3 text-foreground shadow-2xl">
      <nav aria-label="Mekivo menu" className="grid gap-1 text-sm font-semibold">
        <Link href="/" onClick={close} className="rounded-xl px-3 py-3 text-link hover:bg-overlay/5">Home</Link>
        <Link href="/vehicle-check" onClick={close} className="rounded-xl px-3 py-3 text-link hover:bg-overlay/5">Free car check (tax & MOT)</Link>
        <Link href="/guides" onClick={close} className="rounded-xl px-3 py-3 text-link hover:bg-overlay/5">Buying & parts guides</Link>
        <Link href="/account" onClick={close} className="rounded-xl px-3 py-3 text-link hover:bg-overlay/5">My account & saved items</Link>
        <Link href="/support" onClick={close} className="rounded-xl px-3 py-3 text-link hover:bg-overlay/5">Help & feedback</Link>
      </nav>
      <div className="mt-2 border-t border-outline/10 px-2 pt-3">
        <p className="mb-2 text-xs font-semibold text-muted">Appearance</p>
        <AppearanceControl />
      </div>
    </div>}
  </div>;
}
