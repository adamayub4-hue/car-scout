import type { CarSort } from "./search";

export type SavedSearchItem = {
  kind: "car_search" | "part_search" | "vehicle";
  title: string;
  data: Record<string, unknown>;
};

const platforms = ["all", "more", "autotrader", "facebook", "ebay", "motors", "gumtree", "cargurus", "pistonheads", "aacars", "carandclassic"];
const text = (value: unknown, max = 80) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : "";
const carSorts = ["best_match", "price_asc", "price_desc", "newest"];

export function parseSavedSearchParams(params: URLSearchParams) {
  if (params.get("restore") !== "1") return null;
  const mode = params.get("mode") === "parts" ? "parts" as const : "cars" as const;
  const motorbike = mode === "cars" && params.get("vehicle_type") === "motorbikes";
  const direct = mode === "parts" && params.get("search_method") === "part_number";
  const vehicle = (key: string) => direct ? "" : text(params.get(key));
  const platform = text(params.get("platform"));
  const method = text(params.get("part_method"));
  const rawMinimum = text(params.get("min_price"), 10);
  const sort = text(params.get("sort"));
  const hideUnwanted = params.get("hide_unwanted");
  return {
    mode, ...(motorbike ? { vehicleType: "motorbikes" as const } : {}), make: vehicle("make"), model: vehicle("model"), year: /^\d{4}$/.test(vehicle("year")) ? vehicle("year") : "",
    price: text(params.get("price"), 10).replace(/[^0-9]/g, ""), postcode: text(params.get("postcode"), 10),
    minPrice: mode === "cars" && /^\d{1,8}$/.test(rawMinimum) ? rawMinimum : undefined,
    sort: mode === "cars" && carSorts.includes(sort) ? sort as CarSort : undefined,
    hideUnwanted: mode === "cars" && (hideUnwanted === "1" || hideUnwanted === "0") ? hideUnwanted === "1" : undefined,
    platform: motorbike ? "ebay" : platforms.includes(platform) ? platform : "all",
    engine: vehicle("engine"), fuel: vehicle("fuel"), bodyStyle: vehicle("body_style"),
    part: direct ? "" : text(params.get("part")), partCategory: direct ? "" : text(params.get("category")),
    partNumber: text(params.get("part_number")),
    partMethod: (direct ? "search" : method === "diagram" || method === "catalogue" ? method : "search") as "search" | "diagram" | "catalogue",
    searchMethod: direct ? "part_number" as const : "vehicle" as const,
  };
}

export function getSavedSearchUrl(item: SavedSearchItem) {
  const data = item.data && typeof item.data === "object" ? item.data : {};
  const mode = item.kind === "car_search" ? "cars" : "parts";
  const direct = data.searchMethod === "part_number" || (Boolean(data.partNumber) && !data.make && !data.model && !data.year);
  const params = new URLSearchParams({ restore: "1", mode });
  if (mode === "cars" && data.vehicleType === "motorbikes") params.set("vehicle_type", "motorbikes");
  const fields: Record<string, unknown> = { make: data.make, model: data.model, year: data.year, price: data.price, min_price: data.minPrice, sort: data.sort, hide_unwanted: typeof data.hideUnwanted === "boolean" ? data.hideUnwanted ? "1" : "0" : undefined, postcode: data.postcode, platform: data.platform, engine: data.engine, fuel: data.fuel, body_style: data.bodyStyle, part: data.part, category: data.partCategory, part_number: data.partNumber, part_method: data.partMethod, search_method: direct ? "part_number" : "vehicle" };
  for (const [key, value] of Object.entries(fields)) if (text(value)) params.set(key, text(value));
  const clean = parseSavedSearchParams(params)!;
  const safe = new URLSearchParams({ restore: "1", mode: clean.mode });
  if (clean.vehicleType === "motorbikes") safe.set("vehicle_type", "motorbikes");
  const values = { make: clean.make, model: clean.model, year: clean.year, price: clean.mode === "cars" ? clean.price : "", min_price: clean.minPrice, sort: clean.sort, hide_unwanted: clean.hideUnwanted === undefined ? "" : clean.hideUnwanted ? "1" : "0", postcode: clean.mode === "cars" ? clean.postcode : "", platform: clean.mode === "cars" ? clean.platform : "", engine: clean.engine, fuel: clean.fuel, body_style: clean.bodyStyle, part: clean.part, category: clean.partCategory, part_number: clean.partNumber, part_method: clean.mode === "parts" ? clean.partMethod : "", search_method: clean.mode === "parts" ? clean.searchMethod : "" };
  for (const [key, value] of Object.entries(values)) if (value) safe.set(key, value);
  return `/?${safe}`;
}

export function getSharedSearchUrl(item: SavedSearchItem) {
  // Build from catalogue criteria, never the current URL or saved-item metadata.
  const keys = item.kind === "car_search"
    ? ["vehicleType", "make", "model", "year", "price", "minPrice", "sort", "hideUnwanted", "platform"]
    : ["make", "model", "year", "engine", "fuel", "bodyStyle", "part", "partCategory", "partNumber", "partMethod", "searchMethod"];
  const data: Record<string, unknown> = {};
  for (const key of keys) {
    const value = item.data?.[key];
    // Free-text catalogue fields must not turn into a route for personal data.
    if (typeof value === "string") {
      const clean = text(value);
      if (/@|https?:\/\/|\b(?:password|access_token|refresh_token|api[_ -]?key|bearer|sk-proj-)\b/i.test(clean)
        || /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(clean)
        || /\b[A-Z]{2}\d{2}\s?[A-Z]{3}\b/i.test(clean)
        || /\b[A-HJ-NPR-Z0-9]{17}\b/i.test(clean)) continue;
      data[key] = clean;
    } else if (key === "hideUnwanted" && typeof value === "boolean") data[key] = value;
  }
  return getSavedSearchUrl({ kind: item.kind, title: "Shared search", data });
}

export function safeSearchReturnUrl(value: string | null) {
  if (!value || !value.startsWith("/?") || value.startsWith("//")) return null;
  try {
    const url = new URL(value, "https://mekivo.uk");
    if (url.origin !== "https://mekivo.uk" || url.pathname !== "/") return null;
    const restored = parseSavedSearchParams(url.searchParams);
    if (!restored) return null;
    return getSavedSearchUrl({ kind: restored.mode === "cars" ? "car_search" : "part_search", title: "Saved search", data: restored });
  } catch { return null; }
}

export async function withRequestDeadline<T>(request: PromiseLike<T>, milliseconds = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(request), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Request timed out")), milliseconds); })]);
  } finally { if (timer) clearTimeout(timer); }
}
