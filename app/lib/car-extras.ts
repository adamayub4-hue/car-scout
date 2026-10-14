// These filters check advertised wording, not factory equipment or working
// condition. Stable IDs keep saved/shared searches independent of UI labels.
export const carExtras = [
  { id: "heated_seats", label: "Heated seats", group: "Comfort" },
  { id: "panoramic_roof", label: "Panoramic roof", group: "Comfort" },
  { id: "sunroof", label: "Sunroof", group: "Comfort" },
  { id: "leather_seats", label: "Leather seats", group: "Comfort" },
  { id: "parking_sensors", label: "Parking sensors", group: "Parking and driving" },
  { id: "reversing_camera", label: "Reversing camera", group: "Parking and driving" },
  { id: "cruise_control", label: "Cruise control", group: "Parking and driving" },
  { id: "keyless_entry", label: "Keyless entry", group: "Parking and driving" },
  { id: "sat_nav", label: "Sat nav", group: "Connectivity" },
  { id: "apple_carplay", label: "Apple CarPlay", group: "Connectivity" },
  { id: "android_auto", label: "Android Auto", group: "Connectivity" },
  { id: "bluetooth", label: "Bluetooth", group: "Connectivity" },
] as const;

export type CarExtra = (typeof carExtras)[number]["id"];
const maxInputLength = 400;
const maxInputEntries = 24;
const extraIds = new Set<string>(carExtras.map(extra => extra.id));

function extraEntries(value: unknown): unknown[] | null {
  if (typeof value === "string") return value.length <= maxInputLength ? value.split(",") : null;
  return Array.isArray(value) && value.length <= maxInputEntries ? value : null;
}

/** Tolerant restoration: discard unrecognised legacy IDs, never infer extras. */
export function normalizeCarExtras(value: unknown): CarExtra[] {
  const entries = extraEntries(value);
  if (!entries || entries.length > maxInputEntries) return [];
  const selected = new Set(entries.filter((entry): entry is string => typeof entry === "string" && entry.length <= 40).map(entry => entry.trim()));
  return carExtras.filter(extra => selected.has(extra.id)).map(extra => extra.id);
}

/** Strict requests must reject unknown IDs instead of broadening a search. */
export function carExtrasInputIsValid(value: unknown) {
  if (value === "" || (Array.isArray(value) && value.length === 0)) return true;
  const entries = extraEntries(value);
  return Boolean(entries && entries.length <= maxInputEntries && entries.every(entry => typeof entry === "string" && extraIds.has(entry.trim())));
}

export function carExtraLabels(value: unknown): string[] {
  const selected = new Set(normalizeCarExtras(value));
  return carExtras.filter(extra => selected.has(extra.id)).map(extra => extra.label);
}

// A single small keyword/OR group narrows the provider's candidate batch. The
// complete set of required extras is still checked locally, not inferred from
// provider keyword matches. Browse documents spaces as AND and (a,b) as OR.
const seedKeywords: Record<CarExtra, string> = {
  heated_seats: "(heated,heating,htd)",
  panoramic_roof: "(panoramic,panroof,pano,pan)",
  sunroof: "(sunroof,moonroof,roof)",
  leather_seats: "(leather,leathers)",
  parking_sensors: "(parking,sensors,pdc)",
  reversing_camera: "(camera,cameras,cam)",
  cruise_control: "cruise",
  keyless_entry: "keyless",
  sat_nav: "(satnav,navigation,nav)",
  apple_carplay: "(carplay,car)",
  android_auto: "android",
  bluetooth: "(bluetooth,blue)",
};

export function carExtraSeedKeywords(extra: CarExtra): string {
  return seedKeywords[extra];
}

const featurePatterns: Record<CarExtra, string> = {
  heated_seats: "(?:(?:heated|htd)(?:\\s+(?:front|rear|leather|electric|sports?)){0,3}\\s+seats?|heated\\s+seating|seat\\s+heating)",
  panoramic_roof: "(?:panoramic(?:\\s+glass)?\\s+(?:(?:sun|moon)\\s*)?roof|pan(?:o)?(?:\\s+glass)?\\s*(?:(?:sun|moon)\\s*)?roof)",
  sunroof: "(?:(?:sun|moon)\\s*roof)",
  leather_seats: "(?:leather(?:\\s+(?:front|rear|sports?)){0,2}\\s+(?:seats?|seating|upholstery)|full\\s+leather(?:\\s+(?:interior|trim))?)",
  parking_sensors: "(?:(?:parking|reversing|reverse)\\s+(?:distance\\s+)?sensors?|park\\s+distance\\s+control|pdc)",
  reversing_camera: "(?:(?:rear(?:\\s+view)?|rearview|reverse|reversing|parking|backup|back\\s+up)\\s+cam(?:era)?s?|360(?:\\s+degree)?\\s+cam(?:era)?s?)",
  cruise_control: "(?:cruise\\s+control)",
  keyless_entry: "(?:keyless\\s+(?:entry|access))",
  sat_nav: "(?:sat\\s*nav|satellite\\s+navigation|navigation\\s+system|built\\s+in\\s+navigation)",
  apple_carplay: "(?:car\\s*play)",
  android_auto: "(?:android\\s+auto)",
  bluetooth: "(?:blue\\s*tooth)",
};

function advertText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.slice(0, 10_000).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[’‘]/g, "'").replace(/[-–—]/g, " ").replace(/°/g, " degree ").replace(/\s+/g, " ");
}

const extraListEntry = new RegExp(`^(?:(?:a|an|the|any|working|factory|front|rear|electric|full|part)\\s+){0,3}(?:${Object.values(featurePatterns).join("|")})\\b`, "i");
const negativeListStart = /\b(?:(?:does|do)\s+not\s+(?:have|come\s+with)|(?:doesn't|don't)\s+(?:have|come\s+with)|not\s+(?:fitted|equipped)\s+with|no|not|without|lacks?|lacking)\s+/gi;

function isInAbsentExtraList(text: string, feature: string) {
  // Recognise only a bounded list of known extras after explicit absence. Stop
  // at words such as "but", "with" or "has", rather than applying a negative
  // to the remainder of the sentence or to a separate positive equipment list.
  const selectedFeature = new RegExp(feature, "i");
  for (const marker of text.matchAll(negativeListStart)) {
    let position = marker.index! + marker[0].length;
    for (let count = 0; count < carExtras.length; count++) {
      const entry = extraListEntry.exec(text.slice(position));
      if (!entry) break;
      if (selectedFeature.test(entry[0])) return true;
      position += entry[0].length;
      const connector = /^\s*(?:,\s*(?:(?:and|or)\s+)?|(?:and|or)\s+)/i.exec(text.slice(position));
      if (!connector) break;
      position += connector[0].length;
    }
  }
  return false;
}

function mentionsExtra(text: string, pattern: string) {
  const feature = `\\b${pattern}\\b`;
  if (!new RegExp(feature, "i").test(text)) return { positive: false, negative: false };
  // Check only adjacent wording. A separate "no sat nav" must not negate an
  // advertised heated-seat phrase elsewhere in the same equipment list.
  const negativeBefore = new RegExp(`\\b(?:no|not|without|lacks?|lacking|(?:not|non)\\s+working|broken|faulty|inoperative|not\\s+(?:with|fitted(?:\\s+with)?|equipped(?:\\s+with)?)|(?:does|do)\\s+not\\s+(?:have|come\\s+with)|(?:doesn't|don't)\\s+(?:have|come\\s+with)|optional|retrofit(?:\\s+kit)?|prepared\\s+for|wired\\s+for)(?:\\s+(?:a|an|the|any|working|factory|front|rear|electric|full|part)){0,3}\\s+${feature}`, "i");
  const negativeAfter = new RegExp(`${feature}\\s+(?:(?:is|are|has|have|been|currently)\\s+){0,3}(?:not\\s+(?:fitted|installed|included|available|working|functional)|(?:isn't|aren't|wasn't|weren't)\\s+(?:fitted|included|available|working|functional)|removed|deleted|broken|faulty|inoperative|disabled|(?:does|do)\\s+not\\s+work|don't\\s+work|doesn't\\s+work|needs?\\s+repair|optional|retrofit(?:\\s+kit)?|available\\s+(?:as|for|at)|can\\s+(?:also\\s+)?be\\s+(?:fitted|added|installed|retrofitted)|if\\s+required)\\b`, "i");
  return { positive: true, negative: negativeBefore.test(text) || negativeAfter.test(text) || isInAbsentExtraList(text, feature) };
}

/** Require ALL selected extras in advertised title/returned summary wording. */
export function matchesCarExtras(item: { title: string; shortDescription?: string | null }, value: unknown) {
  const selected = normalizeCarExtras(value);
  if (!selected.length) return true;
  const texts = [advertText(item.title), advertText(item.shortDescription)];
  return selected.every(extra => {
    const evidence = texts.map(text => mentionsExtra(text, featurePatterns[extra]));
    return evidence.some(match => match.positive) && !evidence.some(match => match.negative);
  });
}
