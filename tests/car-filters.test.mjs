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

test('clear registration-only offers are hidden without removing cars with an included private plate', () => {
  for (const title of ['Private number plate AB12 ABC', 'Cherished registration ABC 123', 'DVLA personalised registration plate', 'Registration transfer ABC 123']) {
    assert.equal(filterCarListings([car(1, { title })], { hideUnwanted: true }).length, 0, title);
  }
  for (const title of ['2018 Ford Fiesta private plate included', 'Private plate included Ford Fiesta full MOT', '2015 BMW 320d cherished registration included']) {
    assert.equal(filterCarListings([car(1, { title })], { hideUnwanted: true }).length, 1, title);
  }
});
