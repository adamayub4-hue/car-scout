/** Only legacy search links redirect; a plain campaign URL still lands on Home. */
export function legacySearchPath(params: URLSearchParams): "/cars" | "/motorbikes" | "/parts" | null {
  if (params.get("mode") === "parts") return "/parts";
  if (params.get("mode") !== "cars" && params.get("restore") !== "1" && params.get("vehicle_type") !== "motorbikes") return null;
  return params.get("vehicle_type") === "motorbikes" ? "/motorbikes" : "/cars";
}
