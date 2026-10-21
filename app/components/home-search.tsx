"use client";

import { useEffect, useState } from "react";
import Form from "next/form";
import VehiclePicker from "./vehicle-picker";
import CarExtraFilters from "./car-extra-filters";
import type { CarExtra } from "../lib/car-extras";
import type { CarSort } from "../lib/search";
import { makes } from "../lib/vehicle-options";
import { vehicleModelsForMake } from "../lib/vehicle-picker-options";
import { trackCampaignLanding } from "../lib/campaign-landing";

const years = Array.from({ length: new Date().getFullYear() - 1959 }, (_, index) => String(new Date().getFullYear() - index));
const filterInputClass = "min-h-12 min-w-0 w-full rounded-2xl border border-outline/15 bg-overlay/[0.06] px-3 py-3.5 text-base text-foreground outline-none placeholder:text-subtle focus:border-sky-400/60 focus:ring-4 focus:ring-sky-400/10";

export default function HomeSearch() {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [year, setYear] = useState("");
  const [postcode, setPostcode] = useState("");
  const [extras, setExtras] = useState<CarExtra[]>([]);
  const [sort, setSort] = useState<CarSort>("price_asc");
  const [hideUnwanted, setHideUnwanted] = useState(true);
  const modelOptions = vehicleModelsForMake(makes, make);
  const selectedFilterCount = [price, minPrice, year, postcode, ...extras, sort !== "price_asc", !hideUnwanted].filter(Boolean).length;

  useEffect(() => { trackCampaignLanding("cars"); }, []);

  return <Form action="/cars" onReset={() => {
    setMake(""); setModel(""); setPrice(""); setMinPrice(""); setYear(""); setPostcode(""); setExtras([]); setSort("price_asc"); setHideUnwanted(true);
  }} onInvalid={event => {
    let disclosure = (event.target as HTMLInputElement).closest("details");
    while (disclosure) {
      disclosure.setAttribute("open", "");
      disclosure = disclosure.parentElement?.closest("details") ?? null;
    }
  }}>
    <input type="hidden" name="restore" value="1" />
    <input type="hidden" name="mode" value="cars" />
    <input type="hidden" name="run" value="1" />
    <input type="hidden" name="hide_unwanted" value={hideUnwanted ? "1" : "0"} />
    <input type="hidden" name="extras" value={extras.join(",")} />
    <input type="hidden" name="make" value={make} />
    <input type="hidden" name="model" value={model} />
    <div className="grid gap-4 sm:grid-cols-2">
      <VehiclePicker id="home-car-make" label="Make" value={make} onChange={value => { setMake(value); setModel(""); }} options={Object.keys(makes)} placeholder="Any make" optional />
      <VehiclePicker id="home-car-model" label="Model" value={model} onChange={setModel} options={modelOptions} placeholder={make ? "Any model" : "Choose a make first"} disabled={!make} optional />
    </div>
    <details className="mt-4 rounded-2xl border border-outline/15 bg-panel p-4">
      <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-semibold text-link focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">More filters{selectedFilterCount ? ` · ${selectedFilterCount} selected` : ""}</summary>
      <fieldset className="mt-3">
        <legend className="mb-2 text-sm font-semibold text-foreground">Price range (£)</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="home-car-min-budget" className="mb-2 block text-sm text-muted">Minimum</label>
            <input id="home-car-min-budget" name="min_price" type="text" pattern="[0-9]{1,8}" title="Enter a whole-pound amount, for example 500" inputMode="numeric" placeholder="No min" value={minPrice} onChange={event => setMinPrice(event.target.value)}
              className={filterInputClass} />
          </div>
          <div className="min-w-0">
            <label htmlFor="home-car-budget" className="mb-2 block text-sm text-muted">Maximum</label>
            <input id="home-car-budget" name="price" type="text" pattern="[1-9][0-9]{0,8}" title="Enter a whole-pound amount, for example 5000" inputMode="numeric" placeholder="No max" value={price} onChange={event => setPrice(event.target.value)}
              className={filterInputClass} />
          </div>
        </div>
      </fieldset>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label htmlFor="home-car-year" className="mb-2 block text-sm text-muted">Year</label>
          <select id="home-car-year" name="year" value={year} onChange={event => setYear(event.target.value)} className={filterInputClass}>
            <option value="" className="bg-panel text-foreground">Any year</option>
            {years.map(value => <option key={value} value={value} className="bg-panel text-foreground">{value}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="home-car-postcode" className="mb-2 block text-sm text-muted">Postcode</label>
          <input id="home-car-postcode" name="postcode" type="text" autoComplete="postal-code" maxLength={10} pattern="[A-Za-z]{1,2}[0-9][A-Za-z0-9]?\s*[0-9][A-Za-z]{2}" title="Enter a UK postcode, for example B1 1AA" placeholder="e.g. B1 1AA" value={postcode} onChange={event => setPostcode(event.target.value)} aria-describedby="home-car-location-help" className={filterInputClass} />
        </div>
      </div>
      <p id="home-car-location-help" className="mt-2 text-xs leading-5 text-muted">Live eBay results appear here. Other sites may need filters set again; the postcode does not limit eBay results by distance.</p>
      <CarExtraFilters value={extras} onChange={setExtras} />
      <details className="mt-4 border-t border-outline/10 pt-3">
        <summary className="min-h-11 cursor-pointer rounded-lg text-sm font-semibold text-link focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">Search options</summary>
        <label htmlFor="home-car-sort" className="mb-2 block text-sm text-muted">Sort live results</label>
        <select id="home-car-sort" name="sort" value={sort} onChange={event => setSort(event.target.value as CarSort)} className={filterInputClass}>
          <option value="price_asc" className="bg-panel text-foreground">Price: low to high</option>
          <option value="price_desc" className="bg-panel text-foreground">Price: high to low</option>
          <option value="newest" className="bg-panel text-foreground">Newly listed</option>
          <option value="best_match" className="bg-panel text-foreground">Best match</option>
        </select>
        <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-outline/15 px-3 py-3 text-sm text-foreground">
          <input type="checkbox" checked={hideUnwanted} onChange={event => setHideUnwanted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400" />
          Hide parts, repair and deposit adverts
        </label>
        <p className="mt-2 text-xs leading-5 text-muted">Sorting and advert checks apply to live eBay results. Confirm the vehicle&apos;s condition with the seller.</p>
      </details>
    </details>
    <div className="mt-5 flex items-center gap-4">
      <button type="submit" className="min-h-12 flex-1 rounded-2xl bg-sky-400 px-5 py-3.5 text-base font-bold text-slate-950 transition hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">Search cars →</button>
      <button type="reset" className="min-h-12 rounded-xl px-2 py-3 text-sm font-semibold text-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link">Reset</button>
    </div>
    <p className="mt-3 text-xs leading-5 text-muted">Leave make and model blank to browse any car. More filters has price, year, location and extras.</p>
  </Form>;
}
