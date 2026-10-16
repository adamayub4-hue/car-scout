const comparisonValue = (value: string) => value.trim().toLocaleLowerCase("en-GB");

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
  const key = Object.keys(catalogue).find(option => comparisonValue(option) === comparisonValue(make));
  return key ? catalogue[key] : [];
}
