"use client";

import { useEffect, useState } from "react";
import Form from "next/form";
import VehiclePicker from "./vehicle-picker";
import { makes } from "../lib/vehicle-options";
import { vehicleModelsForMake } from "../lib/vehicle-picker-options";
import { trackCampaignLanding } from "../lib/campaign-landing";

export default function HomeSearch() {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  const modelOptions = vehicleModelsForMake(makes, make);

  useEffect(() => { trackCampaignLanding("cars"); }, []);

  return <Form action="/cars" onReset={() => { setMake(""); setModel(""); setPrice(""); }}>
    <input type="hidden" name="restore" value="1" />
    <input type="hidden" name="mode" value="cars" />
    <input type="hidden" name="run" value="1" />
    <input type="hidden" name="sort" value="price_asc" />
    <input type="hidden" name="hide_unwanted" value="1" />
    <input type="hidden" name="make" value={make} />
    <input type="hidden" name="model" value={model} />
    <div className="grid gap-4 sm:grid-cols-2">
      <VehiclePicker id="home-car-make" label="Make" value={make} onChange={value => { setMake(value); setModel(""); }} options={Object.keys(makes)} placeholder="Any make" optional />
      <VehiclePicker id="home-car-model" label="Model" value={model} onChange={setModel} options={modelOptions} placeholder={make ? "Any model" : "Choose a make first"} disabled={!make} optional />
    </div>
    <div className="mt-4">
      <label htmlFor="home-car-budget" className="mb-2 block text-sm text-muted">Maximum budget (£) <span className="text-subtle">(optional)</span></label>
      <div className="relative">
        <span aria-hidden="true" className="absolute inset-y-0 left-4 flex items-center text-base font-semibold text-muted">£</span>
        <input id="home-car-budget" name="price" type="text" pattern="[1-9][0-9]{0,8}" title="Enter a whole-pound amount, for example 5000" inputMode="numeric" placeholder="Any budget" value={price} onChange={event => setPrice(event.target.value)}
          className="min-h-12 w-full rounded-2xl border border-outline/15 bg-overlay/[0.06] py-3.5 pl-9 pr-4 text-base text-foreground outline-none placeholder:text-subtle focus:border-sky-400/60 focus:ring-4 focus:ring-sky-400/10" />
      </div>
    </div>
    <div className="mt-5 flex items-center gap-4">
      <button type="submit" className="min-h-12 flex-1 rounded-2xl bg-sky-400 px-5 py-3.5 text-base font-bold text-slate-950 transition hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">Search cars →</button>
      <button type="reset" className="min-h-12 rounded-xl px-2 py-3 text-sm font-semibold text-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link">Reset</button>
    </div>
    <p className="mt-3 text-xs leading-5 text-muted">Leave make and model blank to browse any car within your budget. More filters are on the search page.</p>
  </Form>;
}
