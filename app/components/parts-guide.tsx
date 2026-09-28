"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { diagramSystems, electricDiagramOverrides, illustrationHotspots, partHints, systemIllustrations } from "../lib/parts-guide-data";

// Percent coordinates calibrated to both overview illustrations. Callouts sit
// outside the car, with enough separation for 44px targets on narrow screens.
const overviewLocations: Record<string, { label: [number, number]; target: [number, number] }> = {
  Engine: { label: [62, 8], target: [80, 45] },
  Brakes: { label: [62, 92], target: [79, 63] },
  Suspension: { label: [12, 92], target: [18, 44] },
  Body: { label: [12, 8], target: [12, 30] },
  Electrical: { label: [87, 8], target: [88, 47] },
  Interior: { label: [37, 8], target: [50, 40] },
  Exhaust: { label: [37, 92], target: [36, 63] },
  Drivetrain: { label: [87, 92], target: [85, 57] },
};

export default function DiagramExplorer({
  category,
  part,
  fuel,
  onCategory,
  onPart,
}: {
  category: string;
  part: string;
  fuel: string;
  onCategory: (value: string) => void;
  onPart: (value: string) => void;
}) {
  const selectedHeadingRef = useRef<HTMLHeadingElement>(null);
  const mapHeadingRef = useRef<HTMLHeadingElement>(null);
  const hadSelectionRef = useRef(false);
  const [activeSystem, setActiveSystem] = useState("");
  const [activePart, setActivePart] = useState("");
  const electricOnly = /^electric/i.test(fuel.trim());
  const visibleDiagramSystems = Object.entries(diagramSystems)
    .filter(([id]) => !electricOnly || (id !== "Engine" && id !== "Exhaust"))
    .map(([id, system]) => [id, electricOnly ? (electricDiagramOverrides[id] || system) : system] as const);
  const selectedSystem = visibleDiagramSystems.find(([id]) => id === category)?.[1] || null;
  const selectedSystemNumber = selectedSystem
    ? visibleDiagramSystems.findIndex(([id]) => id === category) + 1
    : 0;
  const selectedArtwork = electricOnly && category === "Electrical"
    ? "ElectricElectrical"
    : electricOnly && category === "Drivetrain"
      ? "ElectricDrivetrain"
      : category;
  const artwork = systemIllustrations[selectedArtwork];
  const illustratedPart = selectedSystem?.parts.includes(part) ? part : "";

  useEffect(() => {
    if (selectedSystem) selectedHeadingRef.current?.focus();
    else if (hadSelectionRef.current) mapHeadingRef.current?.focus();
    hadSelectionRef.current = Boolean(selectedSystem);
  }, [selectedSystem]);

  if (!selectedSystem) {
    return (
      <div className="mt-5 overflow-hidden rounded-lg border border-outline/15 bg-panel shadow-[0_18px_45px_rgba(2,8,23,0.12)]">
        <div className="border-b border-outline/15 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-link">Parts guide / Vehicle map</p>
              <h3 ref={mapHeadingRef} tabIndex={-1} className="mt-2 text-xl font-semibold tracking-tight outline-none">Select the vehicle system</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Choose a numbered marker or a system from the list. The next view shows common parts and reference shapes for that system.</p>
            </div>
            <span className="rounded-[3px] border border-outline/20 bg-overlay/[0.035] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">General reference · Not vehicle-specific</span>
          </div>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)] sm:p-6">
          <div className="self-start overflow-hidden rounded-[4px] border border-slate-700/80 bg-[#060d17] shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-700/80 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-400">
              <span>Vehicle diagram</span>
              <span className="hidden sm:inline">{electricOnly ? "Electric vehicle" : "Petrol / diesel example"}</span>
            </div>
            <div className="relative aspect-[3/2] bg-black">
              <Image
                key={electricOnly ? "electric-overview" : "combustion-overview"}
                src={electricOnly ? "/parts-guide/vehicle-electric-overview-v2.png" : "/parts-guide/vehicle-overview-v2.png"}
                alt={electricOnly ? "Generic electric hatchback cutaway, front facing right, showing the cabin, battery pack, electric drive, brakes and suspension." : "Generic combustion hatchback cutaway, front facing right, showing the cabin, engine, brakes, suspension and exhaust."}
                fill
                loading="eager"
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 720px, 600px"
                className="object-contain"
              />
              <svg viewBox="0 0 600 400" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
                {visibleDiagramSystems.map(([id]) => {
                  const { label, target } = overviewLocations[id];
                  const active = activeSystem === id;
                  return <g key={id} stroke={active ? "#38bdf8" : "#cbd5e1"} opacity={active ? 1 : 0.6}>
                    <path d={`M${label[0] * 6} ${label[1] * 4} L${target[0] * 6} ${target[1] * 4}`} strokeWidth={active ? 2.5 : 1.5} />
                    <circle cx={target[0] * 6} cy={target[1] * 4} r={active ? 5 : 3} fill={active ? "#38bdf8" : "#0f172a"} strokeWidth="2" />
                  </g>;
                })}
              </svg>
              {visibleDiagramSystems.map(([id, system], index) => {
                const [x, y] = overviewLocations[id].label;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-label={`${system.name}: view common parts`}
                    title={system.name}
                    onClick={() => { setActiveSystem(""); onCategory(id); }}
                    onMouseEnter={() => setActiveSystem(id)}
                    onMouseLeave={() => setActiveSystem("")}
                    onFocus={() => setActiveSystem(id)}
                    onBlur={() => setActiveSystem("")}
                    className="group absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    style={{ left: `${x}%`, top: `clamp(22px, ${y}%, calc(100% - 22px))` }}
                  >
                    <span className={`grid h-8 min-w-8 place-items-center rounded-full border px-1 font-mono text-xs font-bold tabular-nums shadow-lg transition-colors ${activeSystem === id ? "border-sky-300 bg-sky-300 text-slate-950" : "border-slate-400 bg-slate-950 text-white"}`}>{String(index + 1).padStart(2, "0")}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-slate-700/80 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <span>{visibleDiagramSystems.find(([id]) => id === activeSystem)?.[1].shortName || "Choose a numbered marker"}</span>
              <span>Front →</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-[4px] border border-outline/15 bg-overlay/[0.02]">
            <div className="flex items-center justify-between border-b border-outline/15 px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
              <span>System list</span>
              <span>{String(visibleDiagramSystems.length).padStart(2, "0")} systems</span>
            </div>
            {visibleDiagramSystems.map(([id, system], index) => (
              <button key={id} type="button" onClick={() => { setActiveSystem(""); onCategory(id); }} onMouseEnter={() => setActiveSystem(id)} onMouseLeave={() => setActiveSystem("")} onFocus={() => setActiveSystem(id)} onBlur={() => setActiveSystem("")} data-active={activeSystem === id} className="group grid w-full data-[active=true]:bg-sky-400/[0.08] grid-cols-[2.7rem_minmax(0,1fr)_1.25rem] items-center gap-2 border-b border-outline/10 px-4 py-3 text-left outline-none transition-colors last:border-b-0 hover:bg-sky-400/[0.055] focus-visible:bg-sky-400/[0.08] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300">
                <span className="font-mono text-xs font-semibold tabular-nums text-link">{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0"><strong className="block text-sm font-semibold">{system.shortName}</strong><span className="mt-0.5 block text-xs leading-4 text-subtle">{system.description}</span></span>
                <span aria-hidden="true" className="font-mono text-sm text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-link">→</span>
              </button>
            ))}
          </div>
        </div>
        <p className="border-t border-outline/15 px-5 py-4 text-xs leading-5 text-subtle sm:px-6"><strong className="font-semibold text-muted">Generated illustration is for location guidance only.</strong> Parts, systems and positions vary by model, year, power type and body style; some shown parts will not be fitted to every vehicle. {electricOnly ? "Combustion-engine and exhaust options are hidden for this electric vehicle. " : ""}Use this to learn a likely part name, then confirm the exact part number and fitment with the seller, manufacturer information or a qualified technician.</p>
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-outline/15 bg-panel shadow-[0_18px_45px_rgba(2,8,23,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline/15 px-5 py-5 sm:px-6">
        <div>
          <button type="button" onClick={() => { setActivePart(""); onCategory(""); }} className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-link hover:text-link">← Return to system map</button>
          <p className="mt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">System {String(selectedSystemNumber).padStart(2, "0")}</p>
          <h3 ref={selectedHeadingRef} tabIndex={-1} className="mt-1 text-xl font-semibold tracking-tight outline-none">{selectedSystem.name}</h3>
          <p className="mt-1 text-sm text-muted">{selectedSystem.description}</p>
        </div>
        <span className="rounded-[3px] border border-outline/20 bg-overlay/[0.035] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">General reference · Not vehicle-specific</span>
      </div>
      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(15rem,0.9fr)] sm:p-6">
        <div className="self-start overflow-hidden rounded-xl border border-slate-300 bg-slate-100 text-slate-900">
          <div className="flex items-center justify-between gap-2 border-b border-slate-300 px-4 py-3 text-xs font-semibold">
            <span>{selectedSystem.shortName} · Component examples</span>
          </div>
          <div className="relative aspect-[3/2] bg-[radial-gradient(ellipse,white,#dce5ed)]">
            <Image key={artwork} src={`/parts-guide/${artwork}.webp`} alt={`Generic examples in reading order: ${selectedSystem.parts.join(", ")}.`} fill loading="eager" sizes="(max-width: 640px) 90vw, (max-width: 1024px) 720px, 500px" className="object-contain" />
            {selectedSystem.parts.map((item, index) => {
              const [x, y] = illustrationHotspots[artwork][index];
              const highlighted = illustratedPart === item || activePart === item;
              return (
                <button
                  key={item}
                  type="button"
                  aria-label={`Select ${item} from illustration`}
                  aria-pressed={illustratedPart === item}
                  title={item}
                  onClick={() => onPart(item)}
                  onMouseEnter={() => setActivePart(item)}
                  onMouseLeave={() => setActivePart("")}
                  onFocus={() => setActivePart(item)}
                  onBlur={() => setActivePart("")}
                  className="absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <span className={`grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-bold shadow-md transition-colors ${highlighted ? "border-white bg-sky-600 text-white" : "border-slate-200 bg-slate-950 text-white"}`}>{index + 1}</span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-slate-300 bg-white px-4 py-3 text-sm" aria-live="polite">
            {illustratedPart ? <><strong className="text-sky-800">{selectedSystem.parts.indexOf(illustratedPart) + 1}. {illustratedPart}</strong><p className="mt-1 text-xs leading-5 text-slate-600">{partHints[illustratedPart]}</p></> : <span className="text-slate-600">Tap a numbered marker or choose a part from the list.</span>}
          </div>
          <p className="border-t border-slate-300 px-4 py-3 text-xs leading-5 text-slate-600">Generated generic illustrations. Separate examples, not an assembly or exact vehicle diagram.</p>
        </div>
        <div className="min-w-0">
          <div className="flex items-center justify-between border-b border-outline/15 pb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
            <span>Part list</span>
            <span>{String(selectedSystem.parts.length).padStart(2, "0")} items</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">Match the numbered picture to its name below, then select the closest match.</p>
          <div className="mt-3 overflow-hidden rounded-[4px] border border-outline/15">
            {selectedSystem.parts.map((item, index) => (
              <button key={item} type="button" aria-pressed={illustratedPart === item} onClick={() => onPart(item)} onMouseEnter={() => setActivePart(item)} onMouseLeave={() => setActivePart("")} onFocus={() => setActivePart(item)} onBlur={() => setActivePart("")} className={`grid w-full grid-cols-[2.4rem_minmax(0,1fr)] items-center gap-2 border-b border-outline/10 p-3 text-left outline-none transition-colors last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300 ${illustratedPart === item || activePart === item ? "bg-sky-400/[0.09]" : "bg-overlay/[0.018] hover:bg-overlay/[0.05]"}`}>
                <span className={`self-start pt-1 font-mono text-[11px] font-semibold tabular-nums ${illustratedPart === item || activePart === item ? "text-link" : "text-subtle"}`}>{String(index + 1).padStart(2, "0")}</span>
                <span><strong className="block text-sm font-semibold">{item}</strong><span className="mt-1 block text-xs leading-4 text-subtle">{partHints[item]}</span></span>
              </button>
            ))}
          </div>
          {category === "Exhaust" && <p className="mt-3 text-xs leading-5 text-muted">Catalytic converters and DPFs can look similar. Use the part number and vehicle details to tell them apart.</p>}
          {electricOnly && (category === "Electrical" || category === "Drivetrain") && <p className="mt-3 text-xs leading-5 text-muted">Electric-drive components can be integrated and look different between models. These are naming examples, not instructions for working on high-voltage equipment.</p>}
          {illustratedPart && <div className="mt-3 rounded-[4px] border border-sky-400/25 bg-sky-400/[0.06] p-3 text-xs leading-5 text-muted"><strong className="font-semibold text-link">Selected: {illustratedPart}.</strong> Add or confirm your vehicle details to narrow the search. A visual match is only a starting point—confirm the part number and fitment with the seller before buying.</div>}
        </div>
      </div>
      <p className="border-t border-outline/15 px-5 py-4 text-xs leading-5 text-subtle sm:px-6"><strong className="font-semibold text-muted">Illustration is for location guidance only.</strong> Components and positions vary by vehicle. Confirm the exact part number and compatibility before buying.</p>
    </div>
  );
}
