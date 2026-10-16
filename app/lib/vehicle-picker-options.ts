const comparisonValue = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("en-GB");
const makeAliases = new Map([["mercedes benz", "mercedes"], ["vw", "volkswagen"]]);
const makeComparisonValue = (value: string) => {
  const key = comparisonValue(value).replace(/[-\s]+/g, " ");
  return makeAliases.get(key) || key;
};

/** Suggestions are examples, not a restriction on the vehicles people can search. */
export function vehiclePickerOptions(options: readonly string[], query = ""): string[] {
  const unique = new Map<string, string>();
  for (const option of options) {
    const value = option.trim();
    if (value && !unique.has(comparisonValue(value))) unique.set(comparisonValue(value), value);
  }
  const search = comparisonValue(query);
  return Array.from(unique.values())
    .filter(option => comparisonValue(option).includes(search))
    .sort((left, right) => left.localeCompare(right, "en-GB", { numeric: true, sensitivity: "base" }));
}

export function vehiclePickerValue(options: readonly string[], value: string): string {
  const custom = value.trim();
  return options.find(option => comparisonValue(option) === comparisonValue(custom))?.trim() || custom;
}

export function vehicleModelsForMake(catalogue: Record<string, readonly string[]>, make: string): readonly string[] {
  const names = Object.keys(catalogue);
  // Keep catalogue keys and typed values intact. These are spellings of the
  // same make, not a reason to merge different marques or historical brands.
  const key = names.find(option => comparisonValue(option) === comparisonValue(make))
    ?? names.find(option => makeComparisonValue(option) === makeComparisonValue(make));
  return key ? catalogue[key] : [];
}
