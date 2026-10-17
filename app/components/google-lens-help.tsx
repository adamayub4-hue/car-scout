"use client";

import { useRef, useState } from "react";

export default function GoogleLensHelp({ onChoose }: { onChoose: (name: string) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function chooseName() {
    const value = name.trim();
    if (!value) return;
    dialogRef.current?.close();
    onChoose(value);
  }

  return <>
    <button ref={triggerRef} type="button" aria-haspopup="dialog" aria-controls="google-lens-help" aria-expanded={open}
      onClick={() => { if (dialogRef.current?.open) return; dialogRef.current?.showModal(); setOpen(true); closeRef.current?.focus({ preventScroll: true }); }}
      className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-outline/20 px-3 py-3 text-sm font-semibold transition hover:border-sky-400/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className="h-5 w-5 shrink-0"><path d="M4 6h4l2-3h4l2 3h4v14H4z" /><circle cx="12" cy="12" r="4" /></svg>
      Use a photo
    </button>
    <dialog ref={dialogRef} id="google-lens-help" aria-labelledby="google-lens-title" aria-describedby="google-lens-instructions"
      onClose={() => { setOpen(false); triggerRef.current?.focus({ preventScroll: true }); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-outline/20 bg-panel p-5 text-foreground shadow-2xl backdrop:bg-slate-950/70">
      <div className="flex items-center justify-between gap-3">
        <h2 id="google-lens-title" className="text-lg font-bold">Find the part with Google Lens</h2>
        <button ref={closeRef} type="button" onClick={() => dialogRef.current?.close()} aria-label="Close photo help" className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link">Close</button>
      </div>
      <p id="google-lens-instructions" className="mt-3 text-sm leading-6 text-muted">Open Google, tap the camera icon and take or choose a photo. It&apos;s free on iPhone, Android and computers.</p>
      <a href="https://www.google.com/" target="_blank" rel="noopener noreferrer" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-center font-bold text-slate-950 transition hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">
        Open Google <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab for Google Lens)</span>
      </a>
      <p className="mt-3 text-sm leading-6 text-muted"><strong className="text-foreground">Mekivo stays open here.</strong> Close Google&apos;s tab or switch back from the Google app when you have a part name.</p>
      <div className="mt-4 border-t border-outline/15 pt-4">
        <label htmlFor="google-lens-part-name" className="mb-2 block text-sm font-semibold">Got the part name? Enter it here</label>
        <input id="google-lens-part-name" value={name} maxLength={120} onChange={event => setName(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); chooseName(); } }}
          placeholder="e.g. brake caliper" className="min-h-12 w-full rounded-xl border border-outline/20 bg-background px-3 py-3 text-base outline-none placeholder:text-subtle focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20" />
        <button type="button" disabled={!name.trim()} onClick={chooseName} className="mt-3 min-h-12 w-full rounded-xl border border-outline/20 px-4 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link disabled:cursor-not-allowed disabled:opacity-40">Use this part name</button>
      </div>
      <p className="mt-3 text-xs leading-5 text-subtle">You choose your photo on Google. A suggested name does not confirm that a part fits your vehicle.</p>
    </dialog>
  </>;
}
