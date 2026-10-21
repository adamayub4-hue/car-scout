import { carExtraLabels, normalizeCarExtras } from "./car-extras";
import type { SubmittedSearch } from "./search";
import { makes, motorbikeMakes } from "./vehicle-options";
import { vehicleModelsForMake } from "./vehicle-picker-options";

export type SearchProblemOutcome = "empty" | "unavailable";
export type SearchProblemReport = { subject: string; message: string; details: string };

const marketplaces: Record<string, string> = {
  all: "All marketplaces", more: "More marketplaces", ebay: "eBay", autotrader: "Auto Trader",
  facebook: "Facebook Marketplace", motors: "MOTORS / Cazoo", gumtree: "Gumtree",
  cargurus: "CarGurus", pistonheads: "PistonHeads", aacars: "AA Cars",
  carandclassic: "Car & Classic", carwow: "Carwow",
};
const searchKinds: Record<string, string> = { cars: "Cars", motorbikes: "Motorbikes", parts: "Parts" };
const sorts: Record<string, string> = { best_match: "Best match", price_asc: "Lowest price first", price_desc: "Highest price first", newest: "Newly listed" };
const methods: Record<string, string> = { vehicle: "Vehicle details", diagram: "Picture guide", search: "Part name / number", part_number: "Part number" };
const reportKeys = ["report", "search_kind", "marketplace", "outcome", "min", "max", "year", "sort", "extras", "repair_hidden", "make", "model", "make_set", "model_set", "location_set", "part_name_set", "part_number_set", "method"];
const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const price = (value: unknown) => typeof value === "string" && /^\d{1,7}(?:\.\d{1,2})?$/.test(value) && Number(value) <= 5_000_000 ? String(Number(value)) : "";
const year = (value: unknown) => typeof value === "string" && /^(?:19|20)\d{2}$/.test(value) ? value : "";
const own = (values: Record<string, string>, key: string) => Object.hasOwn(values, key);
function knownVehicle(kind: string, make: unknown, model: unknown) {
  if (kind === "motorbikes") return { make: typeof make === "string" && make.length <= 60 ? motorbikeMakes.find(value => value.toLocaleLowerCase("en-GB") === make.trim().toLocaleLowerCase("en-GB")) : undefined, model: undefined };
  const catalogue: Record<string, readonly string[]> = makes;
  const models = vehicleModelsForMake(catalogue, typeof make === "string" && make.length <= 60 ? make : "");
  const canonicalMake = Object.keys(catalogue).find(key => catalogue[key] === models);
  const canonicalModel = typeof model === "string" && model.length <= 60 ? models.find(value => value.toLocaleLowerCase("en-GB") === model.trim().toLocaleLowerCase("en-GB")) : undefined;
  return { make: canonicalMake, model: canonicalModel };
}

/** Deliberately exclude free text, URLs, location values and vehicle identifiers. */
export function searchProblemHref(search: SubmittedSearch, outcome: SearchProblemOutcome) {
  const kind = search.mode === "parts" ? "parts" : search.vehicleType === "motorbikes" ? "motorbikes" : "cars";
  const data = search.saveItem.data;
  const criteria = search.mode === "parts" ? search.partCriteria : search.carCriteria;
  const params = new URLSearchParams({ report: "search", search_kind: kind, marketplace: own(marketplaces, search.platform) ? search.platform : "ebay", outcome });
  params.set("make_set", hasText(criteria?.make) ? "1" : "0");
  params.set("model_set", hasText(criteria?.model) ? "1" : "0");
  const vehicle = knownVehicle(kind, criteria?.make, criteria?.model);
  if (vehicle.make) params.set("make", vehicle.make);
  if (vehicle.model) params.set("model", vehicle.model);
  const selectedYear = year(data.year);
  if (selectedYear) params.set("year", selectedYear);
  if (search.mode === "parts") {
    params.set("part_name_set", hasText(search.partCriteria?.part) ? "1" : "0");
    params.set("part_number_set", hasText(search.partCriteria?.partNumber) ? "1" : "0");
    if (own(methods, search.searchMethod)) params.set("method", search.searchMethod);
  } else {
    for (const [key, value] of [["min", search.minPrice], ["max", search.maxPrice]] as const) {
      const valid = price(value);
      if (valid) params.set(key, valid);
    }
    params.set("location_set", hasText(data.postcode) ? "1" : "0");
    if (search.carSort && own(sorts, search.carSort)) params.set("sort", search.carSort);
    if (typeof search.hideUnwanted === "boolean") params.set("repair_hidden", search.hideUnwanted ? "1" : "0");
    const extras = kind === "cars" ? normalizeCarExtras(search.carExtras) : [];
    if (extras.length) params.set("extras", extras.join(","));
  }
  return `/support?${params.toString()}`;
}

/** The support URL is untrusted input: never accept a supplied title or body. */
export function parseSearchProblem(search: string): SearchProblemReport | null {
  if (search.length > 1800) return null;
  const params = new URLSearchParams(search);
  if (reportKeys.some(key => params.getAll(key).length > 1)) return null;
  const kind = params.get("search_kind") || "";
  const marketplace = params.get("marketplace") || "";
  const outcome = params.get("outcome");
  if (params.get("report") !== "search" || !own(searchKinds, kind) || !own(marketplaces, marketplace) || (outcome !== "empty" && outcome !== "unavailable")) return null;
  const lines = [
    `Search: ${searchKinds[kind]}`,
    `Results provider: eBay`,
    `Selected marketplace: ${marketplaces[marketplace]}`,
    `Result: ${outcome === "empty" ? "No matches in the checked results" : "Results could not be loaded completely"}`,
  ];
  const flag = (key: string, label: string) => {
    const value = params.get(key);
    if (value === "1" || value === "0") lines.push(`${label}: ${value === "1" ? "set" : "not set"}`);
  };
  const vehicle = knownVehicle(kind, params.get("make"), params.get("model"));
  if (vehicle.make) lines.push(`Make: ${vehicle.make}`); else flag("make_set", "Make");
  if (vehicle.model) lines.push(`Model: ${vehicle.model}`); else flag("model_set", "Model");
  const selectedYear = year(params.get("year"));
  if (selectedYear) lines.push(`Year: ${selectedYear}`);
  if (kind === "parts") {
    flag("part_name_set", "Part name");
    flag("part_number_set", "Part number");
    const method = params.get("method") || "";
    if (own(methods, method)) lines.push(`Search method: ${methods[method]}`);
  } else {
    const min = price(params.get("min")), max = price(params.get("max"));
    const pounds = (value: string) => `£${Number(value).toLocaleString("en-GB")}`;
    if (min || max) lines.push(`Budget: ${min && max ? `${pounds(min)}–${pounds(max)}` : max ? `Up to ${pounds(max)}` : `From ${pounds(min)}`}`);
    flag("location_set", "Location filter (postcode not copied)");
    const sort = params.get("sort") || "";
    if (own(sorts, sort)) lines.push(`Sort: ${sorts[sort]}`);
    const hidden = params.get("repair_hidden");
    if (hidden === "0" || hidden === "1") lines.push(`Parts, repair and deposit adverts: ${hidden === "1" ? "hidden" : "included"}`);
    const extras = kind === "cars" ? carExtraLabels(params.get("extras")) : [];
    if (extras.length) lines.push(`Requested extras: ${extras.join(", ")}`);
  }
  const details = lines.join("\n");
  return {
    subject: `${searchKinds[kind]} search problem`,
    details,
    message: `What did you expect to find?\n\nWhat happened?\n\nSearch details added by Mekivo:\n${details}`,
  };
}
