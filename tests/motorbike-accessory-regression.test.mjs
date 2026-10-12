import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

// A different source root lets the same observed fixtures reproduce the defect
// against the unchanged production source without editing that checkout.
const repo = process.env.MEKIVO_FILTER_SOURCE_ROOT || fileURLToPath(new URL('../', import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const liveAccessories = [
  ['full face mask', '14.17'],
  ['Motorbike Grab Bar Handle Rail Aluminum Alloy For 400X Scrumbler Triumph', '30'],
  ['Genuine Harley Davidson Footboards Chrome Softail, Touring Road.', '90'],
];
const listing = (title, price = '600', index = 0) => ({
  id: `v1|${123456789000 + index}|0`, title, price, currency: 'GBP',
  url: `https://www.ebay.co.uk/itm/${123456789000 + index}`, condition: 'Used',
  buyingOptions: ['FIXED_PRICE'], itemEndDate: null,
});

function harness(fetchPage = () => { throw new Error('Unexpected network request'); }) {
  const modules = new Map(), calls = [];
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const exports = {};
    modules.set(filename, exports);
    vm.runInNewContext(ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText, {
      exports, URL, URLSearchParams, Buffer, AbortController, Date, setTimeout, clearTimeout,
      process: { env: { EBAY_CLIENT_ID: 'test-client', EBAY_CLIENT_SECRET: 'test-secret' } },
      console: { error() {} },
      fetch: async (url, options) => {
        if (String(url).includes('/oauth2/')) return Response.json({ access_token: 'test-token', expires_in: 7200 });
        const parsed = new URL(url);
        calls.push({ url: parsed, options });
        return fetchPage(parsed, options);
      },
      require(name) {
        if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
        if (name.startsWith('node:')) return nativeRequire(name);
        if (name.startsWith('.')) return load(resolve(dirname(filename), `${name}.ts`));
        throw new Error(`Unexpected import: ${name}`);
      },
    }, { filename });
    return exports;
  }
  const helpers = load(resolve(repo, 'app/lib/car-filters.ts'));
  const { createCarSearch } = load(resolve(repo, 'app/lib/search.ts'));
  const { getCarRecommendations } = load(resolve(repo, 'app/lib/car-recommendations.ts'));
  return {
    ...helpers, calls,
    pricePicks(items) {
      return getCarRecommendations(items, createCarSearch({ vehicleType: 'motorbikes', make: '', model: '', year: '', price: '1000', postcode: '', platform: 'ebay' }));
    },
    get: () => load(resolve(repo, 'app/api/ebay/search/route.ts')).GET({
      nextUrl: new URL('https://mekivo.uk/api/ebay/search?type=cars&vehicleType=motorbikes&maxPrice=1000&sort=price_asc&hideUnwanted=1'),
    }),
  };
}

const h = harness();
const ids = values => Array.from(values, item => item.id);

test('the three observed live accessories are hidden from motorbike results and price picks', () => {
  for (const [title, price] of liveAccessories) {
    const item = listing(title, price);
    assert.equal(h.filterCarListings([item], { vehicleType: 'motorbikes', hideUnwanted: true, maxPrice: '1000' }).length, 0, title);
    assert.equal(h.pricePicks([item]).length, 0, title);
  }
});

test('rider gear, rails, foot equipment and luggage are products rather than complete bikes', () => {
  for (const title of [
    'Full FaceMask motorcycle black', 'Full-face helmet for Honda CBR125',
    'Alpinestars motorbike gloves', 'Leather motorcycle jacket size L', 'Motorcycle boots size 9',
    'Motorbike goggles', 'Clear visor for Yamaha helmet', 'Neck warmer motorcycle face mask',
    'Triumph rear grab rails', 'Honda passenger grab handles', 'Yamaha handle-rail',
    'Harley Davidson foot boards', 'Honda foot pegs', 'Kawasaki footrests',
    'Motorbike sissy bar', 'BMW panniers', 'Triumph saddle bags', 'Motorbike luggage rack',
    'Honda motorcycle footboards full MOT compatibility',
    'Grab bar with footboards for Honda motorcycle',
  ]) {
    const item = listing(title, '100');
    assert.equal(h.filterCarListings([item], { vehicleType: 'motorbikes', hideUnwanted: true }).length, 0, title);
    assert.equal(h.pricePicks([item]).length, 0, title);
  }
});

test('whole-bike titles, sparse unfamiliar makes and explicit fitted equipment remain eligible', () => {
  const titles = [
    '2018 Honda CBR125 motorcycle full MOT', 'Yamaha MT07 motorcycle', 'BMW R1200GS',
    'ZHONGNENG Model ZN 125 T-H Black Year of manufacture 2022', 'Gabbiano Turismo 50cc Moped',
    'Vfr400', 'pw50 yamaha', '125cc Pit Bike',
    'Honda CBR125 motorcycle with full-face helmet', 'Triumph Bonneville grab rail fitted',
    'Harley Davidson Softail with chrome footboards', 'BMW R1200GS with panniers',
    'BMW R1200GS motorcycle with 2 panniers', 'Honda CBR125 motorcycle with 2 helmets',
    'Yamaha motorcycle luggage rack fitted', 'Royal Enfield Meteor exhaust fitted',
    'Honda PCX 125 with topbox', 'BMW R1300GS with heated low front seat',
  ];
  for (const title of titles) {
    const item = listing(title);
    assert.deepEqual(ids(h.filterCarListings([item], { vehicleType: 'motorbikes', hideUnwanted: true })), [item.id], title);
    assert.equal(h.pricePicks([item]).length, 1, title);
  }
});

test('the optional hide filter can be disabled without admitting accessories into price picks', () => {
  const items = liveAccessories.map(([title, price], index) => listing(title, price, index));
  assert.deepEqual(ids(h.filterCarListings(items, { vehicleType: 'motorbikes', hideUnwanted: false, maxPrice: '1000', sort: 'price_desc' })), [...items].reverse().map(item => item.id));
  assert.equal(h.pricePicks(items).length, 0);
  assert.deepEqual(ids(h.filterCarListings(items, { vehicleType: 'motorbikes', hideUnwanted: false, maxPrice: '29' })), [items[0].id]);
});

test('new accessory checks apply only to the motorbike vehicle mode', () => {
  const item = listing('2018 Ford Focus with grab bar full MOT');
  assert.deepEqual(ids(h.filterCarListings([item], { vehicleType: 'cars', hideUnwanted: true, maxPrice: '1000' })), [item.id]);
});

test('an accessory-filled first provider page is backfilled with matching bikes within the existing budget', async () => {
  const apiItem = (title, price, index) => ({
    itemId: `v1|${123456789000 + index}|0`, title,
    itemWebUrl: `https://www.ebay.co.uk/itm/${123456789000 + index}`,
    price: { value: price, currency: 'GBP' }, buyingOptions: ['FIXED_PRICE'],
  });
  const first = Array.from({ length: 48 }, (_, index) => apiItem(...liveAccessories[index % 3], index));
  const second = [
    apiItem('Honda CBR125 motorcycle full MOT', '950', 48),
    apiItem('Gabbiano Turismo 50cc Moped', '700', 49),
    apiItem('Yamaha motorcycle', '1000.01', 50),
  ];
  const api = harness(url => Number(url.searchParams.get('offset')) === 0
    ? Response.json({ itemSummaries: first, next: 'https://api.ebay.com/buy/browse/v1/item_summary/search?offset=48' })
    : Response.json({ itemSummaries: second }));
  const response = await api.get();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.items.map(item => item.title), ['Gabbiano Turismo 50cc Moped', 'Honda CBR125 motorcycle full MOT']);
  assert.deepEqual(body.searchInfo, { checkedCount: 51, pagesChecked: 2, hasMore: false, partial: false });
  assert.deepEqual(api.calls.map(call => call.url.searchParams.get('offset')), ['0', '48']);
  for (const { url } of api.calls) {
    assert.equal(url.origin, 'https://api.ebay.com');
    assert.equal(url.searchParams.get('category_ids'), '422');
    assert.equal(url.searchParams.get('filter'), 'itemLocationCountry:GB,price:[..1000],priceCurrency:GBP');
    assert.equal(url.searchParams.get('sort'), 'price');
  }
});
