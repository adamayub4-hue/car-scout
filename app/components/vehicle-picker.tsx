"use client";

import { forwardRef, useImperativeHandle, useRef, useState, type KeyboardEvent } from "react";
import { vehiclePickerOptions, vehiclePickerValue } from "../lib/vehicle-picker-options";

export type VehiclePickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  optional?: boolean;
};

const VehiclePicker = forwardRef<HTMLButtonElement, VehiclePickerProps>(function VehiclePicker({
  id, label, value, onChange, options, placeholder = `Choose ${label.toLowerCase()}`, disabled = false, optional = false,
}, forwardedRef) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useImperativeHandle(forwardedRef, () => triggerRef.current!, []);

  const suggestions = vehiclePickerOptions(options, query);
  const typedValue = vehiclePickerValue(options, query);
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const dialogId = `${id}-dialog`;
  const titleId = `${id}-title`;
  const helpId = `${id}-help`;

  function showPicker() {
    if (disabled || !dialogRef.current || dialogRef.current.open) return;
    setQuery("");
    // Keep this in the initiating click: a tap opens the list immediately,
    // without waiting for focus, a second click, or a software keyboard.
    dialogRef.current.showModal();
    setOpen(true);
    closeRef.current?.focus({ preventScroll: true });
  }

  function choose(nextValue: string) {
    if (nextValue !== value) onChange(nextValue);
    dialogRef.current?.close();
  }

  function focusOptions(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("[data-vehicle-option]") ?? []);
    if (!buttons.length) return;
    const current = buttons.indexOf(event.currentTarget);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[next].focus();
  }

  return <div className="min-w-0 text-sm text-muted">
    <span id={labelId} className="mb-2 block">{label}{optional && <span className="text-subtle"> (optional)</span>}</span>
    <button ref={triggerRef} id={id} type="button" disabled={disabled}
      aria-labelledby={`${labelId} ${valueId}`} aria-haspopup="dialog" aria-controls={dialogId} aria-expanded={open}
      onClick={showPicker}
      className="vehicle-picker-trigger flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-outline/15 bg-overlay/[0.06] px-4 py-3.5 text-left text-base text-foreground outline-none transition hover:border-sky-400/50 focus-visible:border-sky-400/60 focus-visible:ring-4 focus-visible:ring-sky-400/10 disabled:cursor-not-allowed disabled:opacity-40">
      <span id={valueId} className={`min-w-0 break-words ${value ? "" : "text-subtle"}`}>{value || placeholder}</span>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-4 w-4 shrink-0"><path d="m5 7 5 5 5-5" /></svg>
    </button>
    <dialog ref={dialogRef} id={dialogId} aria-labelledby={titleId} aria-describedby={helpId}
      onClose={() => { setOpen(false); triggerRef.current?.focus({ preventScroll: true }); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-2xl border border-outline/20 bg-panel p-0 text-foreground shadow-2xl backdrop:bg-slate-950/70">
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-outline/10 px-4 py-3">
          <h2 id={titleId} className="text-lg font-bold">Choose {label.toLowerCase()}</h2>
          <button ref={closeRef} type="button" onClick={() => dialogRef.current?.close()}
            aria-label={`Close ${label.toLowerCase()} picker`}
            className="min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">Close</button>
        </div>
        <div className="shrink-0 border-b border-outline/10 p-4">
          <label htmlFor={`${id}-search`} className="mb-2 block text-sm font-medium text-muted">Search or type a {label.toLowerCase()}</label>
          <input id={`${id}-search`} value={query} onChange={event => setQuery(event.target.value)}
            autoComplete="off" autoCorrect="off" spellCheck={false} placeholder={`Type any ${label.toLowerCase()}`}
            onKeyDown={event => {
              if (event.key === "Enter" && typedValue) { event.preventDefault(); choose(typedValue); }
              if (event.key === "ArrowDown" && suggestions.length) {
                event.preventDefault();
                dialogRef.current?.querySelector<HTMLButtonElement>("[data-vehicle-option]")?.focus();
              }
            }}
            className="min-h-12 w-full rounded-xl border border-outline/20 bg-background px-3 py-3 text-base text-foreground outline-none placeholder:text-subtle focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20" />
          <p id={helpId} className="mt-2 text-xs leading-5 text-subtle">Choose a suggestion, or enter a different {label.toLowerCase()}.</p>
          {typedValue && <button type="button" onClick={() => choose(typedValue)}
            className="mt-3 min-h-11 w-full break-words rounded-xl bg-sky-400 px-3 py-2.5 text-left text-base font-semibold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">Use “{typedValue}”</button>}
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-2">
          {(optional || value) && <button type="button" onClick={() => choose("")}
            className="min-h-12 w-full rounded-xl px-3 py-3 text-left text-base text-link hover:bg-overlay/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-400">{optional ? `Any ${label.toLowerCase()}` : `Clear ${label.toLowerCase()}`}</button>}
          {suggestions.length > 0 ? <ul aria-label={`${label} suggestions`}>
            {suggestions.map(option => <li key={option}>
              <button type="button" data-vehicle-option onKeyDown={focusOptions} onClick={() => choose(option)}
                aria-pressed={option.toLocaleLowerCase("en-GB") === value.trim().toLocaleLowerCase("en-GB")}
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-base hover:bg-overlay/5 focus-visible:bg-sky-400/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-400 aria-pressed:bg-sky-400/10 aria-pressed:font-semibold">
                <span>{option}</span>{option.toLocaleLowerCase("en-GB") === value.trim().toLocaleLowerCase("en-GB") && <span aria-hidden="true" className="text-link">✓</span>}
              </button>
            </li>)}
          </ul> : <p role="status" className="px-3 py-4 text-sm leading-6 text-muted">{query.trim() ? "No matching suggestions. Use your entry above." : `Type the ${label.toLowerCase()} to continue.`}</p>}
        </div>
      </div>
    </dialog>
  </div>;
});

export default VehiclePicker;
