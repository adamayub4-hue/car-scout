"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { trackGrowthEvent } from "./lib/growth-events";
import { analyticsAudience } from "./lib/analytics-audience";
import DiagramExplorer from "./components/parts-guide";
import { categories, diagramSystems, electricCategoryOverrides, electricDiagramOverrides } from "./lib/parts-guide-data";
import { parseSavedSearchParams } from "./lib/saved-search";
import EbayResults from "./components/ebay-results";
import { createCarSearch, createPartSearch, marketplaceFilterNote, type SubmittedSearch, type Mode, type Platform, type MarketplaceId, type EbayListing } from "./lib/search";
import SaveButton from "./components/save-button";
import AppearanceControl from "./components/appearance";
import { getSupabaseBrowserClient } from "./lib/supabase";

type PartMethod = "diagram" | "catalogue" | "search";

const validatedPartSelection = (category: string, part: string, method: PartMethod, fuel: string) => {
  const electric = /^electric/i.test(fuel.trim());
  const allowedCategory = Object.hasOwn(categories, category) && !(electric && (category === "Engine" || category === "Exhaust"));
  if (method === "search") return { category: allowedCategory ? category : "", part };
  if (!allowedCategory) return { category: "", part: "" };
  const options: readonly string[] = method === "diagram"
    ? ((electric && electricDiagramOverrides[category]) || diagramSystems[category]).parts
    : (electric && electricCategoryOverrides[category as keyof typeof categories]) || categories[category as keyof typeof categories];
  return { category, part: options.includes(part) ? part : "" };
};

type VehicleLookup = {
  registrationNumber?: string;
  make?: string;
  model?: string;
  yearOfManufacture?: number;
  engineCapacity?: number;
  fuelType?: string;
  colour?: string;
  motStatus?: string;
  taxStatus?: string;
};

const makes = {
  "Alfa Romeo": ["Giulia", "Giulietta", "MiTo", "Stelvio"],
  Audi: ["A1", "A3", "A4", "A5", "Q3", "Q5"],
  BMW: ["1 Series", "3 Series", "5 Series", "X1", "X3"],
  Citroen: ["Berlingo", "C1", "C3", "C4", "C5 Aircross"],
  Dacia: ["Duster", "Jogger", "Sandero"],
  Mercedes: ["A Class", "C Class", "E Class", "GLA", "GLC"],
  Ford: ["Fiesta", "Focus", "Kuga", "Puma"],
  Honda: ["Civic", "CR-V", "HR-V", "Jazz"],
  Hyundai: ["i10", "i20", "i30", "Ioniq 5", "Tucson"],
  Jaguar: ["E-Pace", "F-Pace", "I-Pace", "XE", "XF"],
  Kia: ["Ceed", "Niro", "Picanto", "Sportage"],
  "Land Rover": ["Defender", "Discovery", "Range Rover", "Range Rover Evoque"],
  Lexus: ["CT", "ES", "NX", "RX", "UX"],
  Mazda: ["Mazda2", "Mazda3", "CX-5", "MX-5"],
  MINI: ["Clubman", "Convertible", "Countryman", "Hatch"],
  Nissan: ["Juke", "Leaf", "Micra", "Qashqai", "X-Trail"],
  Peugeot: ["108", "208", "308", "2008", "3008"],
  Porsche: ["911", "Cayenne", "Macan", "Panamera", "Taycan"],
  Renault: ["Captur", "Clio", "Kadjar", "Megane", "Zoe"],
  SEAT: ["Arona", "Ateca", "Ibiza", "Leon"],
  Skoda: ["Fabia", "Karoq", "Kodiaq", "Octavia", "Superb"],
  Tesla: ["Model 3", "Model S", "Model X", "Model Y"],
  Volkswagen: ["Polo", "Golf", "Passat", "Tiguan"],
  Volvo: ["S60", "V40", "V60", "XC40", "XC60", "XC90"],
  Toyota: ["Yaris", "Corolla", "C-HR", "RAV4"],
  Vauxhall: ["Astra", "Corsa", "Crossland", "Grandland", "Mokka"],
} as const;

const platformCards = [
  { id: "autotrader", name: "Auto Trader", label: "Largest UK marketplace" },
  { id: "facebook", name: "Facebook Marketplace", label: "Local and private-sale cars" },
  { id: "ebay", name: "eBay Motors", label: "Auctions and fixed-price cars" },
  { id: "motors", name: "MOTORS / Cazoo", label: "Large dealer-focused marketplace" },
  { id: "gumtree", name: "Gumtree", label: "Local and private listings" },
  { id: "cargurus", name: "CarGurus", label: "Dealer listings and price insights" },
  { id: "pistonheads", name: "PistonHeads", label: "Performance and enthusiast cars" },
  { id: "aacars", name: "AA Cars", label: "Cars from a network of UK dealers" },
  { id: "carandclassic", name: "Car & Classic", label: "Classic and collectible vehicles" },
] as const;

const moreMarketplaceIds: MarketplaceId[] = ["gumtree", "cargurus", "pistonheads", "aacars", "carandclassic"];

const platformNames: Record<Platform, string> = {
  all: "all marketplaces",
  more: "more marketplaces",
  autotrader: "Auto Trader",
  facebook: "Facebook Marketplace",
  ebay: "eBay",
  motors: "MOTORS / Cazoo",
  gumtree: "Gumtree",
  cargurus: "CarGurus",
  pistonheads: "PistonHeads",
  aacars: "AA Cars",
  carandclassic: "Car & Classic",
};

const years = Array.from(
  { length: new Date().getFullYear() - 1959 },
  (_, index) => String(new Date().getFullYear() - index),
);

function isValidPostcode(value: string) {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value.trim());
}

const fieldClass =
  "w-full rounded-2xl border border-outline/10 bg-overlay/[0.06] px-4 py-3.5 text-[15px] text-foreground outline-none transition placeholder:text-subtle focus:border-sky-400/60 focus:bg-overlay/[0.09] focus:ring-4 focus:ring-sky-400/10";

export default function Home() {
  const [mode, setMode] = useState<Mode>("cars");
  const [platform, setPlatform] = useState<Platform>("all");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [engine, setEngine] = useState("");
  const [fuel, setFuel] = useState("");
  const [bodyStyle, setBodyStyle] = useState("");
  const [price, setPrice] = useState("");
  const [postcode, setPostcode] = useState("");
  const [registration, setRegistration] = useState("");
  const [vehicleLookup, setVehicleLookup] = useState<VehicleLookup | null>(null);
  const [vehicleLookupLoading, setVehicleLookupLoading] = useState(false);
  const [partMethod, setPartMethod] = useState<PartMethod | "">("");
  const [part, setPart] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partCategory, setPartCategory] = useState("");
  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [submittedSearch, setSubmittedSearch] = useState<SubmittedSearch | null>(null);
  const [restoredSearch, setRestoredSearch] = useState(false);
  const [vehicleDetailsOpen, setVehicleDetailsOpen] = useState(false);
  const guideRef = useRef<HTMLDivElement>(null);
  const ebayRequest = useRef<{ id: number; controller: AbortController | null }>({ id: 0, controller: null });
  const vehicleFieldsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [ebayItems, setEbayItems] = useState<EbayListing[]>([]);
  const [ebayLoading, setEbayLoading] = useState(false);
  const [ebayError, setEbayError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const saved = parseSavedSearchParams(params);
    const landingMode = saved?.mode || (params.get("mode") === "parts" ? "parts" : "cars");
    trackGrowthEvent("campaign_landing", { landing_mode: landingMode });
    const frame = window.requestAnimationFrame(() => {
      setMode(landingMode);
      if (params.get("guide") === "1") setPartMethod("diagram");
      if (saved) {
        setMake(saved.make); setModel(saved.model); setYear(saved.year);
        setPrice(saved.price); setPostcode(saved.postcode); setPlatform(saved.platform as Platform);
        setEngine(saved.engine); setFuel(saved.fuel); setBodyStyle(saved.bodyStyle);
        const selection = validatedPartSelection(saved.partCategory, saved.part, saved.partMethod, saved.fuel);
        setPart(selection.part); setPartCategory(selection.category);
        setPartNumber(saved.partMethod === "search" ? saved.partNumber : ""); setPartMethod(saved.partMethod); setVehicleDetailsOpen(saved.searchMethod !== "part_number"); setRestoredSearch(true);
      }
    });
    const request = ebayRequest.current;
    return () => { window.cancelAnimationFrame(frame); request.id += 1; request.controller?.abort(); };
  }, []);

  useEffect(() => {
    if (showResults && submittedSearch) resultsRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [showResults, submittedSearch]);

  const trackActivity = async (eventName: "car_search" | "part_search" | "part_number_search" | "vehicle_lookup", metadata: Record<string, unknown>) => {
    try {
      if (analyticsAudience() !== "included") return;
      const client = getSupabaseBrowserClient();
      if (!client) return;
      const { data } = await client.auth.getSession();
      const user = data.session?.user;
      if (user && analyticsAudience() === "included") await client.from("activity_events").insert({ user_id: user.id, event_name: eventName, metadata });
    } catch { /* Optional telemetry must never interrupt the customer journey. */ }
  };

  const resetPartsBelowVehicle = (nextFuel = fuel) => {
    if (partMethod !== "diagram") {
      setPartMethod(""); setPartCategory(""); setPart(""); setPartNumber("");
    } else if (/^electric/i.test(fuel.trim()) !== /^electric/i.test(nextFuel.trim())) {
      setPartCategory(""); setPart("");
    }
    setShowResults(false);
    setError("");
  };

  const handleVehicleLookup = async () => {
    const cleanedRegistration = registration.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanedRegistration.length < 5) {
      setError("Enter a valid UK registration, for example AB12 CDE.");
      return;
    }

    setVehicleLookupLoading(true);
    setVehicleLookup(null);
    setError("");
    try {
      const response = await fetch("/api/vehicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationNumber: cleanedRegistration }),
      });
      if (response.status === 429) throw new Error("Too many registration lookups. Please wait a minute, then try again.");
      const payload = (await response.json()) as { vehicle?: VehicleLookup; error?: string };
      if (!response.ok || !payload.vehicle) throw new Error(payload.error || "We could not identify that vehicle.");

      const vehicle = payload.vehicle;
      const matchedMake = Object.keys(makes).find((item) => item.toLowerCase() === vehicle.make?.toLowerCase());
      setRegistration(vehicle.registrationNumber || cleanedRegistration);
      setMake(matchedMake || vehicle.make || "");
      setModel(vehicle.model || "");
      setYear(vehicle.yearOfManufacture ? String(vehicle.yearOfManufacture) : "");
      setEngine(vehicle.engineCapacity ? `${(Math.round(vehicle.engineCapacity / 100) / 10).toFixed(1)}L` : "");
      const normalizedFuel = vehicle.fuelType ? vehicle.fuelType.charAt(0) + vehicle.fuelType.slice(1).toLowerCase() : "";
      setFuel(normalizedFuel);
      setBodyStyle("");
      resetPartsBelowVehicle(normalizedFuel);
      setVehicleLookup(vehicle);
      trackGrowthEvent("vehicle_lookup_success", { has_model: Boolean(vehicle.model) });
      void trackActivity("vehicle_lookup", { usedRegistration: true, make: vehicle.make, year: vehicle.yearOfManufacture });
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "We could not identify that vehicle.");
    } finally {
      setVehicleLookupLoading(false);
    }
  };

  const setAppMode = (nextMode: Mode) => {
    setMode(nextMode);
    ebayRequest.current.id += 1;
    ebayRequest.current.controller?.abort();
    setEbayLoading(false);
    setShowResults(false);
    setError("");
    setEbayItems([]);
    setEbayError("");
  };

  const vehicleReady = Boolean(make && model && year);
  const vehicleLabel = [year, make, model, engine, fuel, bodyStyle].filter(Boolean).join(" ");
  const electricOnly = /^electric/i.test(fuel.trim());
  const availablePartCategories = (Object.keys(categories) as Array<keyof typeof categories>)
    .filter((category) => !electricOnly || (category !== "Engine" && category !== "Exhaust"));
  const availableCatalogueParts = partCategory
    ? (electricOnly ? (electricCategoryOverrides[partCategory as keyof typeof categories] || categories[partCategory as keyof typeof categories]) : categories[partCategory as keyof typeof categories])
    : [];
  const partsSearchReady = partMethod === "search"
    ? Boolean(part.trim() || partNumber.trim())
    : Boolean((partMethod === "diagram" || partMethod === "catalogue") && part.trim());

  const searchEbay = async (search: SubmittedSearch) => {
    ebayRequest.current.controller?.abort();
    const controller = new AbortController();
    const requestId = ++ebayRequest.current.id;
    ebayRequest.current.controller = controller;
    setEbayLoading(true); setEbayError(""); setEbayItems([]);
    const timeout = setTimeout(() => controller.abort(new Error("Search timed out")), 20000);
    const eventProperties = { search_type: search.mode, search_method: search.searchMethod };
    try {
      const params = new URLSearchParams({ type: search.mode, q: search.query });
      if (search.maxPrice) params.set("maxPrice", search.maxPrice);
      const response = await fetch(`/api/ebay/search?${params}`, { signal: controller.signal });
      if (response.status === 429) throw new Error("Too many searches. Please wait a minute, then try again.");
      const payload = (await response.json()) as { items?: EbayListing[]; error?: string };
      if (controller.signal.aborted) throw new Error("Search timed out");
      if (requestId !== ebayRequest.current.id) return;
      if (!response.ok) throw new Error(payload.error || "Live eBay results are unavailable.");
      const items = payload.items ?? [];
      setEbayItems(items);
      trackGrowthEvent(items.length ? "results_shown" : "results_empty", { ...eventProperties, result_count: items.length });
    } catch (searchError) {
      if (requestId !== ebayRequest.current.id) return;
      setEbayError(controller.signal.aborted ? "The search took too long. Try again or open eBay directly." : searchError instanceof Error ? searchError.message : "Live eBay results are unavailable.");
      trackGrowthEvent("results_error", { ...eventProperties, reason: controller.signal.aborted ? "timeout" : "unavailable" });
    } finally {
      clearTimeout(timeout);
      if (requestId === ebayRequest.current.id) setEbayLoading(false);
    }
  };

  const handleCarSearch = async () => {
    if (!make.trim()) {
      setError("Enter a make to start your search.");
      return;
    }
    if (postcode.trim() && !isValidPostcode(postcode)) {
      setError("Enter a valid UK postcode, for example B1 1AA.");
      return;
    }
    setError("");
    const search = createCarSearch({ make, model, year, price, postcode, platform });
    setSubmittedSearch(search);
    setShowResults(true);
    trackGrowthEvent("search_submitted", { search_type: "cars", marketplace: platform, has_model: Boolean(model), has_year: Boolean(year), has_price: Boolean(price), has_postcode: Boolean(postcode) });
    void trackActivity("car_search", { make, model, year, price: Boolean(price), postcode: Boolean(postcode), platform });
    if (platform === "all" || platform === "ebay") {
      void searchEbay(search);
    } else {
      ebayRequest.current.id += 1; ebayRequest.current.controller?.abort(); setEbayLoading(false);
      trackGrowthEvent("results_shown", { search_type: "cars", result_kind: "marketplace_links" });
    }
    if (platform !== "all" && platform !== "more" && platform !== "ebay") {
      trackGrowthEvent("marketplace_outbound", { marketplace: platform, search_type: "cars", destination: "search_results" });
      window.open(search.carLinks![platform], "_blank", "noopener,noreferrer");
    }
  };

  const handlePartsSearch = async () => {
    if (!vehicleReady) {
      setVehicleDetailsOpen(true);
      setError("Select the make, model and year.");
      return;
    }
    if ((partMethod === "diagram" || partMethod === "catalogue") && !part.trim()) {
      setError("Choose a specific part before searching.");
      return;
    }
    if (partMethod === "search" && !part.trim() && !partNumber.trim()) {
      setError("Enter a part name or part number before searching.");
      return;
    }
    setError("");
    const search = createPartSearch({ make, model, year, engine, fuel, bodyStyle, part, partNumber, partCategory, partMethod });
    setSubmittedSearch(search);
    setShowResults(true);
    trackGrowthEvent("search_submitted", { search_type: "parts", search_method: partMethod || "unknown", has_part_number: Boolean(partNumber) });
    void trackActivity("part_search", { vehicle: vehicleLabel, engine: engine || undefined, fuel: fuel || undefined, bodyStyle: bodyStyle || undefined, category: partCategory, part: part || undefined, hasPartNumber: Boolean(partNumber) });
    void searchEbay(search);
  };

  const handlePartNumberSearch = async () => {
    const number = partNumber.trim();
    if (number.length < 2) {
      setError("Enter an OEM or manufacturer part number.");
      return;
    }
    setPartNumber(number);
    setPartMethod("search");
    setPartCategory("");
    setPart("");
    setError("");
    const search = createPartSearch({ make, model, year, engine, fuel, bodyStyle, part: "", partNumber: number, partCategory: "", partMethod: "search" }, true);
    setSubmittedSearch(search);
    setShowResults(true);
    trackGrowthEvent("search_submitted", { search_type: "parts", search_method: "part_number", has_part_number: true });
    void trackActivity("part_number_search", { hasPartNumber: true });
    void searchEbay(search);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(14,165,233,0.18),transparent_32%),radial-gradient(circle_at_90%_15%,rgba(99,102,241,0.15),transparent_28%)]" />
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline/10 pb-4">
          <button
            type="button"
            onClick={() => setAppMode("cars")}
            className="flex items-center gap-3 text-left"
          >
            <Image src="/icon.svg" alt="" width={44} height={44} className="h-11 w-11 drop-shadow-[0_8px_18px_rgba(14,165,233,0.24)]" priority />
            <span>
              <strong className="block text-xl tracking-tight">Mekivo</strong>
              <span className="text-xs text-muted">
                UK car &amp; parts search
              </span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-success sm:inline-flex">UK beta</span>
            <AppearanceControl />
            <Link href="/account" className="rounded-full border border-outline/15 bg-overlay/[0.05] px-4 py-2 text-xs font-semibold text-foreground transition hover:border-sky-300/50 hover:bg-overlay/[0.1]">My account</Link>
          </div>
        </header>

        <section className="mx-auto max-w-3xl pb-5 pt-6 text-center sm:pb-7 sm:pt-10">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-link">
            One search. More places.
          </p>
          <h1 className="text-balance text-3xl font-bold tracking-[-0.035em] sm:text-5xl">
            Find your next car—or the right part.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-6 text-muted sm:text-base">
            Start your search here. Compare marketplaces and open the original listings.
          </p>
        </section>

        <div className="mx-auto mb-3 grid max-w-md grid-cols-2 rounded-2xl border border-outline/10 bg-overlay/[0.05] p-1.5 shadow-2xl shadow-black/20">
          {(["cars", "parts"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              onClick={() => setAppMode(item)}
              className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${
                mode === item
                  ? "bg-white text-slate-950 shadow-lg"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {item === "cars" ? "Find cars" : "Find parts"}
            </button>
          ))}
        </div>

        <details className="mx-auto mb-3 max-w-4xl rounded-xl border border-outline/10 bg-overlay/[0.025] px-4 py-3 text-sm"><summary className="cursor-pointer font-semibold text-muted">How Mekivo works</summary><div className="pt-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <h2 id="mekivo-steps-title" className="font-bold">New to Mekivo? Start here.</h2>
            <p className="text-sm text-muted">You do not buy anything on Mekivo—we help you reach the original listing.</p>
          </div>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {(mode === "cars"
              ? [
                  ["1", "Choose where to search", "Not sure? Leave All platforms selected."],
                  ["2", "Enter what you know", "Only the make is required. Add more to narrow it down."],
                  ["3", "Open live listings", "Press Search, then choose a marketplace from the results."],
                ]
              : [
                  ["1", "Identify the vehicle", "Use the registration, or enter the make, model and year."],
                  ["2", "Tell us the part", "Choose a category, type its name or use a part number."],
                  ["3", "Check before buying", "Open the listing and confirm fitment with the seller."],
                ]
            ).map(([number, title, copy]) => (
              <li key={number} className="flex gap-3 rounded-xl border border-outline/10 bg-panel/65 p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-400 text-xs font-black text-slate-950">{number}</span>
                <span>
                  <strong className="block text-sm">{title}</strong>
                  <span className="mt-1 block text-xs leading-5 text-muted">{copy}</span>
                </span>
              </li>
            ))}
          </ol>
        </div></details>

        {restoredSearch && <p role="status" className="mx-auto mb-3 max-w-4xl rounded-xl border border-sky-400/25 bg-sky-400/10 p-3 text-sm text-muted">Your saved search is ready. Check the details and press Search for current listings.</p>}
        <section className="mx-auto max-w-4xl rounded-2xl border border-outline/10 bg-panel/95 p-4 shadow-xl shadow-black/15 sm:p-6">
          {mode === "cars" ? (
            <>
              <details className="mb-4 rounded-xl border border-outline/10 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">Search: {platformNames[platform]} · Change</summary>
                <p className="mt-1 text-xs leading-5 text-muted">Choose one marketplace, or keep All platforms selected for the widest search.</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(["all", "autotrader", "facebook", "ebay", "motors", "more"] as Platform[]).map(
                    (item) => (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={platform === item}
                        onClick={() => {
                          setPlatform(item);
                          setShowResults(false);
                        }}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                          platform === item
                            ? "border-sky-400/50 bg-sky-400/15 text-link"
                            : "border-outline/10 bg-overlay/[0.04] text-muted hover:border-outline/20 hover:text-foreground"
                        }`}
                      >
                        {item === "all" ? "All platforms" : item === "more" ? "More platforms" : platformNames[item]}
                      </button>
                    ),
                  )}
                </div>
              </details>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <label className="text-sm text-muted">
                  <span className="mb-2 block">Make</span>
                  <input
                    list="car-make-options"
                    value={make}
                    onChange={(event) => {
                      setMake(event.target.value);
                      setShowResults(false);
                    }}
                    placeholder="e.g. BMW"
                    className={fieldClass}
                  />
                  <datalist id="car-make-options">{Object.keys(makes).map((item) => <option key={item} value={item} />)}</datalist>
                </label>
                <label className="text-sm text-muted">
                  <span className="mb-2 block">Model <span className="text-subtle">(optional)</span></span>
                  <input value={model} onChange={(event) => { setModel(event.target.value); setShowResults(false); }} placeholder="e.g. 3 Series" className={fieldClass} />
                </label>
                <label className="text-sm text-muted">
                  <span className="mb-2 block">Year <span className="text-subtle">(optional)</span></span>
                  <select value={year} onChange={(event) => { setYear(event.target.value); setShowResults(false); }} className={fieldClass}>
                    <option value="">Any year</option>
                    {years.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="text-sm text-muted">
                  <span className="mb-2 block">Maximum price</span>
                  <input
                    value={price}
                    onChange={(event) => {
                      setPrice(event.target.value.replace(/\D/g, ""));
                      setShowResults(false);
                    }}
                    inputMode="numeric"
                    placeholder="£10,000"
                    className={fieldClass}
                  />
                </label>
                <label className="text-sm text-muted">
                  <span className="mb-2 block">Postcode</span>
                  <input
                    value={postcode}
                    onChange={(event) => {
                      setPostcode(event.target.value.toUpperCase());
                      setShowResults(false);
                    }}
                    placeholder="B1 1AA"
                    className={fieldClass}
                  />
                </label>
              </div>
              {error && (
                <p role="alert" className="mt-4 text-sm text-danger">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={handleCarSearch}
                className="mt-5 w-full rounded-2xl bg-sky-400 px-5 py-4 font-bold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-300"
              >
                Search {platformNames[platform]}
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-muted">Your results will appear below this box. Choose a marketplace to continue on its website.</p>
            </>
          ) : (
            <>
              <div className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.055] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-success">Fastest route</p>
                <h2 className="mt-1 text-xl font-bold">Already know the part number?</h2>
                <p className="mt-2 text-sm leading-6 text-muted">Search an OEM or manufacturer number directly without selecting a vehicle.</p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <label className="sr-only" htmlFor="quick-part-number">OEM or manufacturer part number</label>
                  <input
                    id="quick-part-number"
                    value={partNumber}
                    onChange={(event) => {
                      setPartNumber(event.target.value.trimStart());
                      setShowResults(false);
                      setError("");
                    }}
                    onKeyDown={(event) => { if (event.key === "Enter") void handlePartNumberSearch(); }}
                    placeholder="e.g. 1K0 698 151 F"
                    className={fieldClass}
                  />
                  <button
                    type="button"
                    onClick={handlePartNumberSearch}
                    className="shrink-0 rounded-2xl bg-emerald-300 px-5 py-3.5 font-bold text-emerald-950 transition hover:bg-emerald-200"
                  >
                    Search part number
                  </button>
                </div>
              </div>

              <button type="button" aria-pressed={partMethod === "diagram"} onClick={() => { setPartMethod("diagram"); setPartNumber(""); setShowResults(false); setError(""); requestAnimationFrame(() => guideRef.current?.scrollIntoView({ block: "start", behavior: "instant" })); }} className="mb-4 flex w-full items-center justify-between gap-4 rounded-2xl border border-sky-400/30 bg-sky-400/10 p-4 text-left focus-visible:outline-2 focus-visible:outline-sky-400">
                <span><strong className="block text-lg">Find a part by picture</strong><span className="mt-1 block text-sm text-muted">Explore common parts first. Add your vehicle when you are ready to search.</span></span><span aria-hidden="true" className="text-2xl text-link">→</span>
              </button>
              {partMethod === "diagram" && <div ref={guideRef} className="mb-5 scroll-mt-4">
                <DiagramExplorer category={partCategory} part={part} fuel={fuel} onCategory={(value) => { setPartCategory(value); setPart(""); setShowResults(false); setError(""); }} onPart={(value) => { setPart(value); setShowResults(false); setError(""); }} />
                {part && <div className="mt-3 rounded-xl border border-outline/10 p-4"><p className="mb-3 text-sm text-muted">{vehicleReady ? `Search for ${part} for your ${vehicleLabel}.` : `Selected: ${part}. Add your make, model and year to find listings.`}</p><button type="button" onClick={() => { if (vehicleReady) void handlePartsSearch(); else { setVehicleDetailsOpen(true); requestAnimationFrame(() => vehicleFieldsRef.current?.scrollIntoView({ block: "start", behavior: "instant" })); } }} className="w-full rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950">{vehicleReady ? "Search matching listings" : "Add vehicle details"}</button></div>}
              </div>}
              <details open={vehicleDetailsOpen} onToggle={(event) => setVehicleDetailsOpen(event.currentTarget.open)} className="rounded-2xl border border-outline/15 p-4">
              <summary className="cursor-pointer font-bold">{vehicleReady ? `Vehicle: ${vehicleLabel} · Edit` : "Search with vehicle details"}</summary>
              <div ref={vehicleFieldsRef} className="scroll-mt-4 pt-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-link">Step 1</p>
                  <h2 className="mt-1 text-2xl font-bold">Tell us which vehicle</h2>
                  <p className="mt-2 text-sm text-muted">Use the registration for the quickest match, or enter the vehicle manually.</p>
                  <p className="mt-1 text-xs leading-5 text-subtle">Vehicle details narrow your search. You can also browse the visual guide first.</p>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-sky-400/20 bg-sky-400/[0.055] p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-link">Quick vehicle lookup</p>
                <h3 className="mt-1 text-lg font-bold">Find it by registration</h3>
                <p className="mt-2 text-sm leading-6 text-muted">We use official DVLA and DVSA vehicle data to identify the vehicle before you search for parts.</p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <label className="sr-only" htmlFor="registration-number">UK registration number</label>
                  <input
                    id="registration-number"
                    value={registration}
                    onChange={(event) => {
                      setRegistration(event.target.value.toUpperCase().slice(0, 9));
                      setVehicleLookup(null);
                      setError("");
                    }}
                    onKeyDown={(event) => { if (event.key === "Enter") void handleVehicleLookup(); }}
                    placeholder="e.g. AB12 CDE"
                    autoComplete="off"
                    className="w-full min-w-0 rounded-2xl border-2 border-yellow-600 bg-yellow-300 px-4 py-3.5 text-center text-lg font-bold uppercase tracking-[0.12em] text-slate-950 caret-slate-950 outline-none placeholder:text-slate-700 placeholder:opacity-100 focus:border-slate-950 focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-background"
                  />
                  <button
                    type="button"
                    onClick={handleVehicleLookup}
                    disabled={vehicleLookupLoading}
                    className="shrink-0 rounded-2xl bg-sky-400 px-5 py-3.5 font-bold text-slate-950 transition hover:bg-sky-300 disabled:cursor-wait disabled:opacity-60"
                  >
                    {vehicleLookupLoading ? "Identifying vehicle…" : "Find vehicle"}
                  </button>
                </div>
                {vehicleLookup && (
                  <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4 text-sm text-success">
                    <p className="font-bold">{[vehicleLookup.yearOfManufacture, vehicleLookup.make, vehicleLookup.model, vehicleLookup.colour].filter(Boolean).join(" · ")}</p>
                    <p className="mt-1 text-xs leading-5 text-success/75">{[vehicleLookup.fuelType, vehicleLookup.engineCapacity ? `${vehicleLookup.engineCapacity}cc` : "", vehicleLookup.motStatus ? `MOT: ${vehicleLookup.motStatus}` : "", vehicleLookup.taxStatus ? `Tax: ${vehicleLookup.taxStatus}` : ""].filter(Boolean).join(" · ")}</p>
                    {vehicleLookup.model ? (
                      <p className="mt-2 text-xs font-semibold text-success">Vehicle identified. Check the details above, then continue to the part finder.</p>
                    ) : (
                      <p className="mt-2 text-xs font-semibold text-warning">Exact model identification is temporarily unavailable. Do not choose parts until you have confirmed the model from the vehicle or V5C logbook.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <label className="text-sm text-muted">
                    <span className="mb-2 block">Make</span>
                    <input
                      list="manual-make-options"
                      value={make}
                      onChange={(event) => {
                        setMake(event.target.value);
                        setModel("");
                        setYear("");
                        setEngine("");
                        setFuel("");
                        setBodyStyle("");
                        resetPartsBelowVehicle("");
                      }}
                      placeholder="Start typing a make"
                      className={fieldClass}
                    />
                    <datalist id="manual-make-options">{Object.keys(makes).map((item) => <option key={item} value={item} />)}</datalist>
                  </label>
                  <label className="text-sm text-muted">
                    <span className="mb-2 block">Model</span>
                    <input
                      list="manual-model-options"
                      value={model}
                      disabled={!make}
                      onChange={(event) => {
                        setModel(event.target.value);
                        setYear("");
                        setEngine("");
                        setFuel("");
                        setBodyStyle("");
                        resetPartsBelowVehicle("");
                      }}
                      placeholder="Start typing a model"
                      className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-40`}
                    />
                    <datalist id="manual-model-options">{Object.hasOwn(makes, make) && makes[make as keyof typeof makes].map((item) => <option key={item} value={item} />)}</datalist>
                  </label>
                  <label className="text-sm text-muted">
                    <span className="mb-2 block">Year</span>
                    <select
                      value={year}
                      disabled={!model}
                      onChange={(event) => {
                        setYear(event.target.value);
                        resetPartsBelowVehicle();
                      }}
                      className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <option value="">Select year</option>
                      {years.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
              </div>

              {vehicleReady && (
                <div className="mt-4 rounded-2xl border border-outline/10 bg-overlay/[0.025] p-4">
                  <p className="text-sm font-semibold text-muted">Add details for a more precise parts search <span className="font-normal text-subtle">(optional)</span></p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="text-sm text-muted">
                      <span className="mb-2 block">Engine or variant</span>
                      <input value={engine} onChange={(event) => { setEngine(event.target.value); resetPartsBelowVehicle(); }} placeholder="e.g. 2.0 TDI 150" className={fieldClass} />
                    </label>
                    <label className="text-sm text-muted">
                      <span className="mb-2 block">Fuel</span>
                      <select value={fuel} onChange={(event) => { setFuel(event.target.value); setPartCategory(""); setPart(""); resetPartsBelowVehicle(); }} className={fieldClass}>
                        <option value="">Not sure</option>
                        <option>Petrol</option>
                        <option>Diesel</option>
                        <option>Hybrid</option>
                        <option>Electric</option>
                        <option>LPG</option>
                      </select>
                    </label>
                    <label className="text-sm text-muted">
                      <span className="mb-2 block">Body style</span>
                      <select value={bodyStyle} onChange={(event) => { setBodyStyle(event.target.value); resetPartsBelowVehicle(); }} className={fieldClass}>
                        <option value="">Not sure</option>
                        <option>Hatchback</option>
                        <option>Saloon</option>
                        <option>Estate</option>
                        <option>SUV</option>
                        <option>Coupe</option>
                        <option>Convertible</option>
                        <option>Van</option>
                      </select>
                    </label>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-subtle">These details narrow the marketplace query. They do not replace seller fitment confirmation or a VIN check.</p>
                </div>
              )}

              </div></details>
              {vehicleReady && (
                <div className="mt-6 border-t border-outline/10 pt-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-link">Step 2</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-2xl font-bold">How do you want to find it?</h2>
                    <span className="rounded-full bg-overlay/[0.06] px-3 py-1.5 text-xs text-muted">{vehicleLabel}</span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {([
                      ["diagram", "Visual parts guide", "Not sure what it is? Find common parts by area and shape", "No part name needed"],
                      ["catalogue", "Parts catalogue", "Browse common parts by system", "Ready to use"],
                      ["search", "Search directly", "Enter a name or part number", "Fastest route"],
                    ] as const).map(([id, title, description, badge]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={partMethod === id}
                        onClick={() => {
                          setPartMethod(id);
                          if (id === "diagram") requestAnimationFrame(() => guideRef.current?.scrollIntoView({ block: "start", behavior: "instant" }));
                          setPartCategory("");
                          setPart("");
                          setPartNumber("");
                          setShowResults(false);
                          setError("");
                        }}
                        className={`rounded-2xl border p-4 text-left transition ${
                          partMethod === id
                            ? "border-sky-400/60 bg-sky-400/10"
                            : "border-outline/10 bg-overlay/[0.035] hover:border-outline/25"
                        }`}
                      >
                        <span className="text-xs font-semibold text-link">{badge}</span>
                        <strong className="mt-3 block">{title}</strong>
                        <span className="mt-1 block text-sm leading-5 text-muted">{description}</span>
                      </button>
                    ))}
                  </div>

                  {partMethod === "catalogue" && (
                    <div className="mt-5">
                      <p className="mb-3 text-sm font-semibold text-muted">Choose a system</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {availablePartCategories.map((category) => (
                          <button
                            key={category}
                            type="button"
                            aria-pressed={partCategory === category}
                            onClick={() => {
                              setPartCategory(category);
                              setPart("");
                              setShowResults(false);
                              setError("");
                            }}
                            className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                              partCategory === category
                                ? "border-sky-400/60 bg-sky-400/15 text-link"
                                : "border-outline/10 bg-overlay/[0.04] text-muted"
                            }`}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                      {partCategory && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {availableCatalogueParts.map((item) => (
                            <button
                              key={item}
                              type="button"
                              aria-pressed={part === item}
                              onClick={() => {
                                setPart(item);
                                setShowResults(false);
                                setError("");
                              }}
                              className={`rounded-full border px-3 py-2 text-sm transition ${
                                part === item
                                  ? "border-emerald-400/50 bg-emerald-400/10 text-success"
                                  : "border-outline/10 text-muted hover:text-foreground"
                              }`}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {partMethod === "search" && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <label className="text-sm text-muted">
                        <span className="mb-2 block">Part name</span>
                        <input value={part} onChange={(event) => { setPart(event.target.value); setShowResults(false); setError(""); }} placeholder="e.g. front brake pads" className={fieldClass} />
                      </label>
                      <label className="text-sm text-muted">
                        <span className="mb-2 block">Part number <span className="text-subtle">(optional)</span></span>
                        <input value={partNumber} onChange={(event) => { setPartNumber(event.target.value); setShowResults(false); setError(""); }} placeholder="OEM or manufacturer number" className={fieldClass} />
                      </label>
                    </div>
                  )}

                  {(partMethod === "catalogue" || partMethod === "search") && (
                    <>
                      <button type="button" onClick={handlePartsSearch} disabled={!partsSearchReady} className="mt-5 w-full rounded-2xl bg-sky-400 px-5 py-4 font-bold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300 disabled:shadow-none">{partsSearchReady ? "Search matching listings" : "Choose a specific part to continue"}</button>
                      {!partsSearchReady && <p className="mt-2 text-center text-xs text-subtle">Select a named part or enter a part number before searching.</p>}
                    </>
                  )}
                </div>
              )}
              {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
            </>
          )}
        </section>

        {showResults && submittedSearch?.mode === "cars" && mode === "cars" && (
          <section ref={resultsRef} tabIndex={-1} className="mx-auto mt-6 max-w-4xl scroll-mt-5 outline-none">
            <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-success">Your next step</p>
              <h2 className="mt-2 text-xl font-bold">Choose a marketplace to view live listings</h2>
              <p className="mt-2 text-sm leading-6 text-muted">We have prepared your search. Select one of the options below and its results will open in a new tab.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {platformCards
                .filter((item) => submittedSearch.platform === "all" || submittedSearch.platform === item.id || (submittedSearch.platform === "more" && moreMarketplaceIds.includes(item.id)))
                .map((item) => (
                  <a key={item.id} href={submittedSearch.carLinks![item.id]} target="_blank" rel={item.id === "ebay" ? "sponsored noreferrer" : "noreferrer"} onClick={() => trackGrowthEvent("marketplace_outbound", { marketplace: item.id, search_type: "cars", destination: "search_results" })} className="group rounded-2xl border border-outline/10 bg-overlay/[0.045] p-5 transition hover:-translate-y-1 hover:border-sky-400/40 hover:bg-overlay/[0.07]">
                    <span className="text-xs font-bold uppercase tracking-wider text-link">Search now</span>
                    <h3 className="mt-3 text-lg font-bold">{item.name}</h3>
                    <p className="mt-1 text-sm text-muted">{item.label}</p><p className="mt-3 text-xs leading-5 text-subtle">{marketplaceFilterNote(item.id)}</p>
                    <span className="mt-5 block text-sm font-semibold text-foreground">Open results →</span>
                  </a>
                ))}
            </div>
            {(submittedSearch.platform === "all" || submittedSearch.platform === "ebay") && <EbayResults items={ebayItems} loading={ebayLoading} error={ebayError} fallbackUrl={submittedSearch.fallbackUrl} searchType="cars" onRetry={() => void searchEbay(submittedSearch)} />}
            <SaveButton item={submittedSearch.saveItem} />
          </section>
        )}

        {showResults && submittedSearch?.mode === "parts" && mode === "parts" && (
          <div ref={resultsRef} tabIndex={-1} className="mx-auto mt-6 max-w-4xl scroll-mt-5 outline-none">
            <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-success">Search ready</p>
                <h3 className="mt-2 text-lg font-bold">{submittedSearch.title}</h3>
                <p className="mt-1 text-sm text-muted">Check the listing&apos;s compatibility details before purchasing.</p>
                <SaveButton item={submittedSearch.saveItem} />
              </div>
              <a href={submittedSearch.fallbackUrl} target="_blank" rel="sponsored noreferrer" onClick={() => trackGrowthEvent("marketplace_outbound", { marketplace: "ebay", search_type: "parts", destination: "all_results" })} className="mt-4 inline-flex rounded-xl bg-emerald-300 px-5 py-3 font-bold text-emerald-950 sm:mt-0">View all on eBay</a>
            </section>
            <EbayResults items={ebayItems} loading={ebayLoading} error={ebayError} fallbackUrl={submittedSearch.fallbackUrl} searchType="parts" onRetry={() => void searchEbay(submittedSearch)} />
          </div>
        )}

        <section className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            ["01", "Search wider", "Jump into the UK’s most useful car marketplaces from one clean search."],
            ["02", "Match smarter", "Start parts searches with a specific make, model and year."],
            ["03", "Stay in control", "Mekivo sends you to the original listing so you can verify every detail yourself."],
          ].map(([number, title, copy]) => (
            <div key={number} className="rounded-2xl border border-outline/10 bg-overlay/[0.025] p-5">
              <span className="text-xs font-bold text-link">{number}</span>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
            </div>
          ))}
        </section>

        <footer className="mt-16 border-t border-outline/10 pt-6 text-center text-xs leading-5 text-subtle">
          <p>Mekivo does not sell vehicles or guarantee listing accuracy or part compatibility. Verify all information with the marketplace or seller.</p>
          <p className="mt-2">Mekivo participates in the eBay Partner Network and may earn a commission from qualifying purchases made through eBay links, at no additional cost to you.</p>
          <nav aria-label="Footer" className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
            <a href="/privacy" className="hover:text-muted">Privacy</a>
            <a href="/terms" className="hover:text-muted">Terms</a>
            <a href="/guides" className="hover:text-muted">Guides</a>
            <a href="/support" className="hover:text-muted">Suggestions and support</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
