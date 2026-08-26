"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SaveButton from "./components/save-button";
import { getSupabaseBrowserClient } from "./lib/supabase";

type Mode = "cars" | "parts";
type MarketplaceId = "autotrader" | "facebook" | "ebay" | "motors" | "gumtree" | "cargurus" | "pistonheads" | "aacars" | "carandclassic";
type Platform = "all" | "more" | MarketplaceId;
type PartMethod = "diagram" | "catalogue" | "search";

type EbayListing = {
  id: string;
  title: string;
  url: string;
  image: string | null;
  price: string | null;
  currency: string | null;
  condition: string | null;
  location: string | null;
};

type VehicleLookup = {
  registrationNumber?: string;
  make?: string;
  yearOfManufacture?: number;
  engineCapacity?: number;
  fuelType?: string;
  colour?: string;
  motStatus?: string;
  taxStatus?: string;
};

type DiagramSystem = {
  name: string;
  shortName: string;
  description: string;
  accent: string;
  parts: readonly string[];
  hotspot: readonly [number, number];
  partPositions: readonly (readonly [number, number])[];
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
    hotspot: [446, 166],
    partPositions: [[145, 112], [183, 239], [367, 118], [411, 235]],
  },
  Brakes: {
    name: "Braking system",
    shortName: "Brakes",
    description: "Pads, discs, calipers and sensors",
    accent: "#fb7185",
    parts: ["Brake Disc", "Brake Pads", "Brake Caliper", "ABS Sensor"],
    hotspot: [444, 232],
    partPositions: [[280, 180], [370, 145], [402, 224], [154, 102]],
  },
  Suspension: {
    name: "Suspension & steering",
    shortName: "Suspension",
    description: "Dampers, springs, arms and steering parts",
    accent: "#a78bfa",
    parts: ["Shock Absorber", "Coil Spring", "Control Arm", "Drop Link"],
    hotspot: [153, 232],
    partPositions: [[177, 185], [286, 177], [397, 222], [390, 104]],
  },
  Body: {
    name: "Body & lighting",
    shortName: "Body",
    description: "Panels, lamps, mirrors and exterior trim",
    accent: "#34d399",
    parts: ["Front Bumper", "Headlight", "Wing Mirror", "Tail Light"],
    hotspot: [530, 205],
    partPositions: [[447, 241], [456, 141], [282, 99], [112, 160]],
  },
  Electrical: {
    name: "Electrical system",
    shortName: "Electrical",
    description: "Battery, charging, starting and control units",
    accent: "#fbbf24",
    parts: ["Battery", "Alternator", "Starter Motor", "Fuse Box"],
    hotspot: [383, 156],
    partPositions: [[153, 183], [290, 177], [406, 205], [374, 94]],
  },
  Interior: {
    name: "Interior & controls",
    shortName: "Interior",
    description: "Seats, dashboard, controls and cabin trim",
    accent: "#f472b6",
    parts: ["Steering Wheel", "Dashboard", "Front Seat", "Gear Knob"],
    hotspot: [278, 139],
    partPositions: [[180, 126], [284, 116], [383, 207], [284, 245]],
  },
};

// Enable only when a licensed provider can return diagrams for the selected vehicle.
const vehicleSpecificDiagramsAvailable = false;

function SystemIcon({ system }: { system: string }) {
  const paths: Record<string, React.ReactNode> = {
    Engine: <><rect x="7" y="9" width="18" height="14" rx="3" /><path d="M10 9V6h5v3M25 13h3v6h-3M7 13H4v6h3M12 16h8" /></>,
    Brakes: <><circle cx="16" cy="16" r="10" /><circle cx="16" cy="16" r="4" /><path d="M23 9l4 2v10l-4 2" /></>,
    Suspension: <><path d="M10 4h12M12 7h8l-7 4 7 4-7 4 7 4h-8M10 26h12" /></>,
    Body: <><path d="M4 20h24l-2-7-5-4H11l-5 5-2 6Z" /><circle cx="10" cy="21" r="3" /><circle cx="23" cy="21" r="3" /></>,
    Electrical: <><rect x="5" y="8" width="22" height="17" rx="3" /><path d="M11 8V5h10v3M10 16h5M12.5 13.5v5M20 14v5M17.5 16.5h5" /></>,
    Interior: <><path d="M8 25V14c0-4 3-7 7-7h2c4 0 7 3 7 7v11M8 19h16M13 13h6M16 19v6" /></>,
  };
  return <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7 fill-none stroke-current stroke-[1.8]">{paths[system]}</svg>;
}

function SystemArtwork({ system, accent }: { system: string; accent: string }) {
  const common = { fill: "none", stroke: accent, strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const artwork: Record<string, React.ReactNode> = {
    Engine: <g {...common}><path d="M105 130h75l32-43h151l31 43h58v112h-49l-24 35H194l-28-35h-61Z" /><path d="M218 111v143M354 111v143M242 145h87v70h-87zM119 158h57v49h-57zM395 151h42v66h-42z" /><circle cx="267" cy="180" r="16" /><circle cx="310" cy="180" r="16" /><path d="M235 78h101M267 68v20M302 68v20" /></g>,
    Brakes: <g {...common}><circle cx="280" cy="180" r="112" /><circle cx="280" cy="180" r="55" /><circle cx="280" cy="180" r="13" /><path d="M355 99c50 28 72 75 61 124l-61 21-28-45 15-60Z" fill={`${accent}22`} /><path d="M122 86h68v43h-68zM113 236c37-8 63-28 79-59M139 274c43-14 77-38 99-74" /><circle cx="280" cy="103" r="7" /><circle cx="347" cy="219" r="7" /><circle cx="213" cy="219" r="7" /></g>,
    Suspension: <g {...common}><path d="M173 59v242M147 77h52M147 286h52M155 103l36 25-36 25 36 25-36 25 36 25-36 25" /><path d="M286 64v220M261 87h50M261 266h50M269 112l34 25-34 25 34 25-34 25 34 25" /><path d="M333 241h126l-20 40H352zM349 239l34-107h43l25 108" /><path d="M369 112h75M382 77h49v35" /></g>,
    Body: <g {...common}><path d="M67 226 91 150l87-35 55-46h129l68 53 63 27 22 77Z" /><path d="m240 85-35 72h168l-29-72M289 85v72M104 165h91M382 158h91" /><path d="M424 186h75v40h-75zM65 192h73v34H65z" fill={`${accent}1f`} /><path d="M253 54h66l18 31h-102z" /><circle cx="150" cy="235" r="42" /><circle cx="434" cy="235" r="42" /></g>,
    Electrical: <g {...common}><rect x="91" y="116" width="123" height="132" rx="13" /><path d="M121 116V91h63v25M119 173h36M137 155v36M175 173h24" /><circle cx="291" cy="177" r="68" /><path d="M291 109v136M233 177h116M256 128l70 98M326 128l-70 98" /><path d="M359 157h97v97h-97zM379 184h57M379 207h57M379 230h31M351 83h86l19 40h-124z" /></g>,
    Interior: <g {...common}><path d="M82 252V112l67-46h253l76 67v119Z" /><circle cx="180" cy="126" r="48" /><circle cx="180" cy="126" r="20" /><path d="M180 78v96M132 126h96M237 84h98l30 62H237z" /><path d="M352 159h83v104h-83c-16-28-16-74 0-104ZM245 203h68v67h-68zM279 203v67M263 232h33" /></g>,
  };
  return <>{artwork[system]}</>;
}

const partHints: Record<string, string> = {
  "Air Filter": "Usually a flat, pleated panel inside a plastic air box.",
  "Oil Filter": "Usually a small metal can or cartridge housing.",
  "Timing Belt": "A toothed rubber belt hidden behind an engine cover.",
  "Water Pump": "A compact metal housing with a pulley or hose outlets.",
  "Brake Disc": "A large, flat metal circle mounted behind the wheel.",
  "Brake Pads": "Small curved blocks that sit on each side of the disc.",
  "Brake Caliper": "A heavy clamp-shaped housing fitted over the disc.",
  "ABS Sensor": "A small wired sensor mounted close to the wheel hub.",
  "Shock Absorber": "A long metal cylinder fitted vertically near a wheel.",
  "Coil Spring": "A thick metal coil positioned above or around the damper.",
  "Control Arm": "A solid A-shaped or curved arm under the vehicle.",
  "Drop Link": "A short thin rod with a joint at both ends.",
  "Front Bumper": "The large moulded panel across the front of the car.",
  Headlight: "The complete clear lamp unit at a front corner.",
  "Wing Mirror": "The mirror assembly attached to a front door.",
  "Tail Light": "The red lamp unit fitted at a rear corner.",
  Battery: "A rectangular box with positive and negative terminals.",
  Alternator: "A vented metal unit with a belt pulley on the front.",
  "Starter Motor": "A compact cylindrical motor with a smaller cylinder attached.",
  "Fuse Box": "A plastic box containing rows of coloured fuses and relays.",
  "Steering Wheel": "The round driver control mounted in front of the dashboard.",
  Dashboard: "The wide moulded panel containing instruments and air vents.",
  "Front Seat": "The complete seat frame, cushion and backrest assembly.",
  "Gear Knob": "The hand grip fitted to the top of the gear lever.",
};

function PartSketch({ part, accent }: { part: string; accent: string }) {
  const props = { fill: "none", stroke: accent, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (/Filter/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><rect x="9" y="10" width="54" height="36" rx="7" /><path d="M17 16v24M25 16v24M33 16v24M41 16v24M49 16v24M57 16v24" /></g></svg>;
  if (/Belt/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><path d="M15 16c8-8 34-8 42 0l-5 26c-8 7-24 7-32 0Z" /><path d="M22 15l2 5m7-8 1 6m8-6-1 6m9-3-2 5" /></g></svg>;
  if (/Disc/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><circle cx="34" cy="28" r="21" /><circle cx="34" cy="28" r="8" /><path d="M53 14l8 5v19l-8 5" /></g></svg>;
  if (/Pads/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><path d="M9 38V20c11-7 22-7 29 0v18c-9 5-19 5-29 0Zm29 0V20c9-6 18-5 25 1v16c-7 6-16 7-25 1Z" /></g></svg>;
  if (/Caliper/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><path d="M13 13h37l10 10v20H41V29H25v14H10V21Z" /><circle cx="35" cy="28" r="6" /></g></svg>;
  if (/Sensor/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><path d="M12 12c19 0 15 31 35 31" /><rect x="45" y="35" width="16" height="14" rx="4" /><circle cx="12" cy="12" r="5" /></g></svg>;
  if (/Spring/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><path d="M22 7h28M27 12h18l-17 7 17 7-17 7 17 7-18 6h23" /></g></svg>;
  if (/Absorber|Drop Link/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><path d="M35 6v13m-9 0h18v25H26zM35 44v7" /><circle cx="35" cy="8" r="5" /><circle cx="35" cy="49" r="5" /></g></svg>;
  if (/Control Arm/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><path d="M12 13l17 31h30L43 13Z" /><circle cx="12" cy="13" r="6" /><circle cx="43" cy="13" r="6" /><circle cx="59" cy="44" r="6" /></g></svg>;
  if (/Bumper/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><path d="M7 25c13-13 45-13 58 0l-5 17H12Z" /><path d="M18 31h36" /></g></svg>;
  if (/light|Headlight/i.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><path d="M9 34c14-22 35-26 54-12l-7 21H15Z" /><circle cx="42" cy="30" r="8" /></g></svg>;
  if (/Mirror/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><path d="M10 27c8-17 31-19 47-5v19H19Z" /><path d="M57 31h7v17" /></g></svg>;
  if (/Battery|Fuse Box/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><rect x="9" y="12" width="54" height="37" rx="5" /><path d="M19 12V7h12v5m10 0V7h12v5M20 29h12m-6-6v12m20-6h10" /></g></svg>;
  if (/Alternator/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><circle cx="35" cy="29" r="21" /><circle cx="35" cy="29" r="8" /><path d="M35 8v12M14 29h13m8 8v13m8-21h15" /></g></svg>;
  if (/Starter/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><rect x="8" y="19" width="43" height="26" rx="12" /><rect x="41" y="10" width="20" height="19" rx="6" /><path d="M8 32H3m58-12h7" /></g></svg>;
  if (/Wheel/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><circle cx="36" cy="28" r="22" /><circle cx="36" cy="28" r="7" /><path d="M36 6v15M14 28h15m7 7v15m7-22h15" /></g></svg>;
  if (/Seat/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><path d="M23 7h22v27H23zM18 34h37v12H18zM23 46v6m27-6v6" /></g></svg>;
  if (/Gear/.test(part)) return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><circle cx="36" cy="14" r="10" /><path d="M36 24v25M27 49h18" /></g></svg>;
  return <svg viewBox="0 0 72 56" aria-hidden="true" className="h-14 w-16"><g {...props}><path d="M8 38V20l12-9h32l12 11v16Z" /><path d="M22 38v9m28-9v9M19 27h34" /></g></svg>;
}

type VehicleImage = { url: string; pageUrl: string; title: string; creator: string; license: string; licenseUrl: string };

function VehicleReference({ make, model, year }: { make: string; model: string; year: string }) {
  const query = `${make}|${model}|${year}`;
  const [result, setResult] = useState<{ query: string; image: VehicleImage | null }>({ query: "", image: null });

  useEffect(() => {
    if (!make) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ make, model, year });
    fetch(`/api/vehicle-image?${params}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => setResult({ query, image: payload.image || null }))
      .catch((error) => { if (error?.name !== "AbortError") setResult({ query, image: null }); });
    return () => controller.abort();
  }, [make, model, query, year]);

  const loading = Boolean(make && result.query !== query);
  const image = result.query === query ? result.image : null;
  if (loading) return <div className="mt-5 h-52 animate-pulse rounded-2xl border border-white/10 bg-white/[0.035]" aria-label="Loading vehicle reference image" />;
  if (!image) return null;

  return (
    <figure className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#091526]">
      <div className="relative aspect-[16/7] min-h-48 bg-white/5">
        <Image src={image.url} alt={`${year} ${make} ${model} visual reference`} fill sizes="(max-width: 768px) 100vw, 700px" className="object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07101e] to-transparent px-4 pb-4 pt-12">
          <strong className="text-sm">{[year, make, model].filter(Boolean).join(" ")} reference</strong>
          <p className="mt-1 text-xs text-slate-300">Use this to recognise the vehicle only. Body style, trim and fitted parts may differ.</p>
        </div>
      </div>
      <figcaption className="flex flex-wrap gap-x-2 px-4 py-2 text-[10px] text-slate-500">
        <a href={image.pageUrl} target="_blank" rel="noreferrer" className="hover:text-slate-300">{image.title}</a>
        <span>· {image.creator}</span>
        <a href={image.licenseUrl} target="_blank" rel="noreferrer" className="hover:text-slate-300">· {image.license}</a>
      </figcaption>
    </figure>
  );
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
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Visual parts guide</p>
          <h3 className="mt-1 text-lg font-bold">Where on the vehicle is the part?</h3>
          <p className="mt-2 text-sm text-slate-400">Choose the closest area. You&apos;ll see simple component pictures on the next step.</p>
        </div>
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(diagramSystems).map(([id, system], index) => (
              <button key={id} type="button" onClick={() => onCategory(id)} className="group rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left transition hover:-translate-y-0.5 hover:border-sky-400/40 hover:bg-white/[0.07]">
                <span className="flex items-center justify-between" style={{ color: system.accent }}><SystemIcon system={id} /><span className="grid h-7 w-7 place-items-center rounded-full border text-xs font-black" style={{ borderColor: `${system.accent}88` }}>{index + 1}</span></span>
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
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-3 py-1.5 text-xs text-amber-100">General guide — not vehicle-specific</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400">Tap a numbered part</span>
        </div>
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-[1.35fr_0.85fr] sm:p-6">
        <div className="relative min-h-80 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <svg viewBox="0 0 560 360" role="img" aria-label={`Exploded ${selectedSystem.name} parts diagram`} className="h-full w-full">
            <rect x="20" y="20" width="520" height="300" rx="24" fill="#07101e" stroke="#1e293b" strokeWidth="2" />
            <SystemArtwork system={category} accent={selectedSystem.accent} />
            {selectedSystem.parts.map((item, index) => {
              const [x, y] = selectedSystem.partPositions[index];
              const active = part === item;
              return (
                <g key={item} role="button" tabIndex={0} aria-label={item} onClick={() => onPart(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onPart(item); }} className="cursor-pointer outline-none">
                  <circle cx={x} cy={y} r="18" fill={active ? selectedSystem.accent : "#0f172a"} stroke={active ? "#fff" : selectedSystem.accent} strokeWidth="3" />
                  <text x={x} y={y + 5} textAnchor="middle" fill={active ? "#07101e" : "#fff"} fontSize="14" fontWeight="800">{index + 1}</text>
                </g>
              );
            })}
            <text x="280" y="344" textAnchor="middle" fill="#64748b" fontSize="12">Built-in interactive schematic — select a numbered component</text>
          </svg>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">What does your part look like?</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">Compare its general shape, then select the closest match.</p>
          <div className="mt-3 space-y-2">
            {selectedSystem.parts.map((item, index) => (
              <button key={item} type="button" aria-pressed={part === item} onClick={() => onPart(item)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${part === item ? "border-sky-400/60 bg-sky-400/10" : "border-white/10 bg-white/[0.025] hover:border-white/25"}`}>
                <span className="relative grid h-16 w-[4.5rem] shrink-0 place-items-center rounded-lg bg-black/20"><PartSketch part={item} accent={selectedSystem.accent} /><span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black text-slate-950" style={{ backgroundColor: selectedSystem.accent }}>{index + 1}</span></span>
                <span><strong className="block text-sm">{item}</strong><span className="mt-1 block text-xs leading-4 text-slate-500">{partHints[item]}</span></span>
              </button>
            ))}
          </div>
          {part && <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-xs leading-5 text-emerald-100"><strong>{part} selected.</strong> We&apos;ll include the vehicle details in your search. A visual match is only a starting point—confirm the part number and fitment with the seller before buying.</div>}
        </div>
      </div>
    </div>
  );
}

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
  "w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-[15px] text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/60 focus:bg-white/[0.09] focus:ring-4 focus:ring-sky-400/10";

function EbayResults({ items, loading, error, fallbackUrl }: { items: EbayListing[]; loading: boolean; error: string; fallbackUrl: string }) {
  if (loading) {
    return <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm text-slate-300">Loading live eBay listings…</div>;
  }

  if (error || items.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5 text-sm text-amber-100">
        <p>{error || "No live eBay listings matched this search."}</p>
        <a href={fallbackUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex font-bold underline underline-offset-4">Search directly on eBay</a>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-wider text-sky-300">Live eBay listings</p><p className="mt-1 text-xs text-slate-500">Prices and availability can change. Verify every listing on eBay.</p></div>
        <a href={fallbackUrl} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-semibold text-sky-300">See all →</a>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.slice(0, 6).map((item) => (
          <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-sky-400/40 hover:bg-white/[0.07]">
            <h3 className="line-clamp-3 text-sm font-bold leading-5">{item.title}</h3>
            <p className="mt-3 text-lg font-black text-white">{item.price ? `${item.currency === "GBP" ? "£" : `${item.currency ?? ""} `}${item.price}` : "See price"}</p>
            <p className="mt-1 text-xs text-slate-500">{[item.condition, item.location].filter(Boolean).join(" · ") || "View listing details"}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

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
  const [ebayItems, setEbayItems] = useState<EbayListing[]>([]);
  const [ebayLoading, setEbayLoading] = useState(false);
  const [ebayError, setEbayError] = useState("");

  const trackActivity = async (eventName: "car_search" | "part_search" | "part_number_search" | "vehicle_lookup", metadata: Record<string, unknown>) => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { data } = await client.auth.getSession();
    const user = data.session?.user;
    if (user) await client.from("activity_events").insert({ user_id: user.id, event_name: eventName, metadata });
  };

  const resetPartsBelowVehicle = () => {
    setPartMethod("");
    setPartCategory("");
    setPart("");
    setPartNumber("");
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
      const payload = (await response.json()) as { vehicle?: VehicleLookup; error?: string };
      if (!response.ok || !payload.vehicle) throw new Error(payload.error || "We could not identify that vehicle.");

      const vehicle = payload.vehicle;
      const matchedMake = Object.keys(makes).find((item) => item.toLowerCase() === vehicle.make?.toLowerCase());
      setRegistration(vehicle.registrationNumber || cleanedRegistration);
      setMake(matchedMake || vehicle.make || "");
      setModel("");
      setYear(vehicle.yearOfManufacture ? String(vehicle.yearOfManufacture) : "");
      setEngine(vehicle.engineCapacity ? `${(vehicle.engineCapacity / 1000).toFixed(1)}L` : "");
      setFuel(vehicle.fuelType ? vehicle.fuelType.charAt(0) + vehicle.fuelType.slice(1).toLowerCase() : "");
      setBodyStyle("");
      resetPartsBelowVehicle();
      setVehicleLookup(vehicle);
      await trackActivity("vehicle_lookup", { registrationNumber: cleanedRegistration, make: vehicle.make, year: vehicle.yearOfManufacture });
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "We could not identify that vehicle.");
    } finally {
      setVehicleLookupLoading(false);
    }
  };

  const setAppMode = (nextMode: Mode) => {
    setMode(nextMode);
    setShowResults(false);
    setError("");
    setEbayItems([]);
    setEbayError("");
  };

  const vehicleReady = Boolean(make && model && year);
  const vehicleLabel = [year, make, model, engine, fuel, bodyStyle].filter(Boolean).join(" ");

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
    const motorsSlug = (value: string) => value.toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const motorsPath = [motorsSlug(make), motorsSlug(model)].filter(Boolean).join("/");
    return {
      autotrader: `https://www.autotrader.co.uk/car-search?${autoTraderParams.toString()}`,
      facebook: `https://www.facebook.com/marketplace/uk/search?query=${encodeURIComponent(query)}`,
      ebay: `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(`${query} car`)}`,
      motors: motorsPath ? `https://www.cazoo.co.uk/cars/${motorsPath}/` : "https://www.cazoo.co.uk/cars/",
      gumtree: `https://www.gumtree.com/search?search_category=cars&q=${encodeURIComponent(query)}`,
      cargurus: `https://www.cargurus.co.uk/Cars/forsale?keywords=${encodeURIComponent(query)}`,
      pistonheads: `https://www.pistonheads.com/buy/search?keyword=${encodeURIComponent(query)}`,
      aacars: `https://www.theaa.com/used-cars/displaycars?keyword=${encodeURIComponent(query)}`,
      carandclassic: `https://www.carandclassic.com/search?search=${encodeURIComponent(query)}`,
    };
  }, [make, model, postcode, price, year]);

  const partsLink = useMemo(() => {
    const vehicle = [year, make, model, engine, fuel, bodyStyle].filter(Boolean).join(" ");
    const query = [vehicle, partCategory, part, partNumber]
      .filter(Boolean)
      .join(" ");
    return `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(query)}`;
  }, [bodyStyle, engine, fuel, make, model, part, partCategory, partNumber, year]);

  const searchEbay = async (query: string, type: "cars" | "parts", maxPrice?: string) => {
    setEbayLoading(true);
    setEbayError("");
    setEbayItems([]);
    try {
      const params = new URLSearchParams({ type, q: query });
      if (maxPrice) params.set("maxPrice", maxPrice);
      const response = await fetch(`/api/ebay/search?${params}`);
      const payload = (await response.json()) as { items?: EbayListing[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Live eBay results are unavailable.");
      setEbayItems(payload.items ?? []);
    } catch (searchError) {
      setEbayError(searchError instanceof Error ? searchError.message : "Live eBay results are unavailable.");
    } finally {
      setEbayLoading(false);
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
    setShowResults(true);
    await trackActivity("car_search", { make, model, year, price: Boolean(price), postcode: Boolean(postcode), platform });
    const query = [make, model, year].filter(Boolean).join(" ");
    if (platform === "all" || platform === "ebay") {
      void searchEbay(query, "cars", price);
    }
    if (platform !== "all" && platform !== "more" && platform !== "ebay") {
      window.open(carLinks[platform], "_blank", "noopener,noreferrer");
    }
  };

  const handlePartsSearch = async () => {
    if (!vehicleReady) {
      setError("Select the make, model and year.");
      return;
    }
    if (!part.trim() && !partCategory && !partNumber.trim()) {
      setError("Choose a category or enter the part you need.");
      return;
    }
    setError("");
    setShowResults(true);
    await trackActivity("part_search", { vehicle: vehicleLabel, engine: engine || undefined, fuel: fuel || undefined, bodyStyle: bodyStyle || undefined, category: partCategory, part: part || undefined, hasPartNumber: Boolean(partNumber) });
    void searchEbay([vehicleLabel, partCategory, part, partNumber].filter(Boolean).join(" "), "parts");
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
    setShowResults(true);
    await trackActivity("part_number_search", { hasPartNumber: true });
    void searchEbay(number, "parts");
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
            <Image src="/icon.svg" alt="" width={44} height={44} className="h-11 w-11 drop-shadow-[0_8px_18px_rgba(14,165,233,0.24)]" priority />
            <span>
              <strong className="block text-xl tracking-tight">Mekivo</strong>
              <span className="text-xs text-slate-400">
                UK car &amp; parts search
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
            Mekivo turns a scattered search across UK marketplaces into one
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
                            ? "border-sky-400/50 bg-sky-400/15 text-sky-200"
                            : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        {item === "all" ? "All platforms" : item === "more" ? "More platforms" : platformNames[item]}
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
                Search {platformNames[platform]}
              </button>
            </>
          ) : (
            <>
              <div className="mb-7 rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.055] p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Fastest route</p>
                <h2 className="mt-1 text-xl font-bold">Already know the part number?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Search an OEM or manufacturer number directly without selecting a vehicle.</p>
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

              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Step 1</p>
                  <h2 className="mt-1 text-2xl font-bold">Tell us which vehicle</h2>
                  <p className="mt-2 text-sm text-slate-400">Use the registration for a quick start, or enter the vehicle manually.</p>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-sky-400/20 bg-sky-400/[0.055] p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Quick vehicle lookup</p>
                <h3 className="mt-1 text-lg font-bold">Find it by registration</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">We use official DVLA vehicle data. You&apos;ll still confirm the model before searching for parts.</p>
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
                    className={`${fieldClass} font-bold uppercase tracking-[0.12em]`}
                  />
                  <button
                    type="button"
                    onClick={handleVehicleLookup}
                    disabled={vehicleLookupLoading}
                    className="shrink-0 rounded-2xl bg-sky-400 px-5 py-3.5 font-bold text-slate-950 transition hover:bg-sky-300 disabled:cursor-wait disabled:opacity-60"
                  >
                    {vehicleLookupLoading ? "Checking DVLA…" : "Find vehicle"}
                  </button>
                </div>
                {vehicleLookup && (
                  <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4 text-sm text-emerald-50">
                    <p className="font-bold">{[vehicleLookup.yearOfManufacture, vehicleLookup.make, vehicleLookup.colour].filter(Boolean).join(" · ")}</p>
                    <p className="mt-1 text-xs leading-5 text-emerald-100/75">{[vehicleLookup.fuelType, vehicleLookup.engineCapacity ? `${vehicleLookup.engineCapacity}cc` : "", vehicleLookup.motStatus ? `MOT: ${vehicleLookup.motStatus}` : "", vehicleLookup.taxStatus ? `Tax: ${vehicleLookup.taxStatus}` : ""].filter(Boolean).join(" · ")}</p>
                    <p className="mt-2 text-xs font-semibold text-emerald-200">Now choose the model below to continue.</p>
                  </div>
                )}
              </div>

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
                        setEngine("");
                        setFuel("");
                        setBodyStyle("");
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
                        setEngine("");
                        setFuel("");
                        setBodyStyle("");
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

              {vehicleReady && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <p className="text-sm font-semibold text-slate-200">Add details for a more precise parts search <span className="font-normal text-slate-500">(optional)</span></p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="text-sm text-slate-300">
                      <span className="mb-2 block">Engine or variant</span>
                      <input value={engine} onChange={(event) => { setEngine(event.target.value); resetPartsBelowVehicle(); }} placeholder="e.g. 2.0 TDI 150" className={fieldClass} />
                    </label>
                    <label className="text-sm text-slate-300">
                      <span className="mb-2 block">Fuel</span>
                      <select value={fuel} onChange={(event) => { setFuel(event.target.value); resetPartsBelowVehicle(); }} className={fieldClass}>
                        <option value="">Not sure</option>
                        <option>Petrol</option>
                        <option>Diesel</option>
                        <option>Hybrid</option>
                        <option>Electric</option>
                        <option>LPG</option>
                      </select>
                    </label>
                    <label className="text-sm text-slate-300">
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
                  <p className="mt-3 text-xs leading-5 text-slate-500">These details narrow the marketplace query. They do not replace seller fitment confirmation or a VIN check.</p>
                </div>
              )}

              {vehicleReady && (
                <div className="mt-8 border-t border-white/10 pt-7">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Step 2</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-2xl font-bold">How do you want to find it?</h2>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-slate-300">{vehicleLabel}</span>
                  </div>
                  <VehicleReference
                    make={make}
                    model={model}
                    year={year}
                  />
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {([
                      ...(vehicleSpecificDiagramsAvailable ? [["diagram", "Vehicle diagram", "Explore diagrams licensed for this exact vehicle", "Coming soon"] as const] : []),
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

                  {vehicleSpecificDiagramsAvailable && partMethod === "diagram" && (
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
                .filter((item) => platform === "all" || platform === item.id || (platform === "more" && moreMarketplaceIds.includes(item.id)))
                .map((item) => (
                  <a key={item.id} href={carLinks[item.id]} target="_blank" rel="noreferrer" className="group rounded-2xl border border-white/10 bg-white/[0.045] p-5 transition hover:-translate-y-1 hover:border-sky-400/40 hover:bg-white/[0.07]">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-300">Search now</span>
                    <h3 className="mt-3 text-lg font-bold">{item.name}</h3>
                    <p className="mt-1 min-h-10 text-sm text-slate-400">{item.label}</p>
                    <span className="mt-5 block text-sm font-semibold text-white">Open results →</span>
                  </a>
                ))}
            </div>
            {(platform === "all" || platform === "ebay") && <EbayResults items={ebayItems} loading={ebayLoading} error={ebayError} fallbackUrl={carLinks.ebay} />}
            <SaveButton item={{ kind: "car_search", title: [year, make, model].filter(Boolean).join(" "), data: { make, model, year, price, postcode, platform, links: carLinks } }} />
          </section>
        )}

        {showResults && mode === "parts" && (
          <div className="mx-auto mt-6 max-w-3xl">
            <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Search ready</p>
                <h3 className="mt-2 text-lg font-bold">{[vehicleLabel, part || partCategory || partNumber].filter(Boolean).join(" · ")}</h3>
                <p className="mt-1 text-sm text-slate-400">Check the listing&apos;s compatibility details before purchasing.</p>
                <SaveButton item={{ kind: "part_search", title: [vehicleLabel, part || partCategory || partNumber].filter(Boolean).join(" · "), data: { vehicleLabel, make, model, year, engine, fuel, bodyStyle, part, partCategory, partNumber, link: partsLink } }} />
              </div>
              <a href={partsLink} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl bg-emerald-300 px-5 py-3 font-bold text-emerald-950 sm:mt-0">View all on eBay</a>
            </section>
            <EbayResults items={ebayItems} loading={ebayLoading} error={ebayError} fallbackUrl={partsLink} />
          </div>
        )}

        <section className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            ["01", "Search wider", "Jump into the UK’s most useful car marketplaces from one clean search."],
            ["02", "Match smarter", "Start parts searches with a specific make, model and year."],
            ["03", "Stay in control", "Mekivo sends you to the original listing so you can verify every detail yourself."],
          ].map(([number, title, copy]) => (
            <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <span className="text-xs font-bold text-sky-300">{number}</span>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
            </div>
          ))}
        </section>

        <footer className="mt-16 border-t border-white/10 pt-6 text-center text-xs leading-5 text-slate-500">
          <p>Mekivo does not sell vehicles or guarantee listing accuracy or part compatibility. Verify all information with the marketplace or seller.</p>
          <nav aria-label="Footer" className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
            <a href="/privacy" className="hover:text-slate-300">Privacy</a>
            <a href="/terms" className="hover:text-slate-300">Terms</a>
            <a href="/guides" className="hover:text-slate-300">Guides</a>
            <a href="/support" className="hover:text-slate-300">Suggestions and support</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
