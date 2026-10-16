import type { CarSort, EbayListing, VehicleType } from "./search";
import { matchesCarExtras, type CarExtra } from "./car-extras";

// Title checks are deliberately conservative; they are not a vehicle inspection
// or a guarantee of the seller's full cash price, history or availability.
const EXCLUDED_OFFER = /\b(?:deposit|down\s*payment|pcm|p\s*\/\s*m|(?:per|a|each)\s+(?:calendar\s+)?month|monthly|weekly|(?:per|a|each)\s+week|lease|leasing|finance\s+(?:only|from|deal|offer)|instalments?|installments?|spares?|repairs?|salvage|breaking|breakers?|dismantling|scrap|damaged|non[ -]?runner|not\s+running|does\s+not\s+start|won'?t\s+start|project\s+car|restoration\s+project|write[ -]?off|category[\s-]*[abcdnsu]|cat[\s-]*[abcdnsu]|mot\s+fail(?:ure)?|no\s+mot|mot\s+expired)\b|\b\d+(?:\.\d+)?\s*pm\b/i;
const EXCLUDED_PART = /\b(?:parts?|accessories|bumper|bonnet|tailgate|headlights?|tail\s*lights?|wing\s+mirror|door\s+mirror|brake\s+(?:pads?|discs?|calipers?)|oil\s+filter|air\s+filter|spark\s+plugs?|injectors?|turbocharger|alternator|starter\s+motor|ecu|wiring\s+loom|key\s+fob|roof\s+rack|seat\s+covers?|floor\s+mats?|owners?\s+manual|workshop\s+manual|scale\s+model|diecast|die\s+cast|toy\s+car|shell\s+only)\b|\b(?:engine|gearbox|clutch|wheels?|doors?|seats?)\s+(?:only|for|assembly|unit|replacement|removed|tested|bare|complete)\b|\b1\s*[:/]\s*\d{1,3}\s*(?:scale|model)\b/i;
const EXCLUDED_CONDITION = /\b(?:parts?|not\s+working|damaged|salvage|repair)\b/i;
// Misclassified components can appear in the cars category. Match specific
// component names rather than "sensor" anywhere: parking sensors, for example,
// are normal car equipment. These checks still cannot identify every bad advert.
const EXCLUDED_COMPONENT = /\b(?:(?:temperature|coolant|crankshaft|camshaft|oxygen|lambda|nox|abs|map|maf|oil\s+pressure|fuel\s+pressure|tyre\s+pressure)\s+sensors?|(?:engine|gearbox|transmission|airbag|abs|body|comfort|electronic)\s+(?:control\s+)?(?:units?|modules?)|control\s+modules?|headrest|(?:front|rear|left|right)[\s-]+(?:left[\s-]+|right[\s-]+)*headrests?|suspension\s+struts?|shock\s+absorbers?|radiators?|intercoolers?|steering\s+racks?|wishbones?|drive\s*shafts?)\b/i;
const COMPONENT_AT_START = /^(?:(?:genuine|oem|new|used|bosch|denso|delphi|continental)[\s-]+)*(?:sensors?|modules?)\b/i;
const REGISTRATION_AT_START = /^(?:(?:private|cherished|personalised|personalized|dateless|dvla)[\s-]+)*(?:(?:number|registration)[\s-]*plates?|(?:private|cherished|personalised|personalized)[\s-]+(?:plate|registration)|registration[\s-]+(?:number|transfer))\b/i;
const EXCLUDED_SWAP = /\b(?:swaps?|exchange)\s+only\b|\bonly\s+(?:swaps?|exchange)\b|\bpart[\s-]+exchange\s+only\b/i;
const EXCLUDED_SMALL_COMPONENT = /\b(?:(?:petrol|fuel|diesel)\s+(?:filler\s+)?cap|battery\s+conditioner|(?:lower|upper)\s+grill(?:e)?|(?:full\s+black|interior\s+trim)\s+(?:trims?|set)|rolling\s+shell)\b/i;
const WHEEL_SET_AT_START = /^(?:set\s+of\s+)?[234](?:\s*x)?\s+.*\b(?:alloy|steel)\s+wheels?\b/i;
// These titles name a component as the item being sold. Preserve clear full-car
// descriptions of fitted equipment or completed maintenance.
const COMPONENT_AS_PRODUCT = /\b(?:gearbox\s*$|gear[\s-]+box\s+(?:quattro\s+)?(?:\d+\s*speed\s+)?(?:automatic|manual)\b|engine\s*(?:£\s*\d[\d,]*(?:\.\d{1,2})?)?\s*$|(?:manifold\s+to\s+cat|exhaust)\s+pipe\b|rear\s+spoiler\b|boot\s*lid\b|dpf\b|diesel\s+particulate\s+filter\b)/i;
const FULL_CAR_CONTEXT = /\b(?:mot|mileage|\d[\d,]*\s+miles|fsh|full\s+service\s+history|drives?|runs?|owners?|v5c|logbook|(?:gear[\s-]*box|exhaust|spoiler|engine|dpf|boot\s*lid|diesel\s+particulate\s+filter)\s+(?:replaced|fitted|included|repaired|rebuilt|reconditioned)|(?:new|replaced|replacement|rebuilt|reconditioned)\s+(?:gear[\s-]*box|engine|dpf|boot\s*lid|diesel\s+particulate\s+filter))\b/i;
const GEARBOX_SPECIFICATION = /\b(?:automatic|manual)\s+gear[\s-]*box\s*$/i;
// An engine advertised on its own can still say it runs or was tested. That is
// component condition, rather than evidence that a complete car is being sold.
const BARE_ENGINE_AS_PRODUCT = /\bbare\s+engine\b|^(?:(?:genuine|oem|new|used)[\s-]+)*engine\s+for\b/i;
const MOTORCYCLE_AS_PRODUCT = /\b(?:motorcycles?|motorbikes?|scooters?|mopeds?)\b/i;
const COMPLETED_BARE_ENGINE_WORK = /\bbare\s+engine\s+(?:replaced|fitted|rebuilt|repaired|reconditioned)\b/i;
const COMPLETE_CAR_EVIDENCE = /\b(?:mot|mileage|\d[\d,]*\s+miles|fsh|full\s+service\s+history|v5c|logbook)\b/i;
// More component products have appeared in the provider's cars category. Use
// specific item names and product wording, never their low price as evidence.
// A complete-car title can mention the same equipment or completed work.
const carComponentProductPattern = "mirror[\\s-]+(?:blinkers?|indicators?)|(?:v[\\s-]*ribbed|serpentine|auxiliary|timing|cam)[\\s-]+belts?|steering[\\s-]+wheel\\s*(?:&|and)?\\s*airbags?|(?:(?:inner|outer)[\\s-]+)?door[\\s-]+handle[\\s-]+brackets?|(?:radio[\\s-]+stereo[\\s-]+)?head[\\s-]+units?|heat[\\s-]+shields?|(?:windscreen[\\s-]+)?wiper[\\s-]+motors?|(?:front|rear)[\\s-]+suspension[\\s-]+kits?|(?:clutch|clutck)[\\s-]+kits?|(?:passenger|driver|front|rear)[\\s-]+doors?|convertible[\\s-]+roofs?|hydraulic[\\s-]+motor[\\s-]+for[\\s-]+(?:power[\\s-]+)?(?:trunk|boot)|gher[\\s-]+box";
const CAR_COMPONENT_PRODUCT = new RegExp(`\\b(?:${carComponentProductPattern})\\b`, "i");
const CAR_COMPONENT_AT_START = new RegExp(`^(?:(?:brand|new|used|genuine|oem|front|rear|left|right)[\\s-]+)*(?:${carComponentProductPattern})\\b`, "i");
const CAR_COMPONENT_FITTED = new RegExp(`\\b(?:with|includes?|including|replaced|fitted|rebuilt|reconditioned)\\s+(?:(?:[a-z-]+|\\d+)\\s+){0,3}(?:${carComponentProductPattern})\\b|\\b(?:${carComponentProductPattern})\\s+(?:fitted|included|replaced|repaired|rebuilt|reconditioned)\\b`, "i");
const NEW_CAR_COMPONENT = new RegExp(`\\bnew\\s+(?:${carComponentProductPattern})\\b`, "i");
// A wheel advert needs a size/product signal: "silver alloys" on an otherwise
// sparse car title is normal equipment. "Allows" is an observed alloy typo.
const WHEEL_SIZE_PRODUCT = /\b(?:alloys?|alloy\s+wheels?|allows)\b.*\br\s*\d{2}\b|\b(?:alloys?|alloy\s+wheels?)\b.*\b\d{3}\s*\/\s*\d{2}\s*\/\s*\d{2}\b/i;
const WHEEL_FITTED_EQUIPMENT = /\b(?:with|includes?|including)\s+(?:(?:[a-z-]+|r?\d+)\s+){0,3}(?:alloys?|alloy\s+wheels?)\b|\b(?:alloys?|alloy\s+wheels?)\s+(?:r\s*\d{2}\s+)?(?:fitted|included)\b/i;
const BMW_ALLOY_CODE_ONLY = /^bmw\s+(?:\d\s*){7}\s+alloy\s*$/i;
const TYRES_AVAILABLE_PRODUCT = /\b(?:tyres?|tires?)\s*[.!,:-]?\s*\d+\s+available\b/i;
const MULTI_CHASSIS_AIRBAG_PRODUCT = /(?:\b[a-z]\d{2}\b[\s,/&-]*){2,}.*\bcomplete\s+with\s+airbag\b/i;

function isAdditionalUnwantedCarTitle(title: string) {
  if (BMW_ALLOY_CODE_ONLY.test(title.trim()) || MULTI_CHASSIS_AIRBAG_PRODUCT.test(title) || /^crashed\b/i.test(title.trim())) return true;
  if (!CAR_COMPONENT_PRODUCT.test(title) && !WHEEL_SIZE_PRODUCT.test(title) && !TYRES_AVAILABLE_PRODUCT.test(title)) return false;
  // A product-leading title can describe a tested component that runs, or name
  // the donor car's owner. That is not whole-car context for the item being sold.
  if (CAR_COMPONENT_AT_START.test(title.trim())) return true;
  // "Ford Fiesta new timing belt" describes maintenance; "New timing belt for
  // Ford Fiesta" starts with a product. A year alone is compatibility, not a car.
  const newComponent = title.match(NEW_CAR_COMPONENT);
  const subject = normalizedCarText(title.slice(0, newComponent?.index ?? 0)).replace(/^(?:\d{2,4}\s+)+/, "");
  const carWithNewComponent = Boolean(newComponent && namedCarMakes.some(make => subject === make || subject.startsWith(`${make} `)));
  return !FULL_CAR_CONTEXT.test(title) && !CAR_COMPONENT_FITTED.test(title) && !WHEEL_FITTED_EQUIPMENT.test(title) && !carWithNewComponent;
}
// BMW component adverts sometimes contain only the brand and a seven-character
// mixed part code. Require that entire sparse title; badges and car descriptions
// must not be caught by a general alphanumeric-code heuristic.
const BMW_COMPONENT_CODE_ONLY = /^bmw\s+(?![1-8]series$)(?=[a-z0-9]{7}$)(?=[a-z0-9]*[a-z])(?=[a-z0-9]*\d)[a-z0-9]{7}$/i;
const bikeMakes = ["royal enfield", "harley davidson", "harley", "honda", "yamaha", "suzuki", "kawasaki", "triumph", "bmw", "ducati", "ktm", "aprilia", "lexmoto", "vespa", "piaggio", "lambretta", "benelli", "bsa", "norton", "husqvarna", "kymco", "sym", "keeway", "moto guzzi"];
const compactBikeMake = new RegExp(`\\b(?:${bikeMakes.join("|")})(?=[a-z0-9])`, "gi");
const EXCLUDED_BIKE_PRODUCT = /\b(?:project\s+(?:bike|motorbike|motorcycle)|mobility\s+scooter|kick\s+scooter|e[ -]?scooter|bicycle|push\s*bike|pedal\s+bike|toy\s+(?:bike|motorcycle)|balance\s+bike)\b|^(?:(?:new|used|genuine|oem|motorcycle|motorbike|bike)[\s-]+)*(?:helmets?|gloves?|jackets?|boots?|fairings?|sprockets?|chains?|sidecars?|exhausts?|fuel\s+tanks?|engines?|frames?)\b|\b(?:fairings?|sprockets?|chains?|sidecars?|exhausts?|fuel\s+tanks?|engines?|frames?)\s+(?:only|for|replacement|removed|bare|assembly)\b/i;
// Rider gear and bolt-on equipment also leak into the motorcycle category.
// A bike make or MOT in an accessory's compatibility text does not make it a
// whole bike; preserve these names only in explicit fitted/included context.
const bikeAccessoryPattern = "masks?|helmets?|gloves?|jackets?|boots?|goggles?|visors?|neck[\\s-]+warmers?|grab[\\s-]*(?:bars?|rails?|handles?)|handle[\\s-]*rails?|foot[\\s-]*(?:boards?|pegs?|rests?)|sissy[\\s-]*bars?|panniers?|saddle[\\s-]*bags?|luggage[\\s-]+racks?|side[\\s-]*(?:panels?|covers?)";
const BIKE_ACCESSORY_NAME = new RegExp(`\\b(?:${bikeAccessoryPattern})\\b`, "i");
const BIKE_ACCESSORY_AT_START = new RegExp(`^(?:(?:new|used|genuine|oem|motorcycles?|motorbikes?|bike|rider|full|face|black|chrome|front|rear|passenger|pillion)[\\s-]+)*(?:${bikeAccessoryPattern})\\b`, "i");
const bikeComponentPattern = `gps|sat[\\s-]*nav|satellite[\\s-]+navigation|navigators?|air[\\s-]*box(?:es)?|top[\\s-]*box(?:es)?|chargers?|fuel[\\s-]*x|apes|ape[\\s-]+hangers?|handlebars?|(?:(?:heated|front|rear|pillion)[\\s-]+)+seats?|fairings?|sprockets?|chains?|sidecars?|exhausts?|exhuasts?|fuel[\\s-]+tanks?|engines?|frames?|${bikeAccessoryPattern}`;
const BIKE_COMPONENT_NAME = new RegExp(`\\b(?:${bikeComponentPattern})\\b`, "i");
const BIKE_FITTED_EQUIPMENT = new RegExp(`\\b(?:with|includes?|including|replaced|rebuilt|reconditioned)\\s+(?:(?:[a-z-]+|\\d+)\\s+){0,4}(?:${bikeComponentPattern})\\b|\\b(?:${bikeComponentPattern})\\s+(?:fitted|included|replaced|rebuilt|reconditioned)\\b`, "i");
const CLEAR_CAR_IN_BIKE_CATEGORY = /\b(?:honda\s+(?:jazz|civic|accord|cr[\s-]*v|hr[\s-]*v)|suzuki\s+(?:swift|ignis|alto|jimny|vitara|sx[\s-]*4)|bmw\s+(?:[135]\s*series|[1357]\d{2}(?:i|d|e|ci|cd|ti|tds)|x[1-7]))\b/i;
// This mode searches motorcycles and scooters; explicit quad/ATV adverts are
// a different vehicle kind, regardless of engine size or advertised condition.
const OTHER_BIKE_VEHICLE_KIND = /\b(?:quad[\s-]*bikes?|atvs?)\b/i;

function isUnclearOrComponentBikeTitle(title: string) {
  if (/\bproject\b/i.test(title) || CLEAR_CAR_IN_BIKE_CATEGORY.test(title) || OTHER_BIKE_VEHICLE_KIND.test(title)) return true;
  if (/^(?:please\s+)?(?:(?:check|see|view)\s+(?:the\s+)?(?:photos|pictures)|for\s+sale|new\s+listing|item|vehicle)\s*[.!]*$/i.test(title.trim())) return true;
  const text = normalizedBikeText(title);
  // The provider's category also contains unrelated goods. A make/year alone
  // describes component compatibility; require whole-bike evidence or an
  // explicit fitted-equipment phrase. Do not whitelist makes for other titles.
  const bikeEvidence = bikeMakes.some(make => containsCarPhrase(text, make)) ||
    /\b(?:motorcycles?|motorbikes?|scooters?|mopeds?|pit\s*bikes?|dirt\s*bikes?|\d+\s*cc|vfr\s*\d+)\b/i.test(text);
  // "Brand new" is normal component-advert wording, not evidence of fitting.
  const equipmentTitle = title.replace(/\bbrand[\s-]+new\b/gi, "");
  if (BIKE_ACCESSORY_NAME.test(title) && (BIKE_ACCESSORY_AT_START.test(equipmentTitle.trim()) || !(bikeEvidence && BIKE_FITTED_EQUIPMENT.test(equipmentTitle)))) return true;
  if (BIKE_COMPONENT_NAME.test(title) && !(bikeEvidence && (COMPLETE_CAR_EVIDENCE.test(title) || BIKE_FITTED_EQUIPMENT.test(equipmentTitle)))) return true;
  return false;
}

function normalizedBikeText(value: string) {
  const names = value.replace(/\broyal[\s-]*enfield/gi, "Royal Enfield")
    .replace(/\bmoto[\s-]*guzzi/gi, "Moto Guzzi")
    .replace(/\bharley[\s-]*davidson/gi, "Harley Davidson");
  return normalizedCarText(names.replace(compactBikeMake, "$& "));
}

export function matchesMotorbikeCriteria(title: string, criteria: { make?: string; model?: string } = {}) {
  const text = normalizedBikeText(title), make = normalizedBikeText(criteria.make || ""), model = normalizedBikeText(criteria.model || "");
  const names = ["harley", "harley davidson"].includes(make) ? ["harley", "harley davidson"] : [make];
  if (make && !names.some(name => containsCarPhrase(text, name))) return false;
  const subject = text.replace(/^(?:\d{2,4}\s+)+/, "");
  const leadingMake = bikeMakes.find(name => subject === name || subject.startsWith(`${name} `));
  if (make && leadingMake && !names.includes(leadingMake)) return false;
  return !model || containsCarPhrase(text, model);
}

function normalizedCarText(value: string) {
  const compoundNames = value.replace(compactCompoundMakePrefix, (name, offset, source: string) => {
    const next = source[offset + name.length];
    if (next && /[a-z]/.test(next)) return name;
    return `${compoundCarMakes[name.toLowerCase()]}${next && /[A-Z0-9]/.test(next) ? " " : ""}`;
  });
  const separated = compoundNames.replace(compactMakePrefix, (name, offset, source: string) => {
    const next = source[offset + name.length];
    return next === next.toUpperCase() || name.toLowerCase() === "vw" ? `${name} ` : name;
  }).replace(/\b(golf)(plus)\b/gi, "$1 $2");
  return separated.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/([a-z])([0-9])/g, "$1 $2").replace(/([0-9])([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function containsCarPhrase(title: string, phrase: string) {
  return (` ${title} `).includes(` ${phrase} `);
}

const makeAliases: Record<string, string[]> = {
  volkswagen: ["volkswagen", "vw"], vw: ["volkswagen", "vw"],
  mercedes: ["mercedes", "mercedes benz"], "mercedes benz": ["mercedes", "mercedes benz"],
  "land rover": ["land rover", "range rover"],
};
// Recognise the expanded catalogue at the start of an advert, so another
// make's keyword tail cannot turn it into a matching car. These are recognition
// names, not an allowlist: an unfamiliar explicitly entered make still works.
const namedCarMakes = ["mercedes benz", "aston martin", "lamborghini", "range rover", "rolls royce", "alfa romeo", "land rover", "mitsubishi", "volkswagen", "chevrolet", "leapmotor", "ssangyong", "westfield", "cadillac", "caterham", "chrysler", "daihatsu", "infiniti", "maserati", "mercedes", "polestar", "vauxhall", "bentley", "citroen", "daimler", "ferrari", "genesis", "ginetta", "hyundai", "mclaren", "peugeot", "pontiac", "porsche", "renault", "triumph", "abarth", "alpine", "austin", "daewoo", "datsun", "hummer", "jaecoo", "jaguar", "jensen", "lancia", "morgan", "morris", "nissan", "proton", "subaru", "suzuki", "toyota", "cupra", "dacia", "dodge", "haval", "honda", "ineos", "isuzu", "lexus", "lotus", "maxus", "mazda", "noble", "omoda", "rover", "skoda", "smart", "tesla", "volvo", "audi", "fiat", "ford", "jeep", "mini", "saab", "seat", "bmw", "byd", "gwm", "kgm", "kia", "ora", "tvr", "ac", "ds", "mg", "vw"];
const compoundCarMakes: Record<string, string> = Object.fromEntries(namedCarMakes.filter(name => name.includes(" ")).map(name => [name.replaceAll(" ", ""), name]));
const compactCompoundMakePrefix = new RegExp(`\\b(?:${Object.keys(compoundCarMakes).join("|")})`, "gi");
// AC is a real make, but splitting it from uppercase ACCORD corrupts Honda's
// model name. Only recognise AC when it is already a separate word.
const compactMakePrefix = new RegExp(`\\b(?:${namedCarMakes.filter(name => name !== "ac").join("|")})(?=[a-z])`, "gi");

// Explicit submitted criteria are separate from free-text q. Missing make/model
// means a broad search; title matching cannot verify the seller's vehicle data.
export function matchesCarCriteria(title: string, criteria: { make?: string; model?: string } = {}) {
  const text = normalizedCarText(title);
  const make = normalizedCarText(criteria.make || "");
  const model = normalizedCarText(criteria.model || "");
  let modelSubject = text;
  if (make) {
    // The catalogue labels these specific models as GWM ORA/Haval. Accept
    // their model-brand wording without equating every model across makes.
    const gwmModelBrand = make === "gwm" ? model.match(/^(ora|haval) /)?.[1] : undefined;
    const names = gwmModelBrand ? ["gwm", gwmModelBrand] : Object.hasOwn(makeAliases, make) ? makeAliases[make] : [make];
    if (!names.some(name => containsCarPhrase(text, name))) return false;
    // Keyword tails such as "Audi A3 ... VW Golf Polo" do not change a clear
    // make at the start of the advert. Avoid guessing when no make leads it.
    const subject = text.replace(/^(?:\d{2,4}\s+)+/, "");
    const leadingMake = namedCarMakes.find(name => subject === name || subject.startsWith(`${name} `));
    if (leadingMake && !names.includes(leadingMake)) return false;
    if (leadingMake) modelSubject = subject.slice(leadingMake.length).trim();
    else modelSubject = text.replace(new RegExp(`^.*?\\b${make === "mercedes benz" ? "mercedes(?: benz)?" : make} `), "");
    const leadingModelBrand = modelSubject.match(/^(ora|haval) /)?.[1];
    if (gwmModelBrand && leadingModelBrand && leadingModelBrand !== gwmModelBrand) return false;
    if (model && names.includes("volkswagen") && leadingMake) {
      const leadingModel = subject.slice(leadingMake.length).trim().match(/^(polo|golf|passat|tiguan)\b/)?.[1];
      if (leadingModel && model !== leadingModel && !model.startsWith(`${leadingModel} `)) return false;
    }
  }
  const bmwSeries = make === "bmw" ? model.match(/^([1-8]) series$/)?.[1] : undefined;
  if (bmwSeries) {
    // Chassis, year, trim and transmission can precede the badge. Strip only
    // recognised prefixes, rather than scanning arbitrary keyword tails.
    modelSubject = modelSubject.replace(/^(?:(?:(?:19|20)\d{2}|[efg] \d{2})(?: lci)? |(?:m sport|automatic|manual|auto|x ?drive) )+/, "");
    const leadingSeries = modelSubject.match(/^(?:m )?([1-8])(?: series\b|\d{2}\s*(?:i|d|e|ci|cd|ti|tds)\b)/)?.[1];
    if (leadingSeries && leadingSeries !== bmwSeries) return false;
    if (/^(?:x|z|i) \d\b/.test(modelSubject)) return false;
  }
  const mercedesClass = ["mercedes", "mercedes benz"].includes(make) ? model.match(/^([abcegrsv]) class$/)?.[1] : undefined;
  if (mercedesClass) {
    modelSubject = modelSubject.replace(/^amg /, "");
    const leadingClass = modelSubject.match(/^([a-z]{1,3})(?: class\b| \d{2,3}\b)/)?.[1];
    if (leadingClass && leadingClass !== mercedesClass) return false;
  }
  if (!model || containsCarPhrase(text, model)) return true;
  const modelSeparators: Record<string, Record<string, string>> = {
    audi: { "rs q 3": "rsq 3", "rsq 3": "rs q 3" },
    toyota: { "c hr": "chr", chr: "c hr" },
    honda: { "cr v": "crv", crv: "cr v" },
  };
  const separatorAlias = Object.hasOwn(modelSeparators, make) && Object.hasOwn(modelSeparators[make], model) ? modelSeparators[make][model] : undefined;
  // These particular names appear both joined and separated in adverts. Keep
  // whole-token boundaries and require them to name the vehicle, not a tail.
  if (separatorAlias && (modelSubject === separatorAlias || modelSubject.startsWith(`${separatorAlias} `))) return true;
  // Advertisers commonly use badges such as 420d/C220d instead of the series
  // or Class label. Match the vehicle subject, never another model in a tail.
  return Boolean((bmwSeries && new RegExp(`^(?:m\\s+)?${bmwSeries}\\d{2}\\s*(?:i|d|e|ci|cd|ti|tds)\\b`).test(modelSubject))
    || (mercedesClass && new RegExp(`^${mercedesClass} \\d{2,3}\\b`).test(modelSubject)));
}

export function carPriceInPence(value: string | undefined | null) {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [pounds, pence = ""] = value.trim().split(".");
  const amount = Number(pounds) * 100 + Number(pence.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function hasCarPurchasePrice(item: EbayListing) {
  return Array.isArray(item.buyingOptions) &&
    (item.buyingOptions.includes("FIXED_PRICE") || item.buyingOptions.includes("CLASSIFIED_AD"));
}

export function isUnwantedCarListing(item: EbayListing, vehicleType: VehicleType = "cars") {
  // Dealer finance availability and part exchange are normal full-car wording.
  const rawTitle = item.title.replace(/([a-z])([A-Z])/g, "$1 $2");
  const title = rawTitle.replace(/\bpart[\s-]+exchange\b/gi, "");
  // A mobility-scooter hoist/carrier is fitted car equipment, not a scooter ad.
  const vehicleTitle = rawTitle
    .replace(/\bmobility[\s-]+scooter[\s-]+(?:hoist|carrier|ramp|lift)\b/gi, "")
    .replace(/\b(?:motorcycles?|motorbikes?|scooters?|mopeds?)\s+part[\s-]+exchange\s+(?:welcome|considered)\b|\bpart[\s-]+exchange\s+(?:motorcycles?|motorbikes?|scooters?|mopeds?)\s+(?:welcome|considered)\b/gi, "");
  const completedBareEngineWork = COMPLETED_BARE_ENGINE_WORK.test(title) && COMPLETE_CAR_EVIDENCE.test(title);
  // A year followed by an ordinary transmission specification can describe a
  // whole car. Keep that ambiguous case rather than treating every gearbox
  // mention as a component; explicit product wording runs the other way round.
  const gearboxSpecification = GEARBOX_SPECIFICATION.test(title) && /\b(?:19|20)\d{2}\b/.test(title);
  return EXCLUDED_SWAP.test(rawTitle) || EXCLUDED_SMALL_COMPONENT.test(title) || WHEEL_SET_AT_START.test(title.trim()) ||
    (vehicleType === "motorbikes" && isUnclearOrComponentBikeTitle(title)) ||
    (vehicleType !== "motorbikes" && (BMW_COMPONENT_CODE_ONLY.test(title.trim()) || isAdditionalUnwantedCarTitle(title))) ||
    (BARE_ENGINE_AS_PRODUCT.test(title.trim()) && !completedBareEngineWork) ||
    EXCLUDED_BIKE_PRODUCT.test(vehicleType === "motorbikes" ? title.trim() : vehicleTitle.trim()) || (vehicleType !== "motorbikes" && MOTORCYCLE_AS_PRODUCT.test(vehicleTitle)) ||
    (COMPONENT_AS_PRODUCT.test(title) && !FULL_CAR_CONTEXT.test(title) && !gearboxSpecification) ||
    EXCLUDED_OFFER.test(title) || EXCLUDED_PART.test(title) || EXCLUDED_COMPONENT.test(title) || COMPONENT_AT_START.test(title.trim()) ||
    (REGISTRATION_AT_START.test(title.trim()) && !/\b(?:plates?|registration)\s+included\b/i.test(title)) ||
    EXCLUDED_CONDITION.test(item.condition || "") ||
    /\bauction[ -]+only\b/i.test(title) ||
    (Array.isArray(item.buyingOptions) && item.buyingOptions.includes("AUCTION") && !hasCarPurchasePrice(item));
}

export type CarListingFilters = {
  vehicleType?: VehicleType;
  make?: string;
  model?: string;
  hideUnwanted?: boolean;
  minPrice?: string;
  maxPrice?: string;
  sort?: CarSort;
  carExtras?: CarExtra[];
};

export function filterCarListings(items: readonly EbayListing[], filters: CarListingFilters = {}): EbayListing[] {
  const minimum = filters.minPrice?.trim() === "0" ? 0 : carPriceInPence(filters.minPrice);
  const maximum = carPriceInPence(filters.maxPrice);
  if ((filters.minPrice?.trim() && minimum === null) || (filters.maxPrice?.trim() && maximum === null)) return [];
  if (minimum !== null && maximum !== null && minimum > maximum) return [];
  const priceSort = filters.sort === "price_asc" || filters.sort === "price_desc";
  // The provider sorts before its limit, but includes delivery in that order.
  // Rank the returned cards by their displayed asking price. This only covers
  // the returned batch, not every eBay listing or other marketplaces.
  const filtered = items.filter(item => {
    if (!(filters.vehicleType === "motorbikes" ? matchesMotorbikeCriteria(item.title, filters) : matchesCarCriteria(item.title, filters))) return false;
    if (filters.vehicleType !== "motorbikes" && !matchesCarExtras(item, filters.carExtras)) return false;
    if (filters.hideUnwanted && isUnwantedCarListing(item, filters.vehicleType)) return false;
    if (priceSort || minimum !== null || maximum !== null) {
      const price = carPriceInPence(item.price);
      if (item.currency !== "GBP" || price === null) return false;
      if (minimum !== null && price < minimum) return false;
      if (maximum !== null && price > maximum) return false;
      // A budget is a purchase-price ceiling, regardless of sort order or the
      // repair-advert toggle. An auction starting price is not a cash price.
      if (!hasCarPurchasePrice(item)) return false;
    }
    return true;
  });
  if (priceSort) filtered.sort((left, right) => (carPriceInPence(left.price)! - carPriceInPence(right.price)!) * (filters.sort === "price_desc" ? -1 : 1));
  return filtered;
}
