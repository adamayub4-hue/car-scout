"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { diagramSystems, electricDiagramOverrides, partHints, systemIllustrations } from "../lib/parts-guide-data";

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
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Choose the area nearest the component. The next view shows common parts and reference shapes for that system.</p>
            </div>
            <span className="rounded-[3px] border border-outline/20 bg-overlay/[0.035] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">General reference · Not vehicle-specific</span>
          </div>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)] sm:p-6">
          <div className="self-start overflow-hidden rounded-[4px] border border-slate-700/80 bg-[#060d17] shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-700/80 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-400">
              <span>Vehicle diagram</span>
              <span className="hidden sm:inline">General side view</span>
            </div>
            <div className="relative" style={{ aspectRatio: "560 / 320" }}>
            <svg viewBox="0 0 560 320" aria-hidden="true" className="absolute inset-0 h-full w-full">
              <defs>
                <pattern id="locator-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                  <path d="M28 0H0V28" fill="none" stroke="#1e293b" strokeWidth="1" opacity="0.55" />
                </pattern>
              </defs>
              <rect width="560" height="320" fill="url(#locator-grid)" />
              <path d="M24 256H536M280 30V279" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="4 7" />
              <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M39 222 52 198 64 173 145 145 219 78 357 78 434 143 500 166 522 205 519 222h-51c-4-31-27-53-57-53s-53 22-57 53H210c-4-31-27-53-57-53s-53 22-57 53Z" fill="#0b1524" stroke="#a7b3c3" strokeWidth="2.2" />
                <path d="m229 91-47 53h207l-43-53Zm57 0v53M182 144l-36 1M389 144l45-1M239 151l-13 69m105-69 18 69M225 220h126M220 153h134" stroke="#64748b" strokeWidth="1.4" />
                <path d="M248 160h35m44 0h12M76 181l60-20m303-9 54 26M48 207h43m381 0h45M217 231h141" stroke="#475569" strokeWidth="1.2" />
                <path d="M407 117h-28M166 151h36M115 153h29M421 153h34" stroke="#7dd3fc" strokeWidth="1.6" />
                <path d="M383 154h52v21M410 104v50M76 175v34M481 171v38" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
                <circle cx="153" cy="222" r="49" fill="#07101e" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="153" cy="222" r="31" stroke="#475569" strokeWidth="1.4" />
                <circle cx="153" cy="222" r="8" stroke="#94a3b8" strokeWidth="1.6" />
                <path d="m153 191 10 23 21 8-21 8-10 23-10-23-21-8 21-8Z" stroke="#475569" strokeWidth="1" />
                <circle cx="411" cy="222" r="49" fill="#07101e" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="411" cy="222" r="31" stroke="#475569" strokeWidth="1.4" />
                <circle cx="411" cy="222" r="8" stroke="#94a3b8" strokeWidth="1.6" />
                <path d="m411 191 10 23 21 8-21 8-10 23-10-23-21-8 21-8Z" stroke="#475569" strokeWidth="1" />
                <path d="M83 280H481m-398-5v10m398-10v10" stroke="#475569" strokeWidth="1" />
              </g>
              <text x="29" y="43" fill="#64748b" fontFamily="monospace" fontSize="9" letterSpacing="1.3">FRONT →</text>
              <text x="280" y="294" textAnchor="middle" fill="#64748b" fontFamily="monospace" fontSize="9" letterSpacing="1.2">GENERIC PASSENGER VEHICLE · NOT TO SCALE</text>
            </svg>
            {visibleDiagramSystems.map(([id, system], index) => {
              const [x, y] = system.hotspot;
              return (
                <button
                  key={id}
                  type="button"
                  aria-label={`${system.name}: view common parts`}
                  tabIndex={-1}
                  onClick={() => onCategory(id)}
                  className="group absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060d17]"
                  style={{ left: `${(x / 560) * 100}%`, top: `${(y / 320) * 100}%` }}
                >
                  <span className="grid h-8 min-w-8 place-items-center rounded-[2px] border border-sky-300/80 bg-[#07101e] px-1 font-mono text-[11px] font-bold tabular-nums text-sky-200 shadow-[0_0_0_1px_rgba(2,8,23,0.75)] transition-colors group-hover:bg-sky-300 group-hover:text-slate-950">{String(index + 1).padStart(2, "0")}</span>
                </button>
              );
            })}
            </div>
            <div className="flex items-center justify-between border-t border-slate-700/80 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <span>Location guide</span>
              <span className="hidden sm:inline">Choose a numbered area</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-[4px] border border-outline/15 bg-overlay/[0.02]">
            <div className="flex items-center justify-between border-b border-outline/15 px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
              <span>System list</span>
              <span>{String(visibleDiagramSystems.length).padStart(2, "0")} systems</span>
            </div>
            {visibleDiagramSystems.map(([id, system], index) => (
              <button key={id} type="button" onClick={() => onCategory(id)} className="group grid w-full grid-cols-[2.7rem_minmax(0,1fr)_1.25rem] items-center gap-2 border-b border-outline/10 px-4 py-3 text-left outline-none transition-colors last:border-b-0 hover:bg-sky-400/[0.055] focus-visible:bg-sky-400/[0.08] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300">
                <span className="font-mono text-xs font-semibold tabular-nums text-link">{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0"><strong className="block text-sm font-semibold">{system.shortName}</strong><span className="mt-0.5 block text-xs leading-4 text-subtle">{system.description}</span></span>
                <span aria-hidden="true" className="font-mono text-sm text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-link">→</span>
              </button>
            ))}
          </div>
        </div>
        <p className="border-t border-outline/15 px-5 py-4 text-xs leading-5 text-subtle sm:px-6"><strong className="font-semibold text-muted">Illustration is for location guidance only.</strong> Parts, systems and positions vary by model, year, power type and body style; some shown parts will not be fitted to every vehicle. {electricOnly ? "Combustion-engine and exhaust options are hidden for this electric vehicle. " : ""}Use this to learn a likely part name, then confirm the exact part number and fitment with the seller, manufacturer information or a qualified technician.</p>
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-outline/15 bg-panel shadow-[0_18px_45px_rgba(2,8,23,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline/15 px-5 py-5 sm:px-6">
        <div>
          <button type="button" onClick={() => onCategory("")} className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-link hover:text-link">← Return to system map</button>
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
            <Image src={`/parts-guide/${systemIllustrations[selectedArtwork]}.webp`} alt={`Generic examples in reading order: ${selectedSystem.parts.join(", ")}.`} fill sizes="(max-width: 640px) 90vw, (max-width: 1024px) 720px, 500px" className="object-contain" />
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
              {selectedSystem.parts.map((item, index) => (
                <button key={item} type="button" aria-label={item} aria-pressed={part === item} onClick={() => onPart(item)} className={`relative m-1 rounded-xl border-2 outline-none transition focus-visible:ring-4 focus-visible:ring-sky-500 ${part === item ? "border-sky-600 bg-sky-400/10" : "border-transparent hover:border-sky-500"}`}>
                  <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-sky-950 text-xs font-bold text-white shadow">{index + 1}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="border-t border-slate-300 px-4 py-3 text-xs leading-5 text-slate-600">Generated generic illustrations. Separate examples, not an assembly or exact vehicle diagram.</p>
        </div>
        <div className="min-w-0">
          <div className="flex items-center justify-between border-b border-outline/15 pb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
            <span>Part list</span>
            <span>{String(selectedSystem.parts.length).padStart(2, "0")} items</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">Compare the reference shape and description, then select the closest match.</p>
          <div className="mt-3 overflow-hidden rounded-[4px] border border-outline/15">
            {selectedSystem.parts.map((item, index) => (
              <button key={item} type="button" aria-pressed={part === item} onClick={() => onPart(item)} className={`grid w-full grid-cols-[2.4rem_minmax(0,1fr)] items-center gap-2 border-b border-outline/10 p-3 text-left outline-none transition-colors last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300 ${part === item ? "bg-sky-400/[0.09]" : "bg-overlay/[0.018] hover:bg-overlay/[0.05]"}`}>
                <span className={`self-start pt-1 font-mono text-[11px] font-semibold tabular-nums ${part === item ? "text-link" : "text-subtle"}`}>{String(index + 1).padStart(2, "0")}</span>
                <span><strong className="block text-sm font-semibold">{item}</strong><span className="mt-1 block text-xs leading-4 text-subtle">{partHints[item]}</span></span>
              </button>
            ))}
          </div>
          {category === "Exhaust" && <p className="mt-3 text-xs leading-5 text-muted">Catalytic converters and DPFs can look similar. Use the part number and vehicle details to tell them apart.</p>}
          {electricOnly && (category === "Electrical" || category === "Drivetrain") && <p className="mt-3 text-xs leading-5 text-muted">Electric-drive components can be integrated and look different between models. These are naming examples, not instructions for working on high-voltage equipment.</p>}
          {part && <div className="mt-3 rounded-[4px] border border-sky-400/25 bg-sky-400/[0.06] p-3 text-xs leading-5 text-muted"><strong className="font-semibold text-link">Selected: {part}.</strong> Add or confirm your vehicle details to narrow the search. A visual match is only a starting point—confirm the part number and fitment with the seller before buying.</div>}
        </div>
      </div>
      <p className="border-t border-outline/15 px-5 py-4 text-xs leading-5 text-subtle sm:px-6"><strong className="font-semibold text-muted">Illustration is for location guidance only.</strong> Components and positions vary by vehicle. Confirm the exact part number and compatibility before buying.</p>
    </div>
  );
}
