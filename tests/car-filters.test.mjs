import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const repo = fileURLToPath(new URL('../', import.meta.url));
function load(path) {
  const file = resolve(repo, path.endsWith('.ts') ? path : `${path}.ts`);
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, URL, URLSearchParams, require: name => load(resolve(dirname(file), name)) });
  return exports;
}
const { filterCarListings } = load('app/lib/car-filters.ts');
const { createCarSearch } = load('app/lib/search.ts');
const { getSavedSearchUrl, parseSavedSearchParams, safeSearchReturnUrl } = load('app/lib/saved-search.ts');
const { getCarRecommendations } = load('app/lib/car-recommendations.ts');
const fields = { make: '', model: '', year: '', price: '5000', postcode: '', platform: 'all' };
const car = (id, changes = {}) => ({ id: String(id), title: '2018 Ford Fiesta', url: `https://www.ebay.co.uk/itm/12345678900${id}`, image: null, price: '2500', currency: 'GBP', condition: 'Used', location: 'UK', buyingOptions: ['FIXED_PRICE'], ...changes });
const ids = rows => Array.from(rows, row => row.id);

test('car extras narrow returned cars without changing motorbike behaviour or budget rules', () => {
  const rows = [
    car(1, { title: 'Golf heated seats panoramic roof', price: '500' }),
    car(2, { title: 'Golf heated seats', shortDescription: 'Panoramic roof', price: '501' }),
    car(3, { title: 'Golf heated seats', price: '400' }),
    car(4, { title: 'Golf heated seats panoramic roof', price: '100', buyingOptions: ['AUCTION'] }),
    car(5, { title: 'Golf no heated seats panoramic roof', price: '300' }),
  ];
  assert.deepEqual(ids(filterCarListings(rows, { carExtras: ['heated_seats', 'panoramic_roof'], maxPrice: '500', sort: 'price_asc' })), ['1']);
  assert.deepEqual(ids(filterCarListings(rows, { carExtras: ['panoramic_roof'], maxPrice: '500', sort: 'price_asc' })), ['5', '1']);
  assert.equal(filterCarListings([car(6, { title: 'Honda CBR125 motorcycle full MOT' })], { vehicleType: 'motorbikes', carExtras: ['heated_seats'] }).length, 1);
});

test('motorbike filters retain complete bikes and scooters but exclude repair, part and bid adverts', () => {
  const rows = [
    ['Honda CBR125 motorcycle full MOT', '450', ['FIXED_PRICE']],
    ['Vespa Primavera scooter full MOT', '500', ['CLASSIFIED_AD']],
    ['Honda CBR125 fairing replacement', '50', ['FIXED_PRICE']],
    ['Yamaha motorbike spares repairs', '99', ['FIXED_PRICE']],
    ['Honda CBR125 deposit', '199', ['FIXED_PRICE']],
    ['Honda CBR125 motorcycle', '99', ['AUCTION']],
    ['Honda CBR125 motorcycle', '501', ['FIXED_PRICE']],
    ['Mobility scooter', '200', ['FIXED_PRICE']],
  ].map(([title, price, buyingOptions], index) => car(index + 1, { title, price, buyingOptions }));
  assert.deepEqual(ids(filterCarListings(rows, { vehicleType: 'motorbikes', maxPrice: '500', sort: 'price_asc', hideUnwanted: true })), ['1', '2']);
  assert.deepEqual(ids(filterCarListings(rows, { maxPrice: '500', sort: 'price_asc', hideUnwanted: true })), []);
});

test('motorbike make/model checks handle compact badges, separate brands and preserve car behaviour', () => {
  const rows = ['HondaCBR125 motorcycle MOT', 'Honda CBR 125 motorcycle', 'Yamaha MT-07 Honda CBR125 alternative', 'Honda CB125F motorcycle'].map((title, index) => car(index + 1, { title, price: '1000' }));
  assert.deepEqual(ids(filterCarListings(rows, { vehicleType: 'motorbikes', make: 'Honda', model: 'CBR125', hideUnwanted: true })), ['1', '2']);
  const yamaha = car(5, { title: 'YamahaMT07 motorcycle MOT' });
  assert.equal(filterCarListings([yamaha], { vehicleType: 'motorbikes', make: 'Yamaha', model: 'MT-07', hideUnwanted: true }).length, 1);
  assert.equal(filterCarListings([car(6, { title: 'BMW R1200GS' })], { vehicleType: 'motorbikes', make: 'BMW', model: 'R1200GS', hideUnwanted: true }).length, 1, 'BMW motorbike badges must not trigger car part-code checks');
  for (const [make, model, title] of [['Royal Enfield', 'Meteor 350', 'RoyalEnfield Meteor 350 motorcycle'], ['Moto Guzzi', 'V7', 'MotoGuzzi V7 motorcycle'], ['Harley Davidson', 'Sportster', 'HarleyDavidson Sportster motorcycle']]) {
    assert.equal(filterCarListings([car(7, { title })], { vehicleType: 'motorbikes', make, model, hideUnwanted: true }).length, 1, title);
  }
});

test('motorbike price picks use complete-bike checks and clear purchase prices', () => {
  const search = createCarSearch({ ...fields, vehicleType: 'motorbikes', make: 'Honda', model: 'CBR125', price: '1000' });
  const rows = [
    car(1, { title: 'Honda CBR125 motorcycle full MOT', price: '900' }),
    car(2, { title: 'Honda CBR125 motorcycle full MOT', price: '750' }),
    car(3, { title: 'Honda CBR125 spares repairs', price: '100' }),
    car(4, { title: 'Honda CBR125 motorcycle', price: '50', buyingOptions: ['AUCTION'] }),
  ];
  assert.deepEqual(Array.from(getCarRecommendations(rows, search), result => result.item.id), ['2', '1']);
});

test('misclassified live motorbike accessories, ambiguous titles and projects cannot become cheap bikes', () => {
  const titles = [
    'Black GPS navigator in working condition. Garmin Nuvi 42 model.',
    'Kawasaki GT 550 1991 Air Box- Good Condition',
    'Check Photos',
    '12” Apes for Softail Delux Harley Davidson',
    'motorbike top box',
    'kawasaki z900rs standard exhuast',
    'Brand New FuelX Lite Euro 5+ Kit – Royal Enfield Super Meteor 650 / Shotgun 650',
    'Sur Ron Ultra Bee QLCHG1000W Cross Bike Motor Charger 85V 12A',
    'BMW R1300GS HEATED LOW FRONT SEAT 2023-2026.',
    'MOT till 18-04-2027 Honda Jazz',
    'VELOCETTE LE PROJECT BARN FIND 1950’s MK 2',
    'Kawasaki ZZR1100 D Project',
    'Yamaha Wr 250f Project',
    'Vespa LML PX 125 (172 kit). Project.',
    'Honda CBR600 engine runs and tested',
  ];
  const rows = titles.map((title, index) => car(index, { title, price: '250' }));
  assert.equal(filterCarListings(rows, { vehicleType: 'motorbikes', maxPrice: '500', hideUnwanted: true }).length, 0);
  assert.equal(getCarRecommendations(rows, createCarSearch({ ...fields, vehicleType: 'motorbikes' })).length, 0);
  assert.equal(filterCarListings(rows, { vehicleType: 'motorbikes', hideUnwanted: false }).length, rows.length);
});

test('bike component checks preserve sparse bike names, unknown makes and explicitly fitted equipment', () => {
  const titles = [
    'Vfr400',
    'pw50 yamaha',
    '125cc Pit Bike',
    'ZHONGNENG Model ZN 125 T-H Black Year of manufacture 2022',
    'Gabbiano Turismo 50cc Moped',
    'BMW R1300GS with heated low front seat',
    'BMW 310 GS motorcycle full MOT',
    'BMW 310R',
    'BMW 750GS',
    'Honda CBR600 new chain and sprockets full MOT',
    'Royal Enfield Meteor exhaust fitted',
    'Honda PCX 125 with topbox',
    'Vespa PX125 with 172 tuning kit full MOT',
  ];
  for (const title of titles) {
    assert.equal(filterCarListings([car(1, { title })], { vehicleType: 'motorbikes', hideUnwanted: true }).length, 1, title);
  }
  assert.equal(filterCarListings([car(1, { title: 'MOT till 18-04-2027 Honda Jazz' })], { vehicleType: 'cars', hideUnwanted: true }).length, 1);
});

test('budget browsing can search all makes and persist explicit filter choices', () => {
  for (const hideUnwanted of [true, false]) {
    const search = createCarSearch({ ...fields, minPrice: '1000', sort: 'price_asc', hideUnwanted });
    assert.equal(search.title, 'All cars');
    assert.equal(search.query, '');
    assert.equal(search.minPrice, '1000');
    assert.equal(search.carSort, 'price_asc');
    assert.equal(search.hideUnwanted, hideUnwanted);
    const url = getSavedSearchUrl(search.saveItem);
    const restored = parseSavedSearchParams(new URL(url, 'https://mekivo.uk').searchParams);
    assert.equal(restored.make, '');
    assert.equal(restored.minPrice, '1000');
    assert.equal(restored.price, '5000');
    assert.equal(restored.sort, 'price_asc');
    assert.equal(restored.hideUnwanted, hideUnwanted);
    assert.equal(safeSearchReturnUrl(url), url);
  }
});

test('legacy saved searches do not silently enable a new filter or change their URL', () => {
  const original = '/?restore=1&mode=cars&make=Ford&model=Fiesta&price=5000&platform=all';
  const restored = parseSavedSearchParams(new URL(original, 'https://mekivo.uk').searchParams);
  assert.equal(restored.minPrice, undefined);
  assert.equal(restored.sort, undefined);
  assert.equal(restored.hideUnwanted, undefined);
  assert.equal(safeSearchReturnUrl(original), original);
  const search = createCarSearch({ ...fields, make: 'Ford' });
  assert.equal(search.hideUnwanted, undefined);
});

test('untrusted restored filters cannot invent a sort, turn a negative minimum positive or leak into parts', () => {
  for (const query of ['mode=cars&min_price=-500&sort=constructor&hide_unwanted=yes', 'mode=parts&min_price=500&sort=price_asc&hide_unwanted=1']) {
    const restored = parseSavedSearchParams(new URLSearchParams(`restore=1&${query}`));
    assert.equal(restored.minPrice, undefined);
    assert.equal(restored.sort, undefined);
    assert.equal(restored.hideUnwanted, undefined);
  }
});

test('eBay handoff preserves the price range while unsupported marketplace filters remain honest', () => {
  const search = createCarSearch({ ...fields, minPrice: '1000', sort: 'price_asc', hideUnwanted: true });
  const ebay = new URL(search.fallbackUrl);
  assert.equal(ebay.searchParams.get('_udlo'), '1000');
  assert.equal(ebay.searchParams.get('_udhi'), '5000');
  assert.equal(ebay.searchParams.get('_sacat'), '9801');
  assert.equal(ebay.searchParams.get('campid'), '5339201924');
  assert.equal(ebay.searchParams.get('_nkw'), '');
});

test('minimum and maximum asking-price filters are inclusive and reject unpriced or non-GBP rows', () => {
  const items = [car(1, { price: '999.99' }), car(2, { price: '1000' }), car(3, { price: '5000' }), car(4, { price: '5000.01' }), car(5, { price: null }), car(6, { currency: 'EUR' })];
  assert.deepEqual(ids(filterCarListings(items, { minPrice: '1000', maxPrice: '5000' })), ['2', '3']);
  for (const filters of [{ minPrice: '6000', maxPrice: '5000' }, { minPrice: '-1' }, { maxPrice: 'bad' }]) assert.equal(filterCarListings(items, filters).length, 0);
  assert.equal(filterCarListings([car(1)], { minPrice: '0' }).length, 1);
});

test('£500 and £1,000 budget-only searches include the ceiling, exclude dearer cars and survive saving', () => {
  for (const amount of [500, 1000]) {
    const search = createCarSearch({ ...fields, price: String(amount), minPrice: '', sort: 'price_asc', hideUnwanted: true });
    const items = [
      car(1, { price: String(amount) }),
      car(2, { price: String(amount + 0.01) }),
      car(3, { price: String(amount - 100) }),
      car(4, { price: '99', title: 'Ford Fiesta deposit only' }),
      car(5, { price: '50', title: 'Ford Fiesta spares or repairs' }),
      car(6, { price: '10', buyingOptions: ['AUCTION'] }),
      car(7, { price: null }),
      car(8, { currency: 'EUR' }),
    ];
    assert.deepEqual(ids(filterCarListings(items, { maxPrice: search.maxPrice, sort: search.carSort, hideUnwanted: search.hideUnwanted })), ['3', '1']);
    assert.equal(search.query, '');
    assert.equal(new URL(search.carLinks.ebay).searchParams.get('_udhi'), String(amount));
    assert.equal(new URL(search.carLinks.autotrader).searchParams.get('price-to'), String(amount));
    const restored = parseSavedSearchParams(new URL(getSavedSearchUrl(search.saveItem), 'https://mekivo.uk').searchParams);
    assert.equal(restored.price, String(amount));
    assert.equal(restored.minPrice, undefined);
    assert.equal(restored.make, '');
  }
});

test('budget filters never accept an auction-only starting price even with best match and repair adverts enabled', () => {
  const items = [
    car(1, { price: '99', buyingOptions: ['AUCTION'] }),
    car(2, { price: '400', buyingOptions: ['CLASSIFIED_AD'] }),
    car(3, { price: '500', buyingOptions: ['AUCTION', 'FIXED_PRICE'] }),
    car(4, { price: '10', buyingOptions: [] }),
  ];
  for (const sort of [undefined, 'best_match', 'newest', 'price_asc', 'price_desc']) {
    const expected = sort === 'price_desc' ? ['3', '2'] : ['2', '3'];
    assert.deepEqual(ids(filterCarListings(items, { maxPrice: '500', sort, hideUnwanted: false })), expected);
  }
});

test('price sorting compares positive purchase prices, never bids, and does not mutate provider data', () => {
  const items = [car(1, { price: '5000' }), car(2, { price: '999.99' }), car(3, { price: '2500' }), car(4, { price: '10', buyingOptions: ['AUCTION'] }), car(5, { price: '0' }), car(6, { currency: 'USD' }), car(7, { price: null })];
  const before = structuredClone(items);
  assert.deepEqual(ids(filterCarListings(items, { sort: 'price_asc' })), ['2', '3', '1']);
  assert.deepEqual(ids(filterCarListings(items, { sort: 'price_desc' })), ['1', '3', '2']);
  assert.deepEqual(items, before);
  assert.equal(filterCarListings([car(8, { buyingOptions: ['AUCTION', 'FIXED_PRICE'] })], { sort: 'price_asc' }).length, 1);
});

test('best match and newest preserve provider order and allow missing prices unless a budget is set', () => {
  const items = [car(1, { price: null }), car(2, { price: '100' }), car(3, { price: '50' })];
  for (const sort of [undefined, 'best_match', 'newest']) assert.deepEqual(ids(filterCarListings(items, { sort })), ['1', '2', '3']);
});

test('unwanted toggle removes identifiable misleading offers while keeping normal dealer wording', () => {
  const titles = ['spares or repairs', 'breaking', 'salvage', 'deposit £100', 'finance only', '£99 pcm', 'engine only', 'bumper', 'auction only', 'CAT N'];
  const unwanted = titles.map((suffix, i) => car(i, { title: `Ford Fiesta ${suffix}` }));
  unwanted.push(car(11, { buyingOptions: ['AUCTION'] }), car(12, { condition: 'For parts or not working' }));
  assert.equal(filterCarListings(unwanted, { hideUnwanted: true }).length, 0);
  assert.equal(filterCarListings(unwanted, { hideUnwanted: false }).length, unwanted.length);
  const legitimate = [car(1, { title: 'Ford Fiesta finance available' }), car(2, { title: 'Ford Fiesta part exchange welcome' })];
  assert.equal(filterCarListings(legitimate, { hideUnwanted: true }).length, 2);
});

test('all-car price picks honour minimum budget and retain stricter recommendation safeguards', () => {
  const search = createCarSearch({ ...fields, minPrice: '2000' });
  const result = getCarRecommendations([car(1, { price: '1900' }), car(2, { title: '2016 Audi A3', price: '3000' }), car(3, { price: '4500' }), car(4, { title: 'Ford Fiesta breaking' })], search);
  assert.deepEqual(Array.from(result, row => row.item.id), ['2', '3']);
});

test('misclassified sensors, control units and seating parts cannot become cheap-car results or price picks', () => {
  const titles = [
    'Bosch Temperature Sensor Sensor2464509015',
    'Engine control unit Golf V 1K5 03G906021QJ diesel EDC16U34',
    'Honda Accord1991-3CB3CB7FrontLeftRight Headrest',
    'BMW E90 ABS control module 34516778478',
    'Ford Focus front suspension strut',
    'VW Golf rear shock absorbers pair',
    'Radiator Ford Fiesta 1.0 petrol',
    'Vauxhall Astra steering rack',
    'Genuine Bosch Sensor for Audi A3',
  ];
  const items = titles.map((title, index) => car(index, { title, price: '80' }));
  assert.equal(filterCarListings(items, { hideUnwanted: true, sort: 'price_asc' }).length, 0);
  assert.equal(getCarRecommendations(items, createCarSearch(fields)).length, 0);
  assert.equal(filterCarListings(items, { hideUnwanted: false }).length, items.length);
});

test('normal car equipment and recent clutch work do not trigger component exclusions', () => {
  const titles = [
    '2018 Ford Fiesta Zetec parking sensors finance available',
    '2017 Audi A3 front and rear parking sensors',
    '2016 VW Golf new clutch full MOT',
    '2018 Honda Civic active headrests part-exchange welcome',
    '2015 Ford Focus rain sensor automatic lights',
  ];
  const items = titles.map((title, index) => car(index, { title }));
  assert.equal(filterCarListings(items, { hideUnwanted: true }).length, items.length);
});

test('cheap-category component and swap-only adverts cannot consume genuine car results', () => {
  const misleading = [
    'Mondeo St 2.2 Diesel, SWAPS ONLY for VXR',
    'Volkswagen Golf part exchange only',
    'bentley continental gt petrol cap',
    'mazda MX5 Mk 2 manifold to Cat exhaust pipe',
    'Aston Martin DB9 battery conditioner used',
    'RANGE ROVER SPORT L494 LOWER GRILL GENUINE JK6M-17F775-A',
    'Ford Fiesta Rolling Shell Project Track Day Car Stripped mk7 2011',
    'VW Golf Audi A3 2.0 TDI 6 Speed Manual Gearbox',
    '4 Genuine BMW F20 F21 M140i Black Alloy Wheels',
    'Lotus Exige Rear Spoiler Black £295',
    'BMW M3 M4 G80 Gloss Black full black trims',
  ].map((title, index) => car(index, { title, price: '400' }));
  assert.equal(filterCarListings(misleading, { maxPrice: '500', sort: 'price_asc', hideUnwanted: true }).length, 0);
  assert.equal(filterCarListings(misleading, { maxPrice: '500', sort: 'price_asc', hideUnwanted: false }).length, misleading.length);
  const genuine = [
    '2011 Ford Ka Edge HPI Clear 1.2 Petrol',
    '2003 Mazda 2 1.25 Petrol Manual Long MOT FSH',
    'Volkswagen Golf manual gearbox new clutch full MOT',
    '2015 Ford Focus new gearbox',
    '2012 Honda Civic rear spoiler included',
    'Suzuki Ignis mk1 1.3 2003 silver alloys',
    'Ford Fiesta part exchange welcome finance available',
  ].map((title, index) => car(index, { title, price: '450' }));
  assert.equal(filterCarListings(genuine, { maxPrice: '500', sort: 'price_asc', hideUnwanted: true }).length, genuine.length);
});

test('observed £500 category leaks and product forms are hidden by title rather than price', () => {
  const observed = [
    ['BMW 330d / 335d /M2 / M3 / M4 F80 Allows ( R19 ) ( 800 )  Only Cash Money', '0.99'],
    ['Brand New Right Mirror Blinker   Citroen C3 Aircross', '10.00'],
    ['6 Rib V-Ribbed Belt 6PK1245 Gates', '12.50'],
    ['R50 2003 mini cooper steering wheel Airbag', '20.00'],
    ['New genuine Vauxhall Vivaro B 2015  Front right inner door handle bracket', '40.00'],
    ['Vauxhall Viva 2015-2019 Radio Stereo Head Unit Bluetooth USB 42526443 Genuine', '44.99'],
    ['New Genuine Heat shield 2 545 523', '45.60'],
    ['R55 R56 Mini Cooper Steering wheel & Airbag ', '50.00'],
    ['BMW  8 036 939 Alloy', '50.00'],
    ['vw mk6 front windscreen wiper motor', '70.00'],
    ['Mini Cooper 2009 Head Unit', '75.00'],
    ['BMW 1 2 3 4 Series F20 F22 F30 F31 F32 F36 SE Complete With Airbag', '80.00'],
    ['Genuine Mercedes A-Class W176 AMG Line Rear Suspension Kit - Shocks & Springs A2', '140.00'],
    ['ALFA ROMEO GIULIETTA MK3 2011 ALLOY WHEELS Tyres  4 SIZE 225/45/17 7.5JX17', '145.00'],
    ['Citroen C4 Picasso 2014 Tires. 4 Available', '150.00'],
    ['LUK 624352233 Clutck Kit', '205.00'],
    ['Toyota Celica ST202 Passenger Door', '230.00'],
    ['Toyota Celica Gen 6 Convertible Roof', '300.00'],
    ['Jeep Renegade 1.4 Petrol Gher Box', '330.00'],
    ['w215 hydraulic motor for power trunk', '350.00'],
    ['Crashed Suzuki Swift GL M13A 1.3 Petrol Manual 5 Speed', '350.00'],
    ['New timing belt for Ford Fiesta', '50.00'],
    ['Brand new head unit for Mini Cooper', '75.00'],
  ].map(([title, price], index) => car(index, { title, price }));
  assert.equal(filterCarListings(observed, { maxPrice: '500', sort: 'price_asc', hideUnwanted: true }).length, 0);
  assert.equal(getCarRecommendations(observed, createCarSearch({ ...fields, price: '500' })).length, 0);
  assert.equal(filterCarListings(observed, { maxPrice: '500', sort: 'price_asc', hideUnwanted: false }).length, observed.length);
});

test('component-name checks preserve cheap whole-car titles and fitted or completed maintenance descriptions', () => {
  const titles = [
    'car',
    'Vauxhall Zafira 1.8',
    'vauxhall corsa d cdti 1.3 2009 black 3-door',
    'Suzuki Ignis mk1 1.3 2003 silver alloys',
    '2001 RENAULT CLIO AUTHENTIQUE 8V 5 DOOR HATCHBACK: OFFERS WELCOME!',
    'Skoda Kodiaq',
    '2007 Ford Mondeo St Tdci',
    'Volvo C30 - 1.6l - Burnt Orange - 2010 - Petrol',
    'Volkswagen Golf Plus 1.9',
    'Ford Fiesta 2002 1.4 petrol Hatch',
    'Mini Cooper R56',
    'Mercedes C180 2003',
    'Nissan Micra 2003 1.2 16v SE Hatchback 5dr Petrol Manual',
    'Ford, FIESTA, Hatchback, 2007, Manual, 1388 (cc), 3 doors',
    'VAUXHALL CORSA',
    'CITREON C4 PICASSO',
    '2014 BMW 330d with R19 alloy wheels',
    '2014 BMW 330d R19 alloy wheels fitted',
    '2014 BMW 330d with alloy wheels R19',
    '2014 BMW 330d alloy wheels R19 fitted',
    '2014 Alfa Romeo Giulietta with alloy wheels tyres 225/45/17',
    '2012 Ford Fiesta new V-ribbed belt full MOT',
    '2012 Ford Fiesta new V-ribbed belt',
    'Ford Fiesta new timing belt',
    'Ford Fiesta new belt',
    '2012 Ford Fiesta serpentine belt replaced',
    '2014 Mini Cooper steering wheel airbag replaced',
    '2014 Mini Cooper with steering wheel and airbag',
    'Vauxhall Vivaro inner door handle bracket replaced',
    '2016 Vauxhall Viva with Bluetooth head unit',
    '2016 Vauxhall Viva new head unit',
    '2010 Ford Fiesta heat shield fitted',
    '2009 VW Golf windscreen wiper motor replaced',
    '2014 Mercedes A-Class rear suspension kit fitted',
    '2014 Citroen C4 Picasso full MOT 4 new tyres',
    '2012 Ford Fiesta new clutch kit full MOT',
    'Toyota Celica passenger door replaced',
    'Toyota Celica convertible roof fitted',
    '2003 Mercedes C180 hydraulic motor for power trunk replaced',
    'Suzuki Swift GL never crashed full service history',
  ];
  for (const [index, title] of titles.entries()) {
    const item = car(index, { title, price: '450' });
    assert.deepEqual(ids(filterCarListings([item], { maxPrice: '500', sort: 'price_asc', hideUnwanted: true })), [item.id], title);
  }
});

test('whole-car owner and running descriptions survive component mentions without excusing product-start titles', () => {
  const completeCars = [
    '2014 BMW 330d 2 owners alloy wheels R19',
    'Toyota Celica convertible roof works runs and drives',
    '2016 Vauxhall Viva runs drives Bluetooth head unit',
  ];
  for (const title of completeCars) {
    assert.equal(filterCarListings([car(1, { title })], { hideUnwanted: true }).length, 1, title);
  }
  const products = [
    'Head unit for Vauxhall Viva tested runs',
    'New head unit for Vauxhall Viva previous owner tested runs',
    'Bare engine Volkswagen Golf 1.4 TSI CAXA tested runs',
    'Engine for Volkswagen Golf 1.4 TSI tested runs',
  ];
  for (const title of products) {
    const item = car(1, { title });
    assert.equal(filterCarListings([item], { hideUnwanted: true }).length, 0, title);
    assert.equal(filterCarListings([item], { hideUnwanted: false }).length, 1, title);
  }
});

test('clear registration-only offers are hidden without removing cars with an included private plate', () => {
  for (const title of ['Private number plate AB12 ABC', 'Cherished registration ABC 123', 'DVLA personalised registration plate', 'Registration transfer ABC 123']) {
    assert.equal(filterCarListings([car(1, { title })], { hideUnwanted: true }).length, 0, title);
  }
  for (const title of ['2018 Ford Fiesta private plate included', 'Private plate included Ford Fiesta full MOT', '2015 BMW 320d cherished registration included']) {
    assert.equal(filterCarListings([car(1, { title })], { hideUnwanted: true }).length, 1, title);
  }
});

test('whole-car results hide boot lids, DPFs and individual engines found in live budget responses', () => {
  const titles = [
    'Mitsubishi Evolution 7/8/9 NEW Carbon Fibre BootLid',
    'Mitsubishi Evolution Carbon Fibre Boot Lid £500',
    'Hyundai Santa Fe 2019 2.2 Diesel Genuine DPF',
    'Ford Focus Diesel Particulate Filter £250',
    '2010 Volkswagen Golf 1.4 Tsi Engine',
    'Volkswagen Golf 1.4 TSI Engine £500',
    'Bare engine Volkswagen Golf 1.4 TSI CAXA tested runs',
    'Engine for Volkswagen Golf 1.4 TSI tested runs',
  ];
  const items = titles.map((title, index) => car(index, { title, price: '500' }));
  assert.equal(filterCarListings(items, { maxPrice: '1000', hideUnwanted: true }).length, 0);
  assert.equal(filterCarListings(items, { maxPrice: '1000', hideUnwanted: false }).length, items.length);
  assert.equal(getCarRecommendations(items, createCarSearch(fields)).length, 0);
});

test('engine and DPF maintenance and replacement boot lids remain complete-car descriptions', () => {
  const titles = [
    '2010 Volkswagen Golf 1.4 TSI replacement engine full MOT',
    '2010 Volkswagen Golf 1.4 TSI engine replaced',
    '2012 Ford Focus new engine',
    '2012 Ford Focus reconditioned engine fitted',
    '2010 Volkswagen Golf 1.4 TSI bare engine replaced full MOT',
    '2019 Hyundai Santa Fe 2.2 Diesel DPF replaced',
    '2019 Hyundai Santa Fe new diesel particulate filter full service history',
    'Mitsubishi Evolution carbon fibre boot lid fitted 80,000 miles',
    'Mitsubishi Evolution replacement bootlid',
  ];
  for (const title of titles) {
    assert.equal(filterCarListings([car(1, { title })], { hideUnwanted: true }).length, 1, title);
  }
});

test('motorcycles and scooters cannot become car picks while fitted mobility equipment remains allowed', () => {
  const titles = [
    'vespa scooter gts 300 SUPER RED LOW MILEAGE',
    'Honda CBR600 motorcycle full MOT runs well',
    'Yamaha motorbike 125cc',
    'Peugeot moped 50cc',
  ];
  const items = titles.map((title, index) => car(index, { title }));
  assert.equal(filterCarListings(items, { hideUnwanted: true }).length, 0);
  assert.equal(getCarRecommendations(items, createCarSearch(fields)).length, 0);
  assert.equal(filterCarListings(items, { hideUnwanted: false }).length, items.length);
  for (const title of [
    'Ford C-Max mobility scooter hoist full MOT',
    'Ford C-Max mobility-scooter hoist full MOT',
    'Ford C-Max mobility scooter lift full MOT',
    'Ford Fiesta full MOT motorbike part exchange welcome',
    'Ford Fiesta full MOT part-exchange motorcycle considered',
  ]) assert.equal(filterCarListings([car(1, { title })], { hideUnwanted: true }).length, 1, title);
  assert.equal(filterCarListings([car(1, { title: 'Ford Fiesta motorbike swaps only' })], { hideUnwanted: true }).length, 0);
});

test('cheap disclosed repair and project cars stay available when the unwanted-advert toggle is off', () => {
  const items = [
    car(1, { title: 'Volkswagen Polo Needs A New Clutch', price: '500' }),
    car(2, { title: 'Volkswagen Passat Engine Fault', price: '500' }),
    car(3, { title: 'Land Rover Discovery Project', price: '500' }),
    car(4, { title: 'Ford Fiesta spares or repairs', price: '500' }),
  ];
  assert.deepEqual(ids(filterCarListings(items, { maxPrice: '500', hideUnwanted: false })), ['1', '2', '3', '4']);
});

test('explicit make and model keep Golf and Golf Plus while excluding different cars and keyword tails', () => {
  const items = [
    car(1, { title: '2010 Volkswagen Golf 1.6 TDI' }),
    car(2, { title: 'VW Golf Plus GT TDI' }),
    car(3, { title: 'vW / gOlF - Match' }),
    car(4, { title: 'Volkswagen Polo 1.2 Match' }),
    car(5, { title: 'Volkswagen Tiguan 2.0 Diesel' }),
    car(6, { title: 'SEAT Leon 1.6 TDI' }),
    car(7, { title: 'Volkswagen Golfing accessory' }),
    car(8, { title: 'audi a3 sportback 1.6 tdi £20 road tax black a1 a2 a3 a4 vw golf polo ford' }),
    car(9, { title: '2010 Audi A3 comparable to VW Golf' }),
    car(10, { title: '2010 VWGolf 1.6 TDI' }),
    car(11, { title: '2010 VolkswagenGolfPlus 1.6 TDI' }),
    car(12, { title: 'AudiA3 1.6 TDI comparable to VW Golf' }),
    car(13, { title: 'VW Polo 1.2 comparable to Golf' }),
    car(14, { title: 'VW Tiguan 2.0 TDI similar to Golf' }),
  ];
  for (const make of ['Volkswagen', 'VW', ' volkswagen ']) {
    assert.deepEqual(ids(filterCarListings(items, { make, model: 'Golf', maxPrice: '5000', hideUnwanted: false })), ['1', '2', '3', '10', '11']);
  }
  assert.equal(filterCarListings(items, { make: '', model: '' }).length, items.length);
  assert.deepEqual(ids(filterCarListings(items, { make: 'Volkswagen' })), ['1', '2', '3', '4', '5', '7', '10', '11', '13', '14']);
  assert.deepEqual(ids(filterCarListings(items, { model: 'Polo' })), ['4', '8', '13']);
});

test('make/model matching normalizes punctuation and aliases without matching partial tokens', () => {
  for (const make of ['Mercedes', 'Mercedes-Benz']) {
    const items = [
      car(1, { title: '2014 MERCEDES-BENZ C-Class full MOT' }),
      car(2, { title: 'Mercedes C Class 2.1 CDI' }),
      car(3, { title: 'Mercedes E-Class' }),
    ];
    assert.deepEqual(ids(filterCarListings(items, { make, model: 'C Class' })), ['1', '2']);
  }
  assert.equal(filterCarListings([car(1, { title: 'AUDI A-3 2010' })], { make: 'Audi', model: 'A3' }).length, 1);
  assert.equal(filterCarListings([car(1, { title: 'Audi A30' })], { make: 'Audi', model: 'A3' }).length, 0);
  assert.equal(filterCarListings([car(1, { title: 'Range-Rover Evoque 2012' })], { make: 'Land Rover', model: 'Range Rover Evoque' }).length, 1);
});

test('BMW series choices accept standard numeric badges and reject other series', () => {
  const items = [
    car(1, { title: 'BMW 3 Series 2012' }),
    car(2, { title: 'BMW 320d estate 2012' }),
    car(3, { title: 'BMW 330e M Sport' }),
    car(4, { title: 'BMW M340i xDrive' }),
    car(5, { title: 'BMW 5 Series 2014' }),
    car(6, { title: 'BMW 530D estate' }),
    car(7, { title: 'BMW 520i automatic' }),
    car(8, { title: 'BMW 118d hatchback' }),
    car(9, { title: 'BMW X3 3.0d 2012' }),
    car(10, { title: 'BMW 320 door mirror' }),
  ];
  assert.deepEqual(ids(filterCarListings(items, { make: 'BMW', model: '3 Series' })), ['1', '2', '3', '4']);
  assert.deepEqual(ids(filterCarListings(items, { make: 'BMW', model: '5 Series' })), ['5', '6', '7']);
  assert.deepEqual(ids(filterCarListings(items, { make: 'BMW', model: '1 Series' })), ['8']);
  assert.deepEqual(ids(filterCarListings(items, { make: 'BMW', model: 'X3' })), ['9']);
});

test('expanded makes retain compact and compound names while rejecting other makes in keyword tails', () => {
  for (const [make, model, title] of [
    ['Fiat', 'Punto', 'FiatPunto full MOT'],
    ['Aston Martin', 'DB9', 'AstonMartinDB9 full MOT'],
    ['Rolls-Royce', 'Ghost', 'RollsRoyceGhost full MOT'],
    ['Alfa Romeo', 'Giulia', 'AlfaRomeo Giulia full MOT'],
    ['MG', 'ZS', 'MGZS full MOT'],
    ['AC', 'Cobra', 'AC Cobra full MOT'],
    ['Honda', 'Accord', 'HONDA ACCORD full MOT'],
    ['Mazda', 'Mazda2', 'Mazda2 full MOT'],
    ['Mazda', 'Mazda2', 'Mazda 2 full MOT'],
    ['Citroen', 'C3', 'Citroën C3 full MOT'],
    ['Skoda', 'Octavia', 'Škoda Octavia full MOT'],
    ['Unfamiliar Motors', 'Roadster', 'Unfamiliar Motors Roadster full MOT'],
  ]) assert.equal(filterCarListings([car(1, { title })], { make, model, hideUnwanted: true }).length, 1, title);
  for (const title of ['Fiat Punto Ford Fiesta alternative', 'Bentley Continental comparable to Ford Fiesta', 'AstonMartinDB9 similar to Ford Fiesta', 'BYD Dolphin comparable to Ford Fiesta']) {
    assert.equal(filterCarListings([car(1, { title })], { make: 'Ford', model: 'Fiesta' }).length, 0, title);
  }
});

test('expanded BMW series accept badges and known chassis/year prefixes without accepting another model tail', () => {
  for (const [series, badge] of [['2', '220d'], ['4', '420d'], ['6', '640i'], ['7', '730d'], ['8', 'M850i']]) {
    for (const title of [`BMW ${badge} full MOT`, `BMW ${series}Series`, `BMW 2018 ${badge} full MOT`]) {
      assert.equal(filterCarListings([car(1, { title })], { make: 'BMW', model: `${series} Series`, hideUnwanted: true }).length, 1, title);
    }
  }
  for (const title of ['BMW F30 320d full MOT', 'BMW 2018 320d full MOT', 'BMW E90 LCI 320d full MOT', 'BMW 2021 G20 LCI 320d full MOT']) {
    assert.equal(filterCarListings([car(1, { title })], { make: 'BMW', model: '3 Series', hideUnwanted: true }).length, 1, title);
  }
  for (const title of ['BMW 520d alternative to BMW 420d 4 Series', 'BMW G30 520d alternative to BMW 420d', 'BMW X4 comparable to BMW 420d 4 Series', 'BMW i4 comparable to BMW 4 Series', 'BMW 4200d', 'Audi A4 BMW 420d alternative']) {
    assert.equal(filterCarListings([car(1, { title })], { make: 'BMW', model: '4 Series' }).length, 0, title);
  }
});

test('specific joined model names match their catalogue separators without partial tokens or another model tail', () => {
  for (const [make, model, title] of [
    ['Audi', 'RS Q3', '2018 Audi RSQ3 full MOT'],
    ['Audi', 'RSQ3', '2018 Audi RS Q3 full MOT'],
    ['Toyota', 'C-HR', '2018 ToyotaCHR full MOT'],
    ['Toyota', 'CHR', '2018 Toyota C-HR full MOT'],
    ['Honda', 'CR-V', '2018 HondaCRV full MOT'],
    ['Honda', 'CRV', '2018 Honda CR-V full MOT'],
  ]) assert.equal(filterCarListings([car(1, { title })], { make, model, hideUnwanted: true }).length, 1, title);
  for (const [make, model, title] of [
    ['Audi', 'RS Q3', 'Audi RSQ30 full MOT'],
    ['Audi', 'RS Q3', 'Audi A3 similar to RSQ3'],
    ['Toyota', 'C-HR', 'Toyota CHRoadster full MOT'],
    ['Toyota', 'C-HR', 'Toyota Corolla similar to CHR'],
    ['Honda', 'CR-V', 'Honda CRVenture full MOT'],
    ['Honda', 'CR-V', 'Honda Civic similar to CRV'],
    ['Honda', 'CR-V', 'Fiat Punto Honda CRV alternative'],
  ]) assert.equal(filterCarListings([car(1, { title })], { make, model }).length, 0, title);
});

test('recognised BMW trim and transmission prefixes preserve the first vehicle badge and reject wrong-series tails', () => {
  for (const title of [
    'BMW M Sport 320d full MOT', 'BMW automatic 320d full MOT', 'BMW manual 320d full MOT',
    'BMW auto 320d full MOT', 'BMW xDrive 320d full MOT', 'BMW x Drive 320d full MOT',
    'BMW 2016 F30 LCI M Sport automatic xDrive 320d full MOT',
  ]) assert.equal(filterCarListings([car(1, { title })], { make: 'BMW', model: '3 Series', hideUnwanted: true }).length, 1, title);
  for (const title of [
    'BMW M Sport 520d similar to BMW 320d 3 Series',
    'BMW automatic 520d alternative to BMW 320d',
    'BMW manual X3 comparable to BMW 320d 3 Series',
    'BMW xDrive i3 similar to BMW 3 Series',
    'BMW auto enthusiast mentions BMW 320d',
    'Ford Fiesta BMW automatic 320d alternative',
  ]) assert.equal(filterCarListings([car(1, { title })], { make: 'BMW', model: '3 Series' }).length, 0, title);
});

test('Mercedes Class choices accept the corresponding badges but reject other class and make keyword tails', () => {
  for (const [model, badge] of [['A Class', 'A180'], ['B Class', 'B200'], ['C Class', 'C220d'], ['E Class', 'E220d'], ['G Class', 'G63'], ['R Class', 'R320'], ['S Class', 'S500'], ['V Class', 'V250']]) {
    for (const title of [`Mercedes ${badge} full MOT`, `Mercedes-Benz ${badge} full MOT`, `MERCEDESBENZ${badge} full MOT`]) {
      assert.equal(filterCarListings([car(1, { title })], { make: 'Mercedes', model, hideUnwanted: true }).length, 1, title);
    }
  }
  for (const title of ['Mercedes E220d alternative to C220d C Class', 'Mercedes E Class similar to C Class', 'Mercedes CLA200 similar to Mercedes C Class', 'Ford Fiesta similar to Mercedes C220d', 'Mercedes C2200d']) {
    assert.equal(filterCarListings([car(1, { title })], { make: 'Mercedes', model: 'C Class' }).length, 0, title);
  }
  assert.equal(filterCarListings([car(1, { title: 'Mercedes GLC250 similar to G Class' })], { make: 'Mercedes', model: 'G Class' }).length, 0);
  assert.equal(filterCarListings([car(1, { title: 'Mercedes AMG C63 full MOT' })], { make: 'Mercedes', model: 'C Class', hideUnwanted: true }).length, 1);
});

test('GWM aliases are limited to the selected ORA or Haval model and do not merge unrelated brands', () => {
  for (const [model, title] of [['ORA 03', 'ORA 03 full MOT'], ['ORA Funky Cat', 'ORA Funky Cat full MOT'], ['Haval Jolion Pro', 'Haval Jolion Pro full MOT'], ['ORA 03', 'GWMORA03 full MOT']]) {
    assert.equal(filterCarListings([car(1, { title })], { make: 'GWM', model, hideUnwanted: true }).length, 1, title);
  }
  for (const title of ['Haval Jolion Pro comparable to ORA 03', 'GWM Haval Jolion Pro comparable to ORA 03', 'Ford Fiesta ORA 03 alternative']) {
    assert.equal(filterCarListings([car(1, { title })], { make: 'GWM', model: 'ORA 03' }).length, 0, title);
  }
  assert.equal(filterCarListings([car(1, { title: 'ORA 03 full MOT' })], { make: 'GWM' }).length, 0, 'no make-wide ORA equivalence');
  assert.equal(filterCarListings([car(1, { title: 'SsangYong Rexton full MOT' })], { make: 'KGM', model: 'Rexton' }).length, 0);
  assert.equal(filterCarListings([car(1, { title: 'Citroen DS3 full MOT' })], { make: 'DS', model: 'DS3' }).length, 0);
});

test('broader make and badge matching retains cash-price, unwanted-listing and partial-model protections', () => {
  const rows = [
    car(1, { title: 'FiatPunto full MOT', price: '500' }),
    car(2, { title: 'Fiat Punto full MOT', price: '501' }),
    car(3, { title: 'Fiat Punto deposit', price: '100' }),
    car(4, { title: 'Fiat Punto front bumper', price: '50' }),
    car(5, { title: 'Fiat Punto full MOT', price: '100', buyingOptions: ['AUCTION'] }),
    car(6, { title: 'Fiat Punto full MOT', price: '300', currency: 'USD' }),
    car(7, { title: 'Fiat Puntofull full MOT', price: '400' }),
  ];
  assert.deepEqual(ids(filterCarListings(rows, { make: 'Fiat', model: 'Punto', maxPrice: '500', hideUnwanted: true })), ['1']);
  for (const title of ['New timing belt for Fiat Punto', 'BMW 420d front bumper', 'Mercedes C220d spare repair', 'BMW ABC1234']) {
    assert.equal(filterCarListings([car(1, { title })], { hideUnwanted: true }).length, 0, title);
  }
  assert.equal(filterCarListings([car(1, { title: 'Fiat Punto new timing belt' })], { make: 'Fiat', model: 'Punto', hideUnwanted: true }).length, 1);
});

test('split Gear Box product wording is hidden while gearbox maintenance and ordinary specifications survive', () => {
  const product = car(1, {
    title: 'AUDI Q7 3.0 S LINE 2018 GEAR BOX QUATTRO 8 SPEED AUTOMATIC',
    price: '3200',
  });
  assert.equal(filterCarListings([product], { maxPrice: '5000', hideUnwanted: true }).length, 0);
  assert.equal(getCarRecommendations([product], createCarSearch(fields)).length, 0);
  assert.equal(filterCarListings([product], { maxPrice: '5000', hideUnwanted: false }).length, 1);
  for (const title of [
    'Audi Q7 3.0 S Line 2018 automatic gearbox',
    '2018 Audi Q7 automatic gear box',
    'Audi Q7 3.0 S Line 2018 gear box replaced',
    'Audi Q7 3.0 S Line 2018 new gear box fitted full MOT',
    'Audi Q7 3.0 S Line 2018 gearbox replaced full MOT',
    'Audi Q7 3.0 S Line 2018 gear box quattro 8 speed automatic full MOT 80,000 miles',
  ]) {
    assert.equal(filterCarListings([car(2, { title })], { hideUnwanted: true }).length, 1, title);
  }
});

test('BMW plus only a seven-character mixed part code is hidden without treating badges or car context as parts', () => {
  for (const title of ['BMW  5A1A646', 'bmw ABC1234', 'BMW 123ABCD']) {
    const item = car(1, { title, price: '60' });
    assert.equal(filterCarListings([item], { maxPrice: '500', hideUnwanted: true }).length, 0, title);
    assert.equal(getCarRecommendations([item], createCarSearch(fields)).length, 0, title);
    assert.equal(filterCarListings([item], { maxPrice: '500', hideUnwanted: false }).length, 1, title);
  }
  for (const title of ['BMW 320d', 'BMW M340i', 'BMW 5Series', 'BMW 3 Series', 'BMW 320d full MOT code 5A1A646']) {
    assert.equal(filterCarListings([car(1, { title })], { hideUnwanted: true }).length, 1, title);
  }
});
