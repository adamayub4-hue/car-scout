"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SaveButton from "./components/save-button";
import { getSupabaseBrowserClient } from "./lib/supabase";

type Mode = "cars" | "parts";
type Platform = "all" | "autotrader" | "ebay" | "gumtree";
type VehiclePath = "registration" | "manual";
type PartMethod = "diagram" | "catalogue" | "search";

type DiagramSystem = {
  name: string;
  shortName: string;
  description: string;
  accent: string;
  parts: readonly string[];
};

type VehicleDetails = {
  registrationNumber: string;
  make?: string;
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

const categories = {
  Engine: ["Oil Filter", "Air Filter", "Spark Plugs", "Timing Belt", "Water Pump"],
  Brakes: ["Brake Pads", "Brake Discs", "Brake Calipers", "Brake Lines", "ABS Sensors"],
  Suspension: ["Shock Absorbers", "Coil Springs", "Drop Links", "Control Arms", "Bushes"],
  Body: ["Front Bumper", "Rear Bumper", "Wing Mirror", "Headlight", "Tail Light"],
  Interior: ["Steering Wheel", "Dashboard", "Seat", "Gear Knob", "Floor Mat"],
  Electrical: ["Battery", "Alternator", "Starter Motor", "Fuse Box", "ECU"],
} as const;

const diagramSystems: Record<string, DiagramSystem> = {
  Engine: {
    name: "Engine & cooling",
    shortName: "Engine",
    description: "Filters, belts, cooling and service components",
    accent: "#38bdf8",
    parts: ["Air Filter", "Oil Filter", "Timing Belt", "Water Pump"],
  },
  Brakes: {
    name: "Braking system",
    shortName: "Brakes",
    description: "Pads, discs, calipers and sensors",
    accent: "#fb7185",
    parts: ["Brake Disc", "Brake Pads", "Brake Caliper", "ABS Sensor"],
  },
  Suspension: {
    name: "Suspension & steering",
    shortName: "Suspension",
    description: "Dampers, springs, arms and steering parts",
    accent: "#a78bfa",
    parts: ["Shock Absorber", "Coil Spring", "Control Arm", "Drop Link"],
  },
  Body: {
    name: "Body & lighting",
    shortName: "Body",
    description: "Panels, lamps, mirrors and exterior trim",
    accent: "#34d399",
    parts: ["Front Bumper", "Headlight", "Wing Mirror", "Tail Light"],
  },
  Electrical: {
    name: "Electrical system",
    shortName: "Electrical",
    description: "Battery, charging, starting and control units",
    accent: "#fbbf24",
    parts: ["Battery", "Alternator", "Starter Motor", "Fuse Box"],
  },
};

function SystemIcon({ system }: { system: string }) {
  const paths: Record<string, React.ReactNode> = {
    Engine: <><rect x="7" y="9" width="18" height="14" rx="3" /><path d="M10 9V6h5v3M25 13h3v6h-3M7 13H4v6h3M12 16h8" /></>,
    Brakes: <><circle cx="16" cy="16" r="10" /><circle cx="16" cy="16" r="4" /><path d="M23 9l4 2v10l-4 2" /></>,
    Suspension: <><path d="M10 4h12M12 7h8l-7 4 7 4-7 4 7 4h-8M10 26h12" /></>,
    Body: <><path d="M4 20h24l-2-7-5-4H11l-5 5-2 6Z" /><circle cx="10" cy="21" r="3" /><circle cx="23" cy="21" r="3" /></>,
    Electrical: <><rect x="5" y="8" width="22" height="17" rx="3" /><path d="M11 8V5h10v3M10 16h5M12.5 13.5v5M20 14v5M17.5 16.5h5" /></>,
  };
  return <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7 fill-none stroke-current stroke-[1.8]">{paths[system]}</svg>;
}

function DiagramExplorer({
  category,
  part,
  onCategory,
  onPart,
}: {
  category: string;
  part: string;
  onCategory: (value: string) => void;
  onPart: (value: string) => void;
}) {
  const selectedSystem = category ? diagramSystems[category] : null;

  if (!selectedSystem) {
    return (
      <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-[#091526]">
        <div className="border-b border-white/10 px-5 py-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Vehicle overview</p>
          <h3 className="mt-1 text-lg font-bold">Select an area to explore</h3>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-[1.25fr_1fr] sm:p-6">
          <div className="relative min-h-64 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_48%,rgba(56,189,248,0.13),transparent_52%)] p-4">
            <svg viewBox="0 0 620 300" role="img" aria-label="Interactive side view of a car" className="h-full w-full">
              <defs><linearGradient id="carBody" x1="0" x2="1"><stop stopColor="#1e3a5f" /><stop offset="1" stopColor="#0f2744" /></linearGradient></defs>
              <path d="M72 204 96 143c8-20 24-34 45-39l92-24c25-7 54-6 78 2l94 34c15 5 29 14 40 26l44 48 53 17c13 4 22 16 22 30v12H52v-20c0-12 8-22 20-25Z" fill="url(#carBody)" stroke="#60a5fa" strokeWidth="3" />
              <path d="m168 104 70-19c20-5 41-5 60 1l68 25-198-7Z" fill="#07101e" stroke="#475569" strokeWidth="2" />
              <path d="M302 87v103M126 191h354" fill="none" stroke="#334155" strokeWidth="2" />
              <circle cx="152" cy="236" r="43" fill="#07101e" stroke="#64748b" strokeWidth="5" /><circle cx="152" cy="236" r="18" fill="#1e293b" stroke="#94a3b8" strokeWidth="3" />
              <circle cx="444" cy="236" r="43" fill="#07101e" stroke="#64748b" strokeWidth="5" /><circle cx="444" cy="236" r="18" fill="#1e293b" stroke="#94a3b8" strokeWidth="3" />
              <g fill="#38bdf8" opacity=".18"><ellipse cx="418" cy="154" rx="67" ry="45" /><ellipse cx="164" cy="194" rx="59" ry="34" /></g>
            </svg>
            <span className="absolute bottom-3 left-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Generic vehicle layout</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(diagramSystems).map(([id, system]) => (
              <button key={id} type="button" onClick={() => onCategory(id)} className="group rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left transition hover:-translate-y-0.5 hover:border-sky-400/40 hover:bg-white/[0.07]">
                <span style={{ color: system.accent }}><SystemIcon system={id} /></span>
                <strong className="mt-3 block text-sm">{system.shortName}</strong>
                <span className="mt-1 block text-xs leading-4 text-slate-500">{system.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-[#091526]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
        <div>
          <button type="button" onClick={() => onCategory("")} className="text-xs font-semibold text-sky-300 hover:text-sky-200">← All vehicle systems</button>
          <h3 className="mt-1 text-lg font-bold">{selectedSystem.name}</h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400">Tap a numbered part</span>
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-[1.35fr_0.85fr] sm:p-6">
        <div className="relative min-h-80 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <svg viewBox="0 0 560 360" role="img" aria-label={`Exploded ${selectedSystem.name} parts diagram`} className="h-full w-full">
            <g fill="none" stroke="#64748b" strokeWidth="2">
              <path d="M110 180h75l35-62h106l40 62h88" /><path d="M185 180v74h181v-74" /><path d="M226 118v136M320 118v136" />
              <circle cx="92" cy="180" r="39" /><circle cx="472" cy="180" r="39" />
              <circle cx="92" cy="180" r="18" /><circle cx="472" cy="180" r="18" />
              <path d="M147 91h52v42h-52zM365 91h52v42h-52zM248 56h68v40h-68zM248 270h68v40h-68z" />
              <path d="M199 112l49-34M316 78l49 34M185 226l63 64M316 290l50-64" strokeDasharray="7 7" opacity=".55" />
            </g>
            {selectedSystem.parts.map((item, index) => {
              const positions = [[173, 111], [391, 111], [282, 76], [282, 290]];
              const [x, y] = positions[index];
              const active = part === item;
              return (
                <g key={item} role="button" tabIndex={0} aria-label={item} onClick={() => onPart(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onPart(item); }} className="cursor-pointer outline-none">
                  <circle cx={x} cy={y} r="18" fill={active ? selectedSystem.accent : "#0f172a"} stroke={active ? "#fff" : selectedSystem.accent} strokeWidth="3" />
                  <text x={x} y={y + 5} textAnchor="middle" fill={active ? "#07101e" : "#fff"} fontSize="14" fontWeight="800">{index + 1}</text>
                </g>
              );
            })}
            <text x="280" y="340" textAnchor="middle" fill="#64748b" fontSize="12">Illustrative exploded view — not an OEM technical drawing</text>
          </svg>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Components</p>
          <div className="mt-3 space-y-2">
            {selectedSystem.parts.map((item, index) => (
              <button key={item} type="button" aria-pressed={part === item} onClick={() => onPart(item)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${part === item ? "border-sky-400/60 bg-sky-400/10" : "border-white/10 bg-white/[0.025] hover:border-white/25"}`}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black text-slate-950" style={{ backgroundColor: selectedSystem.accent }}>{index + 1}</span>
                <span><strong className="block text-sm">{item}</strong><span className="text-xs text-slate-500">Search compatible listings</span></span>
              </button>
            ))}
          </div>
          {part && <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-xs leading-5 text-emerald-100"><strong>{part} selected.</strong> We&apos;ll include your vehicle details in the marketplace search.</div>}
        </div>
      </div>
    </div>
  );
}

const platformCards = [
  { id: "autotrader", name: "Auto Trader", label: "Largest UK marketplace" },
  { id: "ebay", name: "eBay Motors", label: "Auctions and fixed-price cars" },
  { id: "gumtree", name: "Gumtree", label: "Local and private listings" },
] as const;

const years = Array.from(
  { length: new Date().getFullYear() - 1959 },
  (_, index) => String(new Date().getFullYear() - index),
);

function cleanRegistration(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function isValidPostcode(value: string) {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value.trim());
}

const fieldClass =
  "w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-[15px] text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/60 focus:bg-white/[0.09] focus:ring-4 focus:ring-sky-400/10";

export default function Home() {
  const [mode, setMode] = useState<Mode>("cars");
  const [platform, setPlatform] = useState<Platform>("all");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [price, setPrice] = useState("");
  const [postcode, setPostcode] = useState("");
  const [registration, setRegistration] = useState("");
  const [vehicleDetails, setVehicleDetails] = useState<VehicleDetails | null>(null);
  const [vehicleLookupLoading, setVehicleLookupLoading] = useState(false);
  const [vehiclePath, setVehiclePath] = useState<VehiclePath>("registration");
  const [partMethod, setPartMethod] = useState<PartMethod | "">("");
  const [part, setPart] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partCategory, setPartCategory] = useState("");
  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);

  const trackActivity = async (eventName: "car_search" | "part_search" | "vehicle_lookup", metadata: Record<string, unknown>) => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { data } = await client.auth.getUser();
    if (data.user) void client.from("activity_events").insert({ user_id: data.user.id, event_name: eventName, metadata });
  };

  const resetPartsBelowVehicle = () => {
    setPartMethod("");
    setPartCategory("");
    setPart("");
    setPartNumber("");
    setShowResults(false);
    setError("");
  };

  const resetVehicle = () => {
    setMake("");
    setModel("");
    setYear("");
    setRegistration("");
    setVehicleDetails(null);
    resetPartsBelowVehicle();
  };

  const setAppMode = (nextMode: Mode) => {
    setMode(nextMode);
    setShowResults(false);
    setError("");
  };

  const vehicleReady =
    vehiclePath === "registration"
      ? Boolean(vehicleDetails)
      : Boolean(make && model && year);
  const vehicleLabel =
    vehiclePath === "registration"
      ? vehicleDetails
        ? [vehicleDetails.yearOfManufacture, vehicleDetails.make, vehicleDetails.registrationNumber].filter(Boolean).join(" · ")
        : registration
      : [year, make, model].filter(Boolean).join(" ");

  const carLinks = useMemo(() => {
    const query = [
      make,
      model,
      year,
      price ? `under £${price}` : "",
      postcode ? `near ${postcode}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const autoTraderParams = new URLSearchParams();
    if (make) autoTraderParams.set("make", make);
    if (model) autoTraderParams.set("model", model);
    if (year) {
      autoTraderParams.set("year-from", year);
      autoTraderParams.set("year-to", year);
    }
    if (postcode) autoTraderParams.set("postcode", postcode);
    if (price) autoTraderParams.set("price-to", price);
    return {
      autotrader: `https://www.autotrader.co.uk/car-search?${autoTraderParams.toString()}`,
      ebay: `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(`${query} car`)}`,
      gumtree: `https://www.gumtree.com/search?search_category=cars&q=${encodeURIComponent(query)}`,
    };
  }, [make, model, postcode, price, year]);

  const partsLink = useMemo(() => {
    const vehicle =
      vehiclePath === "registration"
        ? [vehicleDetails?.yearOfManufacture, vehicleDetails?.make].filter(Boolean).join(" ")
        : `${year} ${make} ${model}`;
    const query = [vehicle, partCategory, part, partNumber]
      .filter(Boolean)
      .join(" ");
    return `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(query)}`;
  }, [make, model, part, partCategory, partNumber, vehicleDetails, vehiclePath, year]);

  const lookupRegistration = async () => {
    if (registration.length < 5) {
      setError("Enter a valid UK registration.");
      return;
    }
    setVehicleLookupLoading(true);
    setVehicleDetails(null);
    setError("");
    try {
      const response = await fetch("/api/vehicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationNumber: registration }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "We could not identify that vehicle.");
      }
      setVehicleDetails(payload.vehicle);
      void trackActivity("vehicle_lookup", { make: payload.vehicle?.make, year: payload.vehicle?.yearOfManufacture });
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "We could not identify that vehicle.");
    } finally {
      setVehicleLookupLoading(false);
    }
  };

  const handleCarSearch = () => {
    if (!make.trim()) {
      setError("Enter a make to start your search.");
      return;
    }
    if (postcode.trim() && !isValidPostcode(postcode)) {
      setError("Enter a valid UK postcode, for example B1 1AA.");
      return;
    }
    setError("");
    setShowResults(true);
    void trackActivity("car_search", { make, model, year, price: Boolean(price), postcode: Boolean(postcode), platform });
    if (platform !== "all") {
      window.open(carLinks[platform], "_blank", "noopener,noreferrer");
    }
  };

  const handlePartsSearch = () => {
    if (!vehicleReady) {
      setError(
        vehiclePath === "registration"
          ? "Enter a valid UK registration."
          : "Select the make, model and year.",
      );
      return;
    }
    if (!part.trim() && !partCategory && !partNumber.trim()) {
      setError("Choose a category or enter the part you need.");
      return;
    }
    setError("");
    setShowResults(true);
    void trackActivity("part_search", { vehicle: vehicleLabel, category: partCategory, part: part || undefined, hasPartNumber: Boolean(partNumber) });
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07101e] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(14,165,233,0.18),transparent_32%),radial-gradient(circle_at_90%_15%,rgba(99,102,241,0.15),transparent_28%)]" />
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-20 pt-7 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <button
            type="button"
            onClick={() => setAppMode("cars")}
            className="flex items-center gap-3 text-left"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-400 text-xl font-black text-slate-950 shadow-lg shadow-sky-500/20">
              C
            </span>
            <span>
              <strong className="block text-xl tracking-tight">CarScout</strong>
              <span className="text-xs text-slate-400">
                Search smarter. Buy with confidence.
              </span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 sm:inline-flex">UK beta</span>
            <Link href="/account" className="rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white transition hover:border-sky-300/50 hover:bg-white/[0.1]">My account</Link>
          </div>
        </header>

        <section className="mx-auto max-w-3xl pb-9 pt-14 text-center sm:pt-20">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-sky-300">
            One search. More places.
          </p>
          <h1 className="text-balance text-4xl font-bold tracking-[-0.045em] sm:text-6xl">
            Find your next car—or the right part.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-400 sm:text-lg">
            CarScout turns a scattered search across UK marketplaces into one
            clear starting point.
          </p>
        </section>

        <div className="mx-auto mb-6 grid max-w-md grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.05] p-1.5 shadow-2xl shadow-black/20">
          {(["cars", "parts"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              onClick={() => setAppMode(item)}
              className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${
                mode === item
                  ? "bg-white text-slate-950 shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {item === "cars" ? "Find cars" : "Find parts"}
            </button>
          ))}
        </div>

        <section className="mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
          {mode === "cars" ? (
            <>
              <div className="mb-6">
                <p className="text-sm font-semibold text-white">
                  Where should we search?
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["all", "autotrader", "ebay", "gumtree"] as Platform[]).map(
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
                            ? "border-sky-400/50 bg-sky-400/15 text-sky-200"
                            : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        {item === "all"
                          ? "All platforms"
                          : item === "autotrader"
                            ? "Auto Trader"
                            : item === "ebay"
                              ? "eBay"
                              : "Gumtree"}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="text-sm text-slate-300">
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
                <label className="text-sm text-slate-300">
                  <span className="mb-2 block">Model <span className="text-slate-500">(optional)</span></span>
                  <input value={model} onChange={(event) => { setModel(event.target.value); setShowResults(false); }} placeholder="e.g. 3 Series" className={fieldClass} />
                </label>
                <label className="text-sm text-slate-300">
                  <span className="mb-2 block">Year <span className="text-slate-500">(optional)</span></span>
                  <select value={year} onChange={(event) => { setYear(event.target.value); setShowResults(false); }} className={fieldClass}>
                    <option value="">Any year</option>
                    {years.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="text-sm text-slate-300">
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
                <label className="text-sm text-slate-300">
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
                <p role="alert" className="mt-4 text-sm text-rose-300">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={handleCarSearch}
                className="mt-5 w-full rounded-2xl bg-sky-400 px-5 py-4 font-bold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-300"
              >
                Search {platform === "all" ? "all marketplaces" : platform === "autotrader" ? "Auto Trader" : platform === "ebay" ? "eBay" : "Gumtree"}
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Step 1</p>
                  <h2 className="mt-1 text-2xl font-bold">Tell us which vehicle</h2>
                </div>
                <div className="flex rounded-xl bg-white/[0.05] p-1">
                  {(["registration", "manual"] as VehiclePath[]).map((path) => (
                    <button
                      key={path}
                      type="button"
                      aria-pressed={vehiclePath === path}
                      onClick={() => {
                        setVehiclePath(path);
                        resetVehicle();
                      }}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        vehiclePath === path ? "bg-white text-slate-950" : "text-slate-400"
                      }`}
                    >
                      {path === "registration" ? "Registration" : "Make & model"}
                    </button>
                  ))}
                </div>
              </div>

              {vehiclePath === "registration" ? (
                <div className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/[0.05] p-5 sm:p-6">
                  <label className="block text-sm font-medium text-slate-300" htmlFor="registration">UK registration</label>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <input
                      id="registration"
                      value={registration}
                      onChange={(event) => {
                        setRegistration(cleanRegistration(event.target.value));
                        setVehicleDetails(null);
                        resetPartsBelowVehicle();
                      }}
                      placeholder="AB12 CDE"
                      className="w-full rounded-xl border-2 border-slate-900 bg-[#f5c518] px-4 py-3 text-center text-2xl font-black uppercase tracking-[0.16em] text-slate-950 outline-none focus:border-white sm:max-w-xs"
                    />
                    <button
                      type="button"
                      onClick={lookupRegistration}
                      disabled={vehicleLookupLoading}
                      className="rounded-xl bg-white px-5 py-3 font-bold text-slate-950 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                    >
                      {vehicleLookupLoading ? "Checking vehicle…" : "Find my vehicle"}
                    </button>
                  </div>
                  {vehicleDetails && (
                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm sm:grid-cols-4">
                      <div><span className="block text-xs text-slate-500">Vehicle</span><strong>{vehicleDetails.make || "Unknown"}</strong></div>
                      <div><span className="block text-xs text-slate-500">Year</span><strong>{vehicleDetails.yearOfManufacture || "—"}</strong></div>
                      <div><span className="block text-xs text-slate-500">Engine</span><strong>{vehicleDetails.engineCapacity ? `${vehicleDetails.engineCapacity} cc` : "—"}</strong></div>
                      <div><span className="block text-xs text-slate-500">Fuel</span><strong>{vehicleDetails.fuelType || "—"}</strong></div>
                    </div>
                  )}
                  <p className="mt-3 text-xs leading-5 text-slate-400">
                    Your registration is sent securely to the DVLA lookup service and is never placed in a marketplace URL. Always confirm trim and fitment before ordering.
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <label className="text-sm text-slate-300">
                    <span className="mb-2 block">Make</span>
                    <input
                      list="manual-make-options"
                      value={make}
                      onChange={(event) => {
                        setMake(event.target.value);
                        setModel("");
                        setYear("");
                        resetPartsBelowVehicle();
                      }}
                      placeholder="Start typing a make"
                      className={fieldClass}
                    />
                    <datalist id="manual-make-options">{Object.keys(makes).map((item) => <option key={item} value={item} />)}</datalist>
                  </label>
                  <label className="text-sm text-slate-300">
                    <span className="mb-2 block">Model</span>
                    <input
                      list="manual-model-options"
                      value={model}
                      disabled={!make}
                      onChange={(event) => {
                        setModel(event.target.value);
                        setYear("");
                        resetPartsBelowVehicle();
                      }}
                      placeholder="Start typing a model"
                      className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-40`}
                    />
                    <datalist id="manual-model-options">{make && makes[make as keyof typeof makes]?.map((item) => <option key={item} value={item} />)}</datalist>
                  </label>
                  <label className="text-sm text-slate-300">
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
              )}

              {vehicleReady && (
                <div className="mt-8 border-t border-white/10 pt-7">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Step 2</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-2xl font-bold">How do you want to find it?</h2>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-slate-300">{vehicleLabel}</span>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {([
                      ["diagram", "Car diagram", "Explore systems and select a component", "Interactive finder"],
                      ["catalogue", "Parts catalogue", "Browse common parts by system", "Ready to use"],
                      ["search", "Search directly", "Enter a name or part number", "Fastest route"],
                    ] as const).map(([id, title, description, badge]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={partMethod === id}
                        onClick={() => {
                          setPartMethod(id);
                          setPartCategory("");
                          setPart("");
                          setPartNumber("");
                          setShowResults(false);
                          setError("");
                        }}
                        className={`rounded-2xl border p-4 text-left transition ${
                          partMethod === id
                            ? "border-sky-400/60 bg-sky-400/10"
                            : "border-white/10 bg-white/[0.035] hover:border-white/25"
                        }`}
                      >
                        <span className="text-xs font-semibold text-sky-300">{badge}</span>
                        <strong className="mt-3 block">{title}</strong>
                        <span className="mt-1 block text-sm leading-5 text-slate-400">{description}</span>
                      </button>
                    ))}
                  </div>

                  {partMethod === "diagram" && (
                    <DiagramExplorer
                      category={partCategory}
                      part={part}
                      onCategory={(value) => {
                        setPartCategory(value);
                        setPart("");
                        setShowResults(false);
                      }}
                      onPart={(value) => {
                        setPart(value);
                        setShowResults(false);
                      }}
                    />
                  )}

                  {partMethod === "catalogue" && (
                    <div className="mt-5">
                      <p className="mb-3 text-sm font-semibold text-slate-300">Choose a system</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {Object.keys(categories).map((category) => (
                          <button
                            key={category}
                            type="button"
                            aria-pressed={partCategory === category}
                            onClick={() => {
                              setPartCategory(category);
                              setPart("");
                              setShowResults(false);
                            }}
                            className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                              partCategory === category
                                ? "border-sky-400/60 bg-sky-400/15 text-sky-200"
                                : "border-white/10 bg-white/[0.04] text-slate-300"
                            }`}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                      {partCategory && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {categories[partCategory as keyof typeof categories].map((item) => (
                            <button
                              key={item}
                              type="button"
                              aria-pressed={part === item}
                              onClick={() => {
                                setPart(item);
                                setShowResults(false);
                              }}
                              className={`rounded-full border px-3 py-2 text-sm transition ${
                                part === item
                                  ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
                                  : "border-white/10 text-slate-400 hover:text-white"
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
                      <label className="text-sm text-slate-300">
                        <span className="mb-2 block">Part name</span>
                        <input value={part} onChange={(event) => { setPart(event.target.value); setShowResults(false); }} placeholder="e.g. front brake pads" className={fieldClass} />
                      </label>
                      <label className="text-sm text-slate-300">
                        <span className="mb-2 block">Part number <span className="text-slate-500">(optional)</span></span>
                        <input value={partNumber} onChange={(event) => { setPartNumber(event.target.value); setShowResults(false); }} placeholder="OEM or manufacturer number" className={fieldClass} />
                      </label>
                    </div>
                  )}

                  {(partMethod === "diagram" || partMethod === "catalogue" || partMethod === "search") && (
                    <button type="button" onClick={handlePartsSearch} className="mt-5 w-full rounded-2xl bg-sky-400 px-5 py-4 font-bold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-300">Find compatible listings</button>
                  )}
                </div>
              )}
              {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
            </>
          )}
        </section>

        {showResults && mode === "cars" && (
          <section className="mx-auto mt-6 max-w-3xl">
            <div className="grid gap-3 sm:grid-cols-3">
              {platformCards
                .filter((item) => platform === "all" || platform === item.id)
                .map((item) => (
                  <a key={item.id} href={carLinks[item.id]} target="_blank" rel="noreferrer" className="group rounded-2xl border border-white/10 bg-white/[0.045] p-5 transition hover:-translate-y-1 hover:border-sky-400/40 hover:bg-white/[0.07]">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-300">Search now</span>
                    <h3 className="mt-3 text-lg font-bold">{item.name}</h3>
                    <p className="mt-1 min-h-10 text-sm text-slate-400">{item.label}</p>
                    <span className="mt-5 block text-sm font-semibold text-white">Open results →</span>
                  </a>
                ))}
            </div>
            <SaveButton item={{ kind: "car_search", title: [year, make, model].filter(Boolean).join(" "), data: { make, model, year, price, postcode, platform, links: carLinks } }} />
          </section>
        )}

        {showResults && mode === "parts" && (
          <section className="mx-auto mt-6 max-w-3xl rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Search ready</p>
              <h3 className="mt-2 text-lg font-bold">{[vehicleLabel, part || partCategory || partNumber].filter(Boolean).join(" · ")}</h3>
              <p className="mt-1 text-sm text-slate-400">Check the listing&apos;s compatibility details before purchasing.</p>
              <SaveButton item={{ kind: "part_search", title: [vehicleLabel, part || partCategory || partNumber].filter(Boolean).join(" · "), data: { vehicleLabel, vehicleDetails, make, model, year, registration, part, partCategory, partNumber, link: partsLink } }} />
            </div>
            <a href={partsLink} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl bg-emerald-300 px-5 py-3 font-bold text-emerald-950 sm:mt-0">View parts on eBay</a>
          </section>
        )}

        <section className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            ["01", "Search wider", "Jump into the UK’s most useful car marketplaces from one clean search."],
            ["02", "Match smarter", "Start parts searches with a registration or a specific make, model and year."],
            ["03", "Stay in control", "CarScout sends you to the original listing so you can verify every detail yourself."],
          ].map(([number, title, copy]) => (
            <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <span className="text-xs font-bold text-sky-300">{number}</span>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
            </div>
          ))}
        </section>

        <footer className="mt-16 border-t border-white/10 pt-6 text-center text-xs leading-5 text-slate-500">
          <p>CarScout does not sell vehicles or guarantee listing accuracy or part compatibility. Verify all information with the marketplace or seller.</p>
          <nav aria-label="Footer" className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
            <a href="/privacy" className="hover:text-slate-300">Privacy</a>
            <a href="/terms" className="hover:text-slate-300">Terms</a>
            <a href="/support" className="hover:text-slate-300">Report a problem</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
