"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

type InstallChoice = { outcome: "accepted" | "dismissed" };
type InstallPromptEvent = Event & {
  prompt: () => Promise<unknown>;
  userChoice: Promise<InstallChoice>;
};
type DeferredInstall = { event: InstallPromptEvent; choice: Promise<InstallChoice | null> };

function standaloneSnapshot(): boolean | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return null;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true;
}

function subscribeStandalone(listener: () => void) {
  const media = window.matchMedia?.("(display-mode: standalone)");
  if (!media) return () => {};
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }
  media.addListener?.(listener);
  return () => media.removeListener?.(listener);
}

const serverStandaloneSnapshot = () => null;

export default function InstallMekivo({ className = "" }: { className?: string } = {}) {
  const standalone = useSyncExternalStore(subscribeStandalone, standaloneSnapshot, serverStandaloneSnapshot);
  const [canInstall, setCanInstall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("");
  const deferred = useRef<DeferredInstall | null>(null);
  const attempted = useRef(false);
  const mounted = useRef(false);
  const installedRef = useRef(false);
  const summaryRef = useRef<HTMLElement>(null);
  const statusId = useId();

  useEffect(() => {
    mounted.current = true;
    const beforeInstall = (event: Event) => {
      const promptEvent = event as InstallPromptEvent;
      if (typeof promptEvent.prompt !== "function" || typeof promptEvent.userChoice?.then !== "function") return;
      event.preventDefault();
      if (attempted.current || installedRef.current || standaloneSnapshot() === true) return;
      // Handle either promise rejecting, including a choice rejection before
      // the browser finishes opening its prompt. Each event is consumed once.
      deferred.current = { event: promptEvent, choice: promptEvent.userChoice.then(choice => choice, () => null) };
      setCanInstall(true);
    };
    const appInstalled = () => {
      installedRef.current = true;
      deferred.current = null;
      setCanInstall(false);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      mounted.current = false;
      deferred.current = null;
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  const install = async () => {
    const pending = deferred.current;
    if (!pending || attempted.current || installedRef.current || standaloneSnapshot() === true) return;
    attempted.current = true;
    deferred.current = null;
    setBusy(true);
    setMessage("");
    try {
      await pending.event.prompt();
      const choice = await pending.choice;
      if (!mounted.current || installedRef.current) return;
      setMessage(choice?.outcome === "accepted"
        ? "Installation requested. Complete your browser’s steps, then open Mekivo from your home screen or app launcher."
        : choice?.outcome === "dismissed"
          ? "Installation cancelled. You can use the browser steps below whenever you’re ready."
          : "Your browser could not confirm installation. Use the steps below, or bookmark Mekivo.");
    } catch {
      if (mounted.current && !installedRef.current) setMessage("Your browser could not open installation. Use the steps below, or bookmark Mekivo.");
    } finally {
      if (mounted.current && !installedRef.current) {
        // Return keyboard focus before removing the single-use install button.
        summaryRef.current?.focus();
        setCanInstall(false);
        setBusy(false);
      }
    }
  };

  // Wait for the browser snapshot so installed users do not see a promotion
  // during server rendering or hydration.
  if (standalone !== false || installed) return null;

  return <details className={`mx-auto mb-4 max-w-4xl rounded-xl border border-outline/15 bg-overlay/[0.035] ${className}`}>
    <summary ref={summaryRef} className="min-h-11 cursor-pointer rounded-xl px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
      <span className="inline-flex items-center gap-3 align-middle">
        <Image src="/icons/mekivo-192.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
        <span><span className="block text-sm font-semibold">Add Mekivo to your home screen</span><span className="block text-xs text-muted">Quick access to your car and parts searches</span></span>
      </span>
    </summary>
    <div className="border-t border-outline/10 px-4 pb-4 pt-3 text-sm text-muted">
      <h2 className="sr-only">Install Mekivo</h2>
      <p className="leading-6">Add a Mekivo icon using your browser. Live searches need an internet connection.</p>
      {(canInstall || busy) && <button type="button" onClick={() => void install()} disabled={busy} aria-describedby={statusId}
        className="mt-3 min-h-11 rounded-xl bg-sky-400 px-4 py-2 font-bold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-wait disabled:opacity-60">
        {busy ? "Opening installation…" : "Install Mekivo"}
      </button>}
      <p id={statusId} role="status" aria-live="polite" className={message ? "mt-3 leading-6 text-link" : "sr-only"}>{message}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <section>
          <h3 className="font-semibold text-foreground">iPhone · Safari</h3>
          {/* https://support.apple.com/en-gb/guide/iphone/iphea86e5236/ios */}
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5">
            <li>Open Mekivo in Safari.</li>
            <li>Tap Share, or open Safari’s page menu and choose Share.</li>
            <li>Choose Add to Home Screen. If missing, use Edit Actions to add the option.</li>
            <li>Enable Open as Web App if shown, then tap Add.</li>
          </ol>
        </section>
        <section>
          <h3 className="font-semibold text-foreground">Android · Chrome</h3>
          {/* https://support.google.com/chrome/answer/9658361?hl=en&co=GENIE.Platform%3DAndroid */}
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5">
            <li>Open Mekivo in Chrome.</li>
            <li>Open the ⋮ menu, then choose Install and create shortcut → Install when available.</li>
            <li>Follow Chrome’s instructions to add the icon.</li>
          </ol>
        </section>
      </div>
      <p className="mt-3 text-xs leading-5 text-subtle">Other browsers may offer installation in their menu. If no install option appears, bookmark Mekivo for quick access.</p>
    </div>
  </details>;
}
