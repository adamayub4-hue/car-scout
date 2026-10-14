"use client";

import { carExtras, normalizeCarExtras, type CarExtra } from "../lib/car-extras";

export default function CarExtraFilters({ value, onChange }: {
  value: CarExtra[];
  onChange: (extras: CarExtra[]) => void;
}) {
  const groups = [...new Set(carExtras.map(extra => extra.group))];
  return <details className="mt-4 rounded-2xl border border-outline/15 bg-overlay/[0.025] p-4">
    <summary className="min-h-11 cursor-pointer rounded-lg text-sm font-bold text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400">
      Advanced filters
      <span className="ml-2 text-xs font-normal text-muted">{value.length ? `${value.length} ${value.length === 1 ? "extra" : "extras"} selected` : "Seats, roofs, parking and more"}</span>
    </summary>
    <p id="car-extras-help" className="mb-4 text-sm leading-6 text-muted">Choose extras you want the advert to mention. Every selected extra must appear in its title or summary; some adverts leave equipment out. Confirm the specification and that it works with the seller.</p>
    <div className="space-y-5">
      {groups.map(group => <fieldset key={group} aria-describedby="car-extras-help">
        <legend className="mb-2 text-sm font-semibold text-foreground">{group}</legend>
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          {carExtras.filter(extra => extra.group === group).map(extra => <label key={extra.id}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${value.includes(extra.id) ? "border-sky-400/50 bg-sky-400/10 text-foreground" : "border-outline/15 text-muted hover:bg-overlay/5"}`}>
            <input type="checkbox" checked={value.includes(extra.id)}
              onChange={event => onChange(normalizeCarExtras(event.target.checked ? [...value, extra.id] : value.filter(id => id !== extra.id)))}
              className="h-5 w-5 shrink-0 accent-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400" />
            <span>{extra.label}</span>
          </label>)}
        </div>
      </fieldset>)}
    </div>
    {value.length > 0 && <button type="button" onClick={() => onChange([])}
      className="mt-4 min-h-11 rounded-xl border border-outline/15 px-3 py-2 text-sm font-semibold text-link hover:bg-overlay/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">Clear extras</button>}
    <p className="mt-4 text-xs leading-5 text-subtle">Extras filter the live eBay results. Other marketplaces may need their filters set again.</p>
  </details>;
}
