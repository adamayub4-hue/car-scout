"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { trackGrowthEvent } from "../lib/growth-events";
import { analyticsAudience } from "../lib/analytics-audience";
import { categories, diagramSystems, electricCategoryOverrides, electricDiagramOverrides } from "../lib/parts-guide-data";
import { parseSavedSearchParams } from "../lib/saved-search";
import PartSearchResults from "./part-search-results";
import CarSearchResults, { type CarSearchInfo } from "./car-search-results";
import CarExtraFilters from "./car-extra-filters";
import type { CarExtra } from "../lib/car-extras";
import { createCarSearch, createPartSearch, marketplaceFilterNote, type SubmittedSearch, type Mode, type Platform, type VehicleType, type EbayListing } from "../lib/search";
import { filterCarListings } from "../lib/car-filters";
import SearchPageShell from "./search-page-shell";
import SiteFooter from "./site-footer";
import GoogleLensHelp from "./google-lens-help";
import VehiclePicker from "./vehicle-picker";
import { vehicleModelsForMake } from "../lib/vehicle-picker-options";
import { makes, motorbikeMakes } from "../lib/vehicle-options";
import { trackCampaignLanding } from "../lib/campaign-landing";
import { getSupabaseBrowserClient } from "../lib/supabase";

const DiagramExplorer = dynamic(() => import("./parts-guide"), {
  loading: () => <p role="status" className="min-h-48 rounded-2xl border border-outline/10 p-6 text-muted">Loading the visual parts guide…</p>,
});

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
  carwow: "Carwow",
};

const years = Array.from(
  { length: new Date().getFullYear() - 1959 },
  (_, index) => String(new Date().getFullYear() - index),
);

function isValidPostcode(value: string) {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value.trim());
}

const fieldClass =
  "min-h-12 w-full rounded-2xl border border-outline/15 bg-overlay/[0.06] px-4 py-3.5 text-base text-foreground outline-none transition placeholder:text-subtle focus:border-sky-400/60 focus:ring-4 focus:ring-sky-400/10";

export default function SearchExperience({ initialMode = "cars", initialVehicleType = "cars" }: { initialMode?: Mode; initialVehicleType?: VehicleType } = {}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [vehicleType, setVehicleType] = useState<VehicleType>(initialVehicleType);
  const [platform, setPlatform] = useState<Platform>(initialVehicleType === "motorbikes" ? "ebay" : "all");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [engine, setEngine] = useState("");
  const [fuel, setFuel] = useState("");
  const [bodyStyle, setBodyStyle] = useState("");
  const [price, setPrice] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [carSort, setCarSort] = useState<"best_match" | "price_asc" | "price_desc" | "newest">("price_asc");
  const [hideUnwanted, setHideUnwanted] = useState(true);
  const [carExtras, setCarExtras] = useState<CarExtra[]>([]);
  const [postcode, setPostcode] = useState("");
  const [registration, setRegistration] = useState("");
  const [vehicleLookup, setVehicleLookup] = useState<VehicleLookup | null>(null);
  const [vehicleLookupLoading, setVehicleLookupLoading] = useState(false);
  const [partMethod, setPartMethod] = useState<PartMethod | "">("");
  const [part, setPart] = useState("");
  const [lensPartName, setLensPartName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partCategory, setPartCategory] = useState("");
  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [submittedSearch, setSubmittedSearch] = useState<SubmittedSearch | null>(null);
  const [carSearchRevision, setCarSearchRevision] = useState(0);
  const [restoredSearch, setRestoredSearch] = useState(false);
  const [vehicleDetailsOpen, setVehicleDetailsOpen] = useState(false);
  const guideRef = useRef<HTMLDivElement>(null);
  const guideLandingPending = useRef(false);
  const ebayRequest = useRef<{ id: number; controller: AbortController | null }>({ id: 0, controller: null });
  const vehicleLookupRequest = useRef<{ id: number; controller: AbortController | null }>({ id: 0, controller: null });
  const vehicleFieldsRef = useRef<HTMLDivElement>(null);
  const partNameRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const carSearchFormRef = useRef<HTMLElement>(null);
  const carMakeRef = useRef<HTMLButtonElement>(null);
  const autoRunPending = useRef(false);
  const [ebayItems, setEbayItems] = useState<EbayListing[]>([]);
  const [ebayLoading, setEbayLoading] = useState(false);
  const [ebayError, setEbayError] = useState("");
  const [carSearchInfo, setCarSearchInfo] = useState<CarSearchInfo | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const saved = parseSavedSearchParams(params);
    const landingMode = saved?.mode || (params.get("mode") === "parts" ? "parts" : initialMode);
    const landingVehicleType = landingMode === "cars" && (saved?.vehicleType === "motorbikes" || params.get("vehicle_type") === "motorbikes" || initialVehicleType === "motorbikes") ? "motorbikes" : "cars";
    const guideCampaign = ["visual_guide", "visual_guide_v2"].includes(params.get("utm_content") || "");
    guideLandingPending.current = !saved && landingMode === "parts" && (params.get("guide") === "1" || guideCampaign);
    trackCampaignLanding(landingMode === "cars" ? landingVehicleType : landingMode);
    // Only the homepage quick form opts into running. Shared/saved links remain editable.
    autoRunPending.current = Boolean(saved && saved.mode === "cars" && params.get("run") === "1" && (saved.platform === "all" || saved.platform === "ebay"));
    const frame = window.requestAnimationFrame(() => {
      setMode(landingMode);
      setVehicleType(landingVehicleType);
      if (landingVehicleType === "motorbikes") setPlatform("ebay");
      if (guideLandingPending.current) setPartMethod("diagram");
      if (saved) {
        setMake(saved.make); setModel(saved.model); setYear(saved.year);
        setPrice(saved.price); setPostcode(saved.postcode); setPlatform(landingVehicleType === "motorbikes" ? "ebay" : saved.platform as Platform);
        setMinPrice(saved.minPrice || ""); setCarSort(saved.sort || "best_match"); setHideUnwanted(saved.hideUnwanted ?? false);
        setCarExtras(saved.carExtras || []);
        setEngine(saved.engine); setFuel(saved.fuel); setBodyStyle(saved.bodyStyle);
        const selection = validatedPartSelection(saved.partCategory, saved.part, saved.partMethod, saved.fuel);
        setPart(selection.part); setPartCategory(selection.category);
        setPartNumber(saved.partMethod === "search" ? saved.partNumber : ""); setPartMethod(saved.partMethod); setVehicleDetailsOpen(saved.searchMethod !== "part_number"); setRestoredSearch(true);
      }
    });
    const request = ebayRequest.current;
    const lookupRequest = vehicleLookupRequest.current;
    return () => { window.cancelAnimationFrame(frame); request.id += 1; request.controller?.abort(); lookupRequest.id += 1; lookupRequest.controller?.abort(); };
  }, [initialMode, initialVehicleType]);

  useEffect(() => {
    if (!guideLandingPending.current || mode !== "parts" || partMethod !== "diagram") return;
    guideLandingPending.current = false;
    guideRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [mode, partMethod]);

  useEffect(() => {
    if (showResults && submittedSearch) {
      resultsRef.current?.focus({ preventScroll: true });
      resultsRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
    }
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
    if (partMethod === "search" && lensPartName && part === lensPartName) {
      // Keep the general name while the customer adds their vehicle.
      setPartCategory(""); setPartNumber("");
    } else if (partMethod !== "diagram") {
      setPartMethod(""); setPartCategory(""); setPart(""); setPartNumber("");
    } else if (/^electric/i.test(fuel.trim()) !== /^electric/i.test(nextFuel.trim())) {
      setPartCategory(""); setPart("");
    }
    setShowResults(false);
    setError("");
  };

  const chooseLensPart = (name: string) => {
    setLensPartName(name); setPartMethod("search"); setPart(name);
    setPartNumber(""); setPartCategory(""); setShowResults(false); setError("");
    setVehicleDetailsOpen(true);
    requestAnimationFrame(() => {
      const target = make && model && year ? partNameRef.current : vehicleFieldsRef.current;
      target?.scrollIntoView({ block: "start", behavior: "instant" });
      if (target === partNameRef.current) partNameRef.current?.focus({ preventScroll: true });
    });
  };

  const handleVehicleLookup = async () => {
    const cleanedRegistration = registration.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanedRegistration.length < 5) {
      setError("Enter a valid UK registration, for example AB12 CDE.");
      return;
    }

    vehicleLookupRequest.current.controller?.abort();
    const controller = new AbortController();
    const requestId = ++vehicleLookupRequest.current.id;
    vehicleLookupRequest.current.controller = controller;
    setVehicleLookupLoading(true);
    setVehicleLookup(null);
    setError("");
    try {
      const response = await fetch("/api/vehicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationNumber: cleanedRegistration }),
        signal: controller.signal,
      });
      if (requestId !== vehicleLookupRequest.current.id) return;
      if (response.status === 429) throw new Error("Too many registration lookups. Please wait a minute, then try again.");
      const payload = (await response.json()) as { vehicle?: VehicleLookup; error?: string };
      if (requestId !== vehicleLookupRequest.current.id) return;
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
      if (requestId !== vehicleLookupRequest.current.id) return;
      setError(lookupError instanceof Error ? lookupError.message : "We could not identify that vehicle.");
    } finally {
      if (requestId === vehicleLookupRequest.current.id) setVehicleLookupLoading(false);
    }
  };

  const isMotorbikes = mode === "cars" && vehicleType === "motorbikes";
  const vehiclePlural = isMotorbikes ? "motorbikes" : "cars";
  const selectedCarFilterCount = [price, year, minPrice, postcode, ...carExtras, !isMotorbikes && platform !== "all" ? platform : ""].filter(Boolean).length;
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
    setEbayLoading(true); setEbayError(""); setEbayItems([]); setCarSearchInfo(null);
    const timeout = setTimeout(() => controller.abort(new Error("Search timed out")), 20000);
    const eventProperties = { search_type: search.mode === "cars" && search.vehicleType === "motorbikes" ? "motorbikes" : search.mode, search_method: search.searchMethod };
    try {
      const params = new URLSearchParams({ type: search.mode, q: search.query });
      if (search.maxPrice) params.set("maxPrice", search.maxPrice);
      if (search.mode === "cars") {
        if (search.vehicleType === "motorbikes") params.set("vehicleType", "motorbikes");
        if (search.minPrice) params.set("minPrice", search.minPrice);
        if (search.carSort) params.set("sort", search.carSort);
        params.set("hideUnwanted", search.hideUnwanted ? "1" : "0");
        if (search.carCriteria?.make) params.set("make", search.carCriteria.make);
        if (search.carCriteria?.model) params.set("model", search.carCriteria.model);
        if (search.vehicleType !== "motorbikes" && search.carExtras?.length) params.set("extras", search.carExtras.join(","));
      }
      const response = await fetch(`/api/ebay/search?${params}`, { signal: controller.signal });
      if (response.status === 429) throw new Error("Too many searches. Please wait a minute, then try again.");
      const payload = (await response.json()) as { items?: EbayListing[]; error?: string; searchInfo?: CarSearchInfo };
      if (controller.signal.aborted) throw new Error("Search timed out");
      if (requestId !== ebayRequest.current.id) return;
      if (!response.ok) throw new Error(payload.error || "Live eBay results are unavailable.");
      const items = search.mode === "cars" ? filterCarListings(payload.items ?? [], { vehicleType: search.vehicleType, minPrice: search.minPrice, maxPrice: search.maxPrice, sort: search.carSort, hideUnwanted: search.hideUnwanted, make: search.carCriteria?.make, model: search.carCriteria?.model, carExtras: search.carExtras }) : payload.items ?? [];
      setEbayItems(items);
      setCarSearchInfo(search.mode === "cars" ? payload.searchInfo ?? null : null);
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
    const submittedVehicleType = vehicleType;
    const searchPlatform = submittedVehicleType === "motorbikes" ? "ebay" : platform;
    if ((price && (!/^\d+$/.test(price) || Number(price) <= 0 || Number(price) > 100_000_000)) || (minPrice && (!/^\d+$/.test(minPrice) || Number(minPrice) > 100_000_000))) {
      setError("Enter a valid price in pounds.");
      return;
    }
    if (price && minPrice && Number(minPrice) > Number(price)) {
      setError("Minimum price must not be higher than your maximum price.");
      return;
    }
    if (submittedVehicleType !== "motorbikes" && postcode.trim() && !isValidPostcode(postcode)) {
      setError("Enter a valid UK postcode, for example B1 1AA.");
      return;
    }
    setError("");
    const search = createCarSearch({ make: make.trim(), model: model.trim(), year, price, minPrice, sort: carSort, hideUnwanted, carExtras: submittedVehicleType === "motorbikes" ? [] : carExtras, postcode: submittedVehicleType === "motorbikes" ? "" : postcode, platform: searchPlatform, vehicleType: submittedVehicleType });
    setCarSearchRevision(revision => revision + 1);
    setSubmittedSearch(search);
    setShowResults(true);
    trackGrowthEvent("search_submitted", { search_type: submittedVehicleType, marketplace: searchPlatform, has_model: Boolean(model), has_year: Boolean(year), has_price: Boolean(price), has_postcode: submittedVehicleType !== "motorbikes" && Boolean(postcode) });
    void trackActivity("car_search", { make, model, year, price: Boolean(price), postcode: submittedVehicleType !== "motorbikes" && Boolean(postcode), platform: searchPlatform, vehicleType: submittedVehicleType });
    if (searchPlatform === "all" || searchPlatform === "ebay") {
      void searchEbay(search);
    } else {
      ebayRequest.current.id += 1; ebayRequest.current.controller?.abort(); setEbayLoading(false); setCarSearchInfo(null);
      trackGrowthEvent("results_shown", { search_type: submittedVehicleType, result_kind: "marketplace_links" });
    }
    if (searchPlatform !== "all" && searchPlatform !== "more" && searchPlatform !== "ebay") {
      trackGrowthEvent("marketplace_outbound", { marketplace: searchPlatform, search_type: submittedVehicleType, destination: "search_results" });
      window.open(search.carLinks![searchPlatform], "_blank", "noopener,noreferrer");
    }
  };

  const runQuickSearch = useEffectEvent(() => { void handleCarSearch(); });
  useEffect(() => {
    if (!restoredSearch || !autoRunPending.current) return;
    autoRunPending.current = false;
    runQuickSearch();
  }, [restoredSearch]);

  const handleCarSortChange = (sort: "best_match" | "price_asc" | "price_desc" | "newest") => {
    if (submittedSearch?.mode !== "cars") return;
    const criteria = submittedSearch.carCriteria;
    const search = createCarSearch({
      make: criteria?.make || "", model: criteria?.model || "", year: criteria?.year || "",
      price: submittedSearch.maxPrice || "", minPrice: submittedSearch.minPrice || "", sort,
      hideUnwanted: submittedSearch.hideUnwanted,
      postcode: String(submittedSearch.saveItem.data.postcode || ""), platform: submittedSearch.platform,
      vehicleType: submittedSearch.vehicleType,
      carExtras: submittedSearch.carExtras,
    });
    setCarSort(sort); setSubmittedSearch(search);
    void searchEbay(search);
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

  return <SearchPageShell active={mode === "parts" ? "parts" : isMotorbikes ? "motorbikes" : "cars"} searchRef={carSearchFormRef} after={<>
        {showResults && submittedSearch?.mode === "cars" && mode === "cars" && (
          <section ref={resultsRef} tabIndex={-1} aria-label={`${submittedSearch.vehicleType === "motorbikes" ? "Motorbike" : "Car"} results for ${submittedSearch.title}`} className="mt-6 scroll-mt-3 outline-none">
            <CarSearchResults key={carSearchRevision} search={submittedSearch} items={ebayItems} loading={ebayLoading} error={ebayError} searchInfo={carSearchInfo}
              onSortChange={handleCarSortChange}
              onRetry={() => void searchEbay(submittedSearch)}
              onEdit={() => {
                carMakeRef.current?.focus({ preventScroll: true });
                carSearchFormRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
              }} />
          </section>
        )}

        {showResults && submittedSearch?.mode === "parts" && mode === "parts" && (
          <section ref={resultsRef} tabIndex={-1} aria-label={`Parts results for ${submittedSearch.title}`} className="mt-6 scroll-mt-3 outline-none">
            <PartSearchResults key={submittedSearch.query} search={submittedSearch} items={ebayItems} loading={ebayLoading} error={ebayError}
              onRetry={() => void searchEbay(submittedSearch)}
              onEdit={() => {
                carSearchFormRef.current?.focus({ preventScroll: true });
                carSearchFormRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
              }} />
          </section>
        )}

    <Link href="/vehicle-check" className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-outline/15 bg-panel p-5 transition hover:border-sky-400/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">
      <span><span className="block font-bold">Free car check</span><span className="mt-1 block text-sm text-muted">Tax & MOT status, vehicle details and available due dates.</span></span><span aria-hidden="true" className="shrink-0 text-xl text-link">→</span>
    </Link>
        <details className="mt-6 rounded-2xl border border-outline/15 bg-panel px-4 py-3 text-sm"><summary className="cursor-pointer font-semibold text-muted">How Mekivo works</summary><div className="pt-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <h2 id="mekivo-steps-title" className="font-bold">New to Mekivo? Start here.</h2>
            <p className="text-sm text-muted">You do not buy anything on Mekivo—we help you reach the original listing.</p>
          </div>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {(mode === "cars"
              ? [
                  ["1", isMotorbikes ? "Search eBay motorbikes" : "Choose where to search", isMotorbikes ? "Browse live motorbike listings from eBay." : "Not sure? Leave All marketplaces selected."],
                  ["2", "Enter what you know", "Choose a budget, or add a make and model to narrow it down."],
                  ["3", "Browse your results", isMotorbikes ? "Press Search to browse live motorbikes and price picks." : "Press Search to browse eBay cars here, or open another site."],
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

    <SiteFooter>
      <p>Mekivo does not sell vehicles or guarantee listing accuracy or part compatibility. Verify all information with the marketplace or seller.</p>
      <p className="mt-2">Mekivo participates in the eBay Partner Network and may earn a commission from qualifying purchases made through eBay links, at no additional cost to you.</p>
      <Link href="/return-visit-settings" className="mt-2 inline-block font-semibold text-link">Return visit settings</Link>
    </SiteFooter>
  </>}>
        {restoredSearch && !showResults && <p role="status" className="mx-auto mb-3 max-w-4xl rounded-xl border border-sky-400/25 bg-sky-400/10 p-3 text-sm text-muted">Your saved search is ready. Check the details and press Search for current listings.</p>}
          {mode === "cars" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <VehiclePicker id="car-make" label="Make" optional ref={carMakeRef} value={make} options={isMotorbikes ? motorbikeMakes : Object.keys(makes)} placeholder="Any make" onChange={value => { setMake(value); setModel(""); setShowResults(false); }} />
                <VehiclePicker id="car-model" label="Model" optional value={model} options={isMotorbikes ? [] : vehicleModelsForMake(makes, make)} placeholder={isMotorbikes ? "Any model, e.g. MT-07" : "Any model"} onChange={value => { setModel(value); setShowResults(false); }} />
              </div>
              <details className="mt-4 rounded-2xl border border-outline/15 bg-panel p-4">
                <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-semibold text-link focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">More filters{selectedCarFilterCount > 0 ? ` · ${selectedCarFilterCount} selected` : ""}</summary>
                <fieldset className="mt-4 min-w-0" aria-describedby="car-budget-help">
                  <legend className="text-sm font-semibold text-foreground">Price range (£)</legend>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <label className="min-w-0 text-xs text-muted">
                      <span className="mb-2 block">Minimum price</span>
                      <input value={minPrice} onChange={event => { setMinPrice(event.target.value.replace(/\D/g, "")); setShowResults(false); }} inputMode="numeric" placeholder="No min" className={`${fieldClass} min-w-0 px-3`} />
                    </label>
                    <label htmlFor="search-budget" className="min-w-0 text-xs text-muted">
                      <span className="mb-2 block">Maximum budget</span>
                      <input id="search-budget" value={price} onChange={event => { setPrice(event.target.value.replace(/\D/g, "")); setShowResults(false); }} inputMode="numeric" placeholder="No max" className={`${fieldClass} min-w-0 px-3`} />
                    </label>
                  </div>
                  <p id="car-budget-help" className="mt-2 text-xs leading-5 text-muted">Leave either blank for no limit. Other sites may need their price filters set again.</p>
                </fieldset>
                <div className={`mt-4 grid gap-3 ${isMotorbikes ? "sm:grid-cols-2" : "grid-cols-2"}`}>
                  <label className="min-w-0 text-sm text-muted">
                    <span className="mb-2 block">Year</span>
                    <select value={year} onChange={(event) => { setYear(event.target.value); setShowResults(false); }} className={`${fieldClass} min-w-0 px-3`}>
                      <option value="">Any year</option>
                      {years.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  {!isMotorbikes && <label className="min-w-0 text-sm text-muted">
                    <span className="mb-2 block">Postcode</span>
                    <input
                      value={postcode}
                      onChange={(event) => {
                        setPostcode(event.target.value.toUpperCase());
                        setShowResults(false);
                      }}
                      placeholder="B1 1AA"
                      className={`${fieldClass} min-w-0 px-3`}
                    />
                  </label>}
                </div>
                {!isMotorbikes && <div className="mt-4">
                  <label htmlFor="car-marketplace" className="mb-2 block text-sm text-muted">Where to search</label>
                  <select id="car-marketplace" value={platform} onChange={event => { setPlatform(event.target.value as Platform); setShowResults(false); setError(""); }} aria-describedby="car-marketplace-help" className="min-h-12 w-full rounded-2xl border border-outline/20 bg-panel px-4 py-3.5 text-base text-foreground outline-none focus:border-sky-400/60 focus:ring-4 focus:ring-sky-400/10">
                    {Object.entries(platformNames).map(([value, label]) => <option key={value} value={value} className="bg-panel text-foreground">{value === "all" ? "All marketplaces" : value === "more" ? "More marketplaces" : label}</option>)}
                  </select>
                  <p id="car-marketplace-help" className="mt-2 text-xs leading-5 text-muted">{platform !== "all" && platform !== "more" ? marketplaceFilterNote(platform, carExtras.length > 0) : "Live eBay results appear here. Other marketplaces open on their own sites."}</p>
                </div>}
                {!isMotorbikes && <CarExtraFilters value={carExtras} onChange={extras => { setCarExtras(extras); setShowResults(false); setError(""); }} />}
                <details className="mt-4 border-t border-outline/10 pt-3">
                  <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-semibold text-link focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">Quick budgets</summary>
                  <div className="mt-3 flex flex-wrap gap-2" aria-label={isMotorbikes ? "Quick motorbike budgets" : "Quick car budgets"}>
                    {[500, 1000, 2000, 5000, 10000].map(amount => <button key={amount} type="button" aria-pressed={price === String(amount) && !minPrice && carSort === "price_asc"} onClick={() => { setPrice(String(amount)); setMinPrice(""); setCarSort("price_asc"); setShowResults(false); setError(""); }} className="min-h-11 rounded-xl border border-outline/15 px-3 py-2 text-sm font-semibold text-link aria-pressed:bg-sky-400/10">Up to £{amount.toLocaleString("en-GB")}</button>)}
                  </div>
                </details>
                <details className="mt-3 border-t border-outline/10 pt-3">
                  <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-semibold text-link focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">Search options{carSort !== "price_asc" || !hideUnwanted ? " · changed" : ""}</summary>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 sm:items-center">
                    <label className="text-sm text-muted"><span className="mb-2 block">Sort live {vehiclePlural}</span>
                      <select value={carSort} onChange={event => { setCarSort(event.target.value as typeof carSort); setShowResults(false); }} className={fieldClass}>
                        <option value="price_asc">Lowest price first</option><option value="price_desc">Highest price first</option><option value="newest">Newly listed</option><option value="best_match">Best match</option>
                      </select>
                    </label>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-muted">
                      <input type="checkbox" checked={hideUnwanted} onChange={event => { setHideUnwanted(event.target.checked); setShowResults(false); }} className="mt-1 h-5 w-5 shrink-0 accent-sky-400" />
                      <span><strong className="block font-semibold text-foreground">Hide parts, repair and deposit adverts</strong><span className="mt-1 block text-xs leading-5">Checks listing titles and condition, not vehicle history or roadworthiness.</span></span>
                    </label>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-subtle">Sorting and advert checks apply to live eBay results. {isMotorbikes ? "Results include listings located in the UK; distance is not filtered here." : "Only Auto Trader and eBay links carry your postcode. Set your location on other sites; distance is not filtered here."}</p>
                  <button type="button" onClick={() => { setMake(""); setModel(""); setYear(""); setMinPrice(""); setPlatform(isMotorbikes ? "ebay" : "all"); setCarSort("price_asc"); setHideUnwanted(true); setCarExtras([]); setPostcode(""); setShowResults(false); setError(""); }} className="mt-3 min-h-11 text-sm font-semibold text-link">Use any make and year within this budget</button>
                </details>
              </details>
              {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
              <button type="button" onClick={handleCarSearch} className="mt-5 min-h-12 w-full rounded-2xl bg-sky-400 px-5 py-3.5 text-base font-bold text-slate-950 transition hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">
                {isMotorbikes ? "Search eBay motorbikes" : `Search ${platformNames[platform]}`}
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-muted">{isMotorbikes ? "Browse live eBay motorbikes here and open the original listing to check every detail." : "Browse live eBay cars here, or open your search on another marketplace."}</p>
            </>
          ) : (
            <>
              <div className="mb-5">
                <h2 className="text-base font-bold">Search by part number</h2>
                <p className="mt-2 text-sm leading-6 text-muted">Search an OEM or manufacturer number directly without selecting a vehicle.</p>
                <div className="mt-4 flex flex-col gap-3">
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
                    className="min-h-12 w-full rounded-2xl bg-sky-400 px-5 py-3.5 text-base font-bold text-slate-950 transition hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link"
                  >
                    Search part number
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm font-semibold text-muted">Need the part name?</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <GoogleLensHelp onChoose={chooseLensPart} />
                  <button type="button" aria-label="Browse the parts picture guide" aria-pressed={partMethod === "diagram"} onClick={() => { setLensPartName(""); setPartMethod("diagram"); setPartNumber(""); setShowResults(false); setError(""); requestAnimationFrame(() => guideRef.current?.scrollIntoView({ block: "start", behavior: "instant" })); }} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-outline/20 px-3 py-3 text-sm font-semibold transition hover:border-sky-400/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className="h-5 w-5 shrink-0"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 3-3 6 6" /></svg>
                    Picture guide
                  </button>
                </div>
              </div>
              {partMethod === "diagram" && <div ref={guideRef} className="mb-5 scroll-mt-4">
                <DiagramExplorer category={partCategory} part={part} fuel={fuel} onCategory={(value) => { setPartCategory(value); setPart(""); setShowResults(false); setError(""); }} onPart={(value) => { setPart(value); setShowResults(false); setError(""); }} />
                {part && <div className="mt-3 rounded-xl border border-outline/10 p-4"><p className="mb-3 text-sm text-muted">{vehicleReady ? `Search for ${part} for your ${vehicleLabel}.` : `Selected: ${part}. Add your make, model and year to find listings.`}</p><button type="button" onClick={() => { if (vehicleReady) void handlePartsSearch(); else { setVehicleDetailsOpen(true); requestAnimationFrame(() => vehicleFieldsRef.current?.scrollIntoView({ block: "start", behavior: "instant" })); } }} className="w-full rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950">{vehicleReady ? "Search matching listings" : "Add vehicle details"}</button></div>}
              </div>}
              <details open={vehicleDetailsOpen} onToggle={(event) => setVehicleDetailsOpen(event.currentTarget.open)} className="rounded-2xl border border-outline/15 p-4">
              <summary className="cursor-pointer font-bold">{vehicleReady ? `Vehicle: ${vehicleLabel} · Edit` : "Search with vehicle details"}</summary>
              <div ref={vehicleFieldsRef} className="scroll-mt-4 pt-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <h2 className="text-lg font-bold">Tell us which vehicle</h2>
                  <p className="mt-2 text-sm text-muted">Use the registration for the quickest match, or enter the vehicle manually.</p>
                  <p className="mt-1 text-xs leading-5 text-subtle">Vehicle details narrow your search. You can also browse the visual guide first.</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-outline/15 bg-overlay/[0.025] p-4">
                <p className="text-xs font-semibold text-muted">Quick vehicle lookup</p>
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
                  <VehiclePicker id="parts-make" label="Make" value={make} options={Object.keys(makes)} onChange={value => {
                    setMake(value); setModel(""); setYear(""); setEngine(""); setFuel(""); setBodyStyle(""); resetPartsBelowVehicle("");
                  }} />
                  <VehiclePicker id="parts-model" label="Model" value={model} disabled={!make} options={vehicleModelsForMake(makes, make)} onChange={value => {
                    setModel(value); setYear(""); setEngine(""); setFuel(""); setBodyStyle(""); resetPartsBelowVehicle("");
                  }} />
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
                      <select value={fuel} onChange={(event) => { setFuel(event.target.value); if (!(partMethod === "search" && lensPartName && part === lensPartName)) { setPartCategory(""); setPart(""); } resetPartsBelowVehicle(event.target.value); }} className={fieldClass}>
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-bold">How do you want to find it?</h2>
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
                          setLensPartName("");
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
                                  ? "border-sky-400/50 bg-sky-400/10 text-link"
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
                        <input ref={partNameRef} value={part} onChange={(event) => { setLensPartName(""); setPart(event.target.value); setShowResults(false); setError(""); }} placeholder="e.g. front brake pads" className={fieldClass} />
                      </label>
                      <label className="text-sm text-muted">
                        <span className="mb-2 block">Part number <span className="text-subtle">(optional)</span></span>
                        <input value={partNumber} onChange={(event) => { setPartNumber(event.target.value); setShowResults(false); setError(""); }} placeholder="OEM or manufacturer number" className={fieldClass} />
                      </label>
                    </div>
                  )}

                  {(partMethod === "catalogue" || partMethod === "search") && (
                    <>
                      <button type="button" onClick={handlePartsSearch} disabled={!partsSearchReady} className="mt-5 min-h-12 w-full rounded-2xl bg-sky-400 px-5 py-3.5 text-base font-bold text-slate-950 transition hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300 disabled:shadow-none">{partsSearchReady ? "Search matching listings" : "Choose a specific part to continue"}</button>
                      {!partsSearchReady && <p className="mt-2 text-center text-xs text-subtle">Select a named part or enter a part number before searching.</p>}
                    </>
                  )}
                </div>
              )}
              {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
            </>
          )}
  </SearchPageShell>;
}
