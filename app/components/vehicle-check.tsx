"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

type VehicleCheckResult = {
  registrationNumber?: string;
  make?: string;
  model?: string;
  yearOfManufacture?: number;
  engineCapacity?: number;
  fuelType?: string;
  colour?: string;
  motStatus?: string;
  motExpiryDate?: string;
  taxStatus?: string;
  taxDueDate?: string;
};

function displayText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : "Not provided";
}

function displayDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Not provided";
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "Not provided";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function statusColour(value: unknown, positive: string) {
  if (typeof value !== "string") return "border-outline/15 bg-panel";
  if (value.toLowerCase() === positive) return "border-success/25 bg-success/5";
  if (/^(untaxed|not valid)$/i.test(value)) return "border-danger/30 bg-danger/5";
  return "border-outline/15 bg-panel";
}

export default function VehicleCheck() {
  const [registration, setRegistration] = useState("");
  const [vehicle, setVehicle] = useState<VehicleCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<{ id: number; controller: AbortController | null }>({ id: 0, controller: null });

  useEffect(() => {
    const pending = request.current;
    return () => {
      pending.id += 1;
      pending.controller?.abort();
    };
  }, []);

  function changeRegistration(value: string) {
    request.current.id += 1;
    request.current.controller?.abort();
    setRegistration(value.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 11));
    setVehicle(null);
    setError("");
    setLoading(false);
  }

  async function checkVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = registration.replace(/[^A-Z0-9]/g, "");
    if (cleaned.length < 5 || cleaned.length > 8) {
      setError("Enter a valid UK registration, for example AB12 CDE.");
      return;
    }

    request.current.controller?.abort();
    const controller = new AbortController();
    const id = ++request.current.id;
    request.current.controller = controller;
    setLoading(true);
    setVehicle(null);
    setError("");

    try {
      const response = await fetch("/api/vehicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationNumber: cleaned }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (id !== request.current.id) return;
      if (response.status === 429) throw new Error("Too many registration checks. Please wait a minute and try again.");
      if (response.status === 400 || response.status === 404) throw new Error("We could not identify that vehicle. Check the registration and try again.");
      const payload = await response.json().catch(() => null) as { vehicle?: VehicleCheckResult } | null;
      if (id !== request.current.id) return;
      if (!response.ok || !payload?.vehicle || typeof payload.vehicle.make !== "string" || !payload.vehicle.make.trim()) {
        throw new Error("Vehicle checks are temporarily unavailable. Please try again later.");
      }
      setVehicle(payload.vehicle);
      setRegistration(cleaned);
    } catch (lookupError) {
      if (id !== request.current.id) return;
      setError(lookupError instanceof Error && lookupError.name !== "AbortError"
        ? lookupError.message
        : "The vehicle check could not be completed. Please try again.");
    } finally {
      if (id === request.current.id) setLoading(false);
    }
  }

  const details = vehicle ? [
    ["Make", displayText(vehicle.make)],
    ["Model", displayText(vehicle.model)],
    ["Year", typeof vehicle.yearOfManufacture === "number" && Number.isFinite(vehicle.yearOfManufacture) ? String(vehicle.yearOfManufacture) : "Not provided"],
    ["Colour", displayText(vehicle.colour)],
    ["Fuel", displayText(vehicle.fuelType)],
    ["Engine", typeof vehicle.engineCapacity === "number" && Number.isFinite(vehicle.engineCapacity) && vehicle.engineCapacity > 0 ? `${vehicle.engineCapacity.toLocaleString("en-GB")}cc` : "Not provided"],
  ] : [];

  return <section aria-label="UK vehicle tax and MOT check" className="rounded-3xl border border-outline/15 bg-panel p-5 sm:p-8">
    <form onSubmit={checkVehicle} aria-busy={loading}>
      <label htmlFor="vehicle-check-registration" className="block text-sm font-bold">UK registration number</label>
      <p id="vehicle-check-help" className="mt-2 text-sm leading-6 text-muted">Enter the registration to see the tax and MOT details held for the vehicle.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input id="vehicle-check-registration" type="text" value={registration} onChange={event => changeRegistration(event.target.value)}
          placeholder="AB12 CDE" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={11}
          aria-describedby={error ? "vehicle-check-help vehicle-check-error" : "vehicle-check-help"} aria-invalid={Boolean(error)}
          className="min-w-0 flex-1 rounded-2xl border-2 border-yellow-600 bg-yellow-300 px-4 py-4 text-center text-2xl font-extrabold uppercase tracking-[0.18em] text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link" />
        <button type="submit" disabled={loading} className="rounded-2xl bg-sky-400 px-6 py-4 font-bold text-slate-950 transition hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link disabled:opacity-60">
          {loading ? "Checking vehicle…" : "Check tax & MOT"}
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">Your registration is used for this check. It is not added to the page address or saved in this browser.</p>
      {loading && <p role="status" className="mt-4 text-sm text-muted">Checking official vehicle records…</p>}
      {error && <p id="vehicle-check-error" role="alert" className="mt-4 rounded-xl border border-danger/25 bg-danger/5 p-4 text-sm leading-6 text-foreground">{error}</p>}
    </form>

    {vehicle && <div role="status" aria-live="polite" className="mt-7">
      <h2 className="text-xl font-bold">{[vehicle.yearOfManufacture, vehicle.make, vehicle.model].filter(Boolean).join(" · ")}</h2>
      <p className="mt-1 text-sm text-muted">Check these details match the vehicle.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <section aria-labelledby="vehicle-check-tax" className={`rounded-2xl border p-5 ${statusColour(vehicle.taxStatus, "taxed")}`}>
          <h3 id="vehicle-check-tax" className="text-sm font-bold text-muted">Vehicle tax</h3>
          <p className="mt-2 text-2xl font-bold">{displayText(vehicle.taxStatus)}</p>
          <p className="mt-3 text-sm"><span className="text-muted">Tax due: </span>{displayDate(vehicle.taxDueDate)}</p>
        </section>
        <section aria-labelledby="vehicle-check-mot" className={`rounded-2xl border p-5 ${statusColour(vehicle.motStatus, "valid")}`}>
          <h3 id="vehicle-check-mot" className="text-sm font-bold text-muted">MOT</h3>
          <p className="mt-2 text-2xl font-bold">{displayText(vehicle.motStatus)}</p>
          <p className="mt-3 text-sm"><span className="text-muted">MOT expires: </span>{displayDate(vehicle.motExpiryDate)}</p>
        </section>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 rounded-2xl border border-outline/10 p-5 sm:grid-cols-3">
        {details.map(([label, value]) => <div key={label}><dt className="text-xs font-semibold text-muted">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value}</dd></div>)}
      </dl>
      <p className="mt-4 text-xs leading-6 text-muted">Missing dates and details are shown as “Not provided”. This check shows the tax and MOT status returned by DVLA; it does not show the full MOT history.</p>
    </div>}
  </section>;
}
