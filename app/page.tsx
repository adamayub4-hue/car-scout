"use client";

import { useMemo, useState } from "react";

type Mode = "cars" | "parts";
type Platform = "all" | "autotrader" | "ebay" | "gumtree";
type VehiclePath = "registration" | "manual";
type PartMethod = "diagram" | "catalogue" | "search";

const makes = {
  Audi: ["A1", "A3", "A4", "A5", "Q3", "Q5"],
  BMW: ["1 Series", "3 Series", "5 Series", "X1", "X3"],
  Mercedes: ["A Class", "C Class", "E Class", "GLA", "GLC"],
  Ford: ["Fiesta", "Focus", "Kuga", "Puma"],
  Volkswagen: ["Polo", "Golf", "Passat", "Tiguan"],
  Toyota: ["Yaris", "Corolla", "C-HR", "RAV4"],
} as const;

const categories = {
  Engine: ["Oil Filter", "Air Filter", "Spark Plugs", "Timing Belt", "Water Pump"],
  Brakes: ["Brake Pads", "Brake Discs", "Brake Calipers", "Brake Lines", "ABS Sensors"],
  Suspension: ["Shock Absorbers", "Coil Springs", "Drop Links", "Control Arms", "Bushes"],
  Body: ["Front Bumper", "Rear Bumper", "Wing Mirror", "Headlight", "Tail Light"],
  Interior: ["Steering Wheel", "Dashboard", "Seat", "Gear Knob", "Floor Mat"],
  Electrical: ["Battery", "Alternator", "Starter Motor", "Fuse Box", "ECU"],
} as const;

const platformCards = [
  { id: "autotrader", name: "Auto Trader", label: "Largest UK marketplace" },
  { id: "ebay", name: "eBay Motors", label: "Auctions and fixed-price cars" },
  { id: "gumtree", name: "Gumtree", label: "Local and private listings" },
] as const;

const years = Array.from({ length: 26 }, (_, index) => String(new Date().getFullYear() - index));

function cleanRegistration(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
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
  const [vehiclePath, setVehiclePath] = useState<VehiclePath>("registration");
  const [partMethod, setPartMethod] = useState<PartMethod | "">("");
  const [part, setPart] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partCategory, setPartCategory] = useState("");
  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);

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
    resetPartsBelowVehicle();
  };

  const setAppMode = (nextMode: Mode) => {
    setMode(nextMode);
    setShowResults(false);
    setError("");
  };

  const vehicleReady =
    vehiclePath === "registration"
      ? registration.length >= 5
      : Boolean(make && model && year);
  const vehicleLabel =
    vehiclePath === "registration"
      ? registration
      : [year, make, model].filter(Boolean).join(" ");

  const carLinks = useMemo(() => {
    const query = [
      make,
      price ? `under £${price}` : "",
      postcode ? `near ${postcode}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return {
      autotrader: `https://www.autotrader.co.uk/car-search?make=${encodeURIComponent(make)}&postcode=${encodeURIComponent(postcode)}&price-to=${encodeURIComponent(price)}`,
      ebay: `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(`${query} car`)}`,
      gumtree: `https://www.gumtree.com/search?search_category=cars&q=${encodeURIComponent(query)}`,
    };
  }, [make, postcode, price]);

  const partsLink = useMemo(() => {
    const vehicle =
      vehiclePath === "registration"
        ? `${registration} vehicle`
        : `${year} ${make} ${model}`;
    const query = [vehicle, partCategory, part, partNumber]
      .filter(Boolean)
      .join(" ");
    return `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(query)}`;
  }, [make, model, part, partCategory, partNumber, registration, vehiclePath, year]);

  const handleCarSearch = () => {
    if (!make.trim()) {
      setError("Enter a make to start your search.");
      return;
    }
    setError("");
    setShowResults(true);
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
    if (!part.trim() && !partCategory) {
      setError("Choose a category or enter the part you need.");
      return;
    }
    setError("");
    setShowResults(true);
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
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            UK beta
          </span>
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
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm text-slate-300">
                  <span className="mb-2 block">Make</span>
                  <input
                    value={make}
                    onChange={(event) => {
                      setMake(event.target.value);
                      setShowResults(false);
                    }}
                    placeholder="e.g. BMW"
                    className={fieldClass}
                  />
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
                        resetPartsBelowVehicle();
                      }}
                      placeholder="AB12 CDE"
                      className="w-full rounded-xl border-2 border-slate-900 bg-[#f5c518] px-4 py-3 text-center text-2xl font-black uppercase tracking-[0.16em] text-slate-950 outline-none focus:border-white sm:max-w-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (registration.length < 5) setError("Enter a valid UK registration.");
                        else setError("");
                      }}
                      className="rounded-xl bg-white px-5 py-3 font-bold text-slate-950 hover:bg-slate-100"
                    >
                      Use this vehicle
                    </button>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-400">
                    Registration narrows the vehicle search. Always confirm engine,
                    trim and fitment with the seller before ordering.
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <label className="text-sm text-slate-300">
                    <span className="mb-2 block">Make</span>
                    <select
                      value={make}
                      onChange={(event) => {
                        setMake(event.target.value);
                        setModel("");
                        setYear("");
                        resetPartsBelowVehicle();
                      }}
                      className={fieldClass}
                    >
                      <option value="">Select make</option>
                      {Object.keys(makes).map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="text-sm text-slate-300">
                    <span className="mb-2 block">Model</span>
                    <select
                      value={model}
                      disabled={!make}
                      onChange={(event) => {
                        setModel(event.target.value);
                        setYear("");
                        resetPartsBelowVehicle();
                      }}
                      className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <option value="">Select model</option>
                      {make && makes[make as keyof typeof makes]?.map((item) => <option key={item}>{item}</option>)}
                    </select>
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
                      ["diagram", "Car diagram", "Choose the area on the vehicle", "Visual finder coming soon"],
                      ["catalogue", "Parts catalogue", "Browse common parts by system", "Ready to use"],
                      ["search", "Search directly", "Enter a name or part number", "Fastest route"],
                    ] as const).map(([id, title, description, badge]) => (
                      <button
                        key={id}
                        type="button"
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
                    <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
                      <span className="text-4xl">🚗</span>
                      <h3 className="mt-3 font-bold">Visual parts finder is coming next</h3>
                      <p className="mt-2 text-sm text-slate-400">For now, use the catalogue or direct search to find the right listing.</p>
                    </div>
                  )}

                  {partMethod === "catalogue" && (
                    <div className="mt-5">
                      <p className="mb-3 text-sm font-semibold text-slate-300">Choose a system</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {Object.keys(categories).map((category) => (
                          <button
                            key={category}
                            type="button"
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

                  {(partMethod === "catalogue" || partMethod === "search") && (
                    <button type="button" onClick={handlePartsSearch} className="mt-5 w-full rounded-2xl bg-sky-400 px-5 py-4 font-bold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-300">Find compatible listings</button>
                  )}
                </div>
              )}
              {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
            </>
          )}
        </section>

        {showResults && mode === "cars" && (
          <section className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-3">
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
          </section>
        )}

        {showResults && mode === "parts" && (
          <section className="mx-auto mt-6 max-w-3xl rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Search ready</p>
              <h3 className="mt-2 text-lg font-bold">{[vehicleLabel, part || partCategory].filter(Boolean).join(" · ")}</h3>
              <p className="mt-1 text-sm text-slate-400">Check the listing&apos;s compatibility details before purchasing.</p>
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
          CarScout does not sell vehicles or guarantee listing accuracy or part compatibility. Verify all information with the marketplace or seller.
        </footer>
      </div>
    </main>
  );
}
