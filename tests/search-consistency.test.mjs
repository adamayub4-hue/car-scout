import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const modules = new Map();
function loadModule(path) {
  const file = new URL(path, import.meta.url);
  if (modules.has(file.href)) return modules.get(file.href);
  const source = readFileSync(file, 'utf8');
  const exports = {};
  modules.set(file.href, exports);
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, URL, URLSearchParams, require: name => loadModule(new URL(`${name}.ts`, file).href) });
  return exports;
}
const search = loadModule('../app/lib/search.ts');
const carFilters = loadModule('../app/lib/car-filters.ts');
const saved = loadModule('../app/lib/saved-search.ts');
const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('page.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(name, context) {
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) expression = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return vm.runInNewContext(`${code}\nrun`, { URLSearchParams, AbortController, Error, ...context });
}
const fields = { make: 'Ford', model: 'Fiesta', year: '2018', engine: '1.0L', fuel: 'Petrol', bodyStyle: 'Hatchback', partCategory: 'Brakes', part: 'Brake Pads', partNumber: ' 1K0 698 151 F ', partMethod: 'diagram' };

test('direct OEM search has one consistent number-only result, saved item and outbound URL', () => {
  const result = search.createPartSearch(fields, true);
  assert.equal(result.query, '1K0 698 151 F'); assert.equal(result.title, result.query);
  assert.equal(result.saveItem.title, result.title);
  assert.equal(new URL(result.fallbackUrl).searchParams.get('_nkw'), result.query);
  assert.equal(result.saveItem.data.link, result.fallbackUrl);
  for (const key of ['make', 'model', 'year', 'engine', 'fuel', 'bodyStyle', 'part', 'partCategory']) assert.equal(result.saveItem.data[key], '', key);
  const restored = saved.parseSavedSearchParams(new URL(saved.getSavedSearchUrl(result.saveItem), 'https://mekivo.uk').searchParams);
  assert.equal(restored.searchMethod, 'part_number'); assert.equal(restored.partNumber, result.query); assert.equal(restored.make, '');
});

test('vehicle-based part search preserves vehicle and part context across every destination', () => {
  const result = search.createPartSearch({ ...fields, partNumber: '' });
  assert.match(result.query, /2018 Ford Fiesta/); assert.match(result.query, /Brake Pads/);
  assert.equal(new URL(result.fallbackUrl).searchParams.get('_nkw'), result.query);
  assert.equal(result.saveItem.data.link, result.fallbackUrl);
  assert.equal(result.saveItem.title, result.title);
  const restored = saved.parseSavedSearchParams(new URL(saved.getSavedSearchUrl(result.saveItem), 'https://mekivo.uk').searchParams);
  assert.equal(restored.make, fields.make); assert.equal(restored.part, fields.part); assert.equal(restored.partMethod, fields.partMethod);
});

test('eBay car handoff uses actual budget and category filters rather than price keywords', () => {
  const result = search.createCarSearch({ make: 'Ford', model: 'Fiesta', year: '2018', price: '5000', postcode: 'SW1A 1AA', platform: 'all' });
  const url = new URL(result.fallbackUrl);
  assert.equal(url.searchParams.get('_udhi'), '5000'); assert.equal(url.searchParams.get('_sacat'), '9801'); assert.equal(url.searchParams.get('_stpos'), 'SW1A 1AA');
  assert.equal(url.searchParams.get('_nkw'), result.query); assert.doesNotMatch(result.query, /under|near|5000/);
  assert.equal(result.maxPrice, '5000'); assert.equal(result.saveItem.data.links.ebay, result.fallbackUrl);
});

test('keyword handoffs keep vehicle wording separate from budget and location filters', () => {
  const cases = [
    { make: '', model: '', year: '', price: '500', minPrice: '', postcode: '', expected: '' },
    { make: 'Volkswagen', model: 'Golf', year: '', price: '5000', minPrice: '', postcode: 'B1 1AA', expected: 'Volkswagen Golf' },
    { make: 'Ford', model: 'Fiesta', year: '2018', price: '7500', minPrice: '1000', postcode: 'B1 1AA', expected: 'Ford Fiesta 2018' },
  ];
  const keywordDestinations = [['facebook', 'query'], ['gumtree', 'q'], ['pistonheads', 'keywords'], ['aacars', 'keywordsearch'], ['carandclassic', 'q']];
  for (const input of cases) {
    const result = search.createCarSearch({ ...input, platform: 'all' });
    for (const [marketplace, key] of keywordDestinations) {
      const params = new URL(result.carLinks[marketplace]).searchParams;
      const expected = input.expected || (marketplace === 'facebook' ? 'cars' : marketplace === 'aacars' || marketplace === 'pistonheads' ? null : '');
      assert.equal(params.get(key), expected, `${marketplace}: ${input.expected || 'browse any car'}`);
      assert.doesNotMatch(params.get(key) || '', /£|\b(?:under|from|near)\b|B1 1AA/);
      if (marketplace === 'pistonheads' || marketplace === 'aacars') assert.equal(params.has('keyword'), false, `${marketplace} must not use the ignored singular parameter`);
      if (marketplace === 'carandclassic') assert.equal(params.has('search'), false, 'Car & Classic must not use the ignored search parameter');
      if (marketplace === 'aacars') {
        assert.equal(params.get('pricefrom'), input.minPrice || null);
        assert.equal(params.get('priceto'), input.price);
        assert.match(search.marketplaceFilterNote(marketplace), /Price range carried across; year is a search term/);
      } else if (marketplace === 'pistonheads') {
        assert.deepEqual(params.getAll('price'), [input.minPrice || '0', input.price], 'PistonHeads requires ordered lower and upper price values');
        assert.match(search.marketplaceFilterNote(marketplace), /Maximum price and any accompanying minimum carried across/);
      } else assert.match(search.marketplaceFilterNote(marketplace), /Check budget, year and location filters/);
    }
    const ebay = new URL(result.carLinks.ebay).searchParams;
    assert.equal(ebay.get('_nkw'), [input.make, input.model, input.year].filter(Boolean).join(' '));
    assert.equal(ebay.get('_sacat'), '9801');
    assert.equal(ebay.get('_udhi'), input.price);
    assert.equal(ebay.get('_udlo'), input.minPrice || null);
    assert.equal(ebay.get('_stpos'), input.postcode || null);
    const autotrader = new URL(result.carLinks.autotrader).searchParams;
    assert.equal(autotrader.get('make'), input.make || null);
    assert.equal(autotrader.get('model'), input.model || null);
    assert.equal(autotrader.get('price-to'), input.price);
    assert.equal(autotrader.get('postcode'), input.postcode || null);
    assert.equal(autotrader.get('year-from'), input.year || null);
    assert.equal(autotrader.get('year-to'), input.year || null);
  }
});

test('PistonHeads carries an ordered price pair only when the search includes a maximum', () => {
  for (const bounds of [{ minPrice: '', price: '' }, { minPrice: '1000', price: '' }, { minPrice: '', price: '500' }, { minPrice: '1000', price: '7500' }, { minPrice: '10000', price: '50000' }]) {
    const result = search.createCarSearch({ make: 'Porsche', model: '911', year: '2018', postcode: 'B1 1AA', platform: 'pistonheads', carExtras: ['heated_seats'], ...bounds });
    const params = new URL(result.carLinks.pistonheads).searchParams;
    assert.equal(params.get('keywords'), 'Porsche 911 2018 Heated seats');
    assert.deepEqual(params.getAll('price'), bounds.price ? [bounds.minPrice || '0', bounds.price] : []);
    assert.equal(params.has('keyword'), false);
  }
  for (const hasExtras of [false, true]) {
    const note = search.marketplaceFilterNote('pistonheads', hasExtras);
    assert.match(note, /Maximum price and any accompanying minimum carried across/);
    assert.match(note, /Set a minimum-only budget there/);
    assert.match(note, /location, sorting and other filters on PistonHeads/);
  }
  assert.match(search.marketplaceFilterNote('pistonheads', true), /Year and selected extras are search terms/);
});

test('AA Cars carries optional exact price bounds independently of vehicle and equipment keywords', () => {
  for (const bounds of [{ minPrice: '', price: '' }, { minPrice: '1000', price: '' }, { minPrice: '', price: '500' }, { minPrice: '1000', price: '10000' }]) {
    const result = search.createCarSearch({ make: 'Ford', model: 'Fiesta', year: '2018', postcode: 'B1 1AA', platform: 'aacars', carExtras: ['heated_seats'], ...bounds });
    const params = new URL(result.carLinks.aacars).searchParams;
    assert.equal(params.get('keywordsearch'), 'Ford Fiesta 2018 Heated seats');
    assert.equal(params.get('pricefrom'), bounds.minPrice || null);
    assert.equal(params.get('priceto'), bounds.price || null);
    assert.equal(params.has('keyword'), false);
  }
  assert.match(search.marketplaceFilterNote('aacars', true), /Price range carried across; year and selected extras are search terms/);
  for (const hasExtras of [false, true]) assert.match(search.marketplaceFilterNote('aacars', hasExtras), /location, sorting and other filters on AA Cars/);
});

test('CarGurus opens its current search page without pretending that vehicle filters were carried across', () => {
  for (const carExtras of [[], ['heated_seats', 'panoramic_roof']]) {
    const result = search.createCarSearch({ make: 'Ford', model: 'Fiesta', year: '2018', price: '7500', minPrice: '1000', postcode: 'B1 1AA', platform: 'cargurus', carExtras });
    assert.equal(result.carLinks.cargurus, 'https://www.cargurus.co.uk/shop/used');
    assert.equal(new URL(result.carLinks.cargurus).search, '');
    assert.equal(search.marketplaceFilterNote('cargurus', carExtras.length > 0), 'Choose make and model on CarGurus, then set your budget, year, extras and location there.');
    assert.equal(result.saveItem.data.make, 'Ford', 'Mekivo retains the selected criteria even when the destination requires manual filters');
    assert.equal(result.saveItem.data.price, '7500');
  }
});

test('Facebook handoff discloses personal-profile access and manual marketplace filters', () => {
  for (const hasExtras of [false, true]) {
    const note = search.marketplaceFilterNote('facebook', hasExtras);
    assert.match(note, /personal Facebook profile with Marketplace access/);
    assert.match(note, /Check budget, year and location filters on Facebook/);
    assert.equal(note.includes('including selected extras'), hasExtras);
  }
});

test('car extras are canonical copied selections while the submitted query keeps its vehicle criteria', () => {
  const input = { make: 'Volkswagen', model: 'Golf', year: '2018', price: '5000', postcode: '', platform: 'all', carExtras: ['panoramic_roof', 'heated_seats', 'heated_seats', 'invalid', 'owner@example.test'] };
  const before = JSON.stringify(input);
  const result = search.createCarSearch(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(result.query, 'Volkswagen Golf 2018');
  assert.deepEqual(Array.from(result.carExtras), ['heated_seats', 'panoramic_roof']);
  assert.deepEqual(Array.from(result.saveItem.data.carExtras), ['heated_seats', 'panoramic_roof']);
  assert.notEqual(result.carExtras, input.carExtras);
  assert.notEqual(result.carExtras, result.saveItem.data.carExtras);
  input.carExtras.push('bluetooth');
  result.carExtras.push('leather_seats');
  assert.deepEqual(Array.from(result.saveItem.data.carExtras), ['heated_seats', 'panoramic_roof']);
  for (const carExtras of [undefined, [], ['unknown']]) {
    const empty = search.createCarSearch({ ...input, carExtras });
    assert.equal(Object.hasOwn(empty, 'carExtras'), false);
    assert.equal(Object.hasOwn(empty.saveItem.data, 'carExtras'), false);
  }
});

test('keyword marketplace handoffs include selected extras but structured-only handoffs disclose their limits', () => {
  const result = search.createCarSearch({ make: 'Volkswagen', model: 'Golf', year: '2018', price: '5000', postcode: 'B1 1AA', platform: 'all', carExtras: ['heated_seats', 'panoramic_roof'] });
  for (const [marketplace, key] of [['ebay', '_nkw'], ['facebook', 'query'], ['gumtree', 'q'], ['pistonheads', 'keywords'], ['aacars', 'keywordsearch'], ['carandclassic', 'q']]) {
    const query = new URL(result.carLinks[marketplace]).searchParams.get(key);
    assert.match(query, /Heated seats/); assert.match(query, /Panoramic roof/);
    assert.doesNotMatch(query, /\(|\)|\bOR\b|heated_seats|panoramic_roof/);
    assert.doesNotMatch(query, /£|\b(?:under|from|near)\b|B1 1AA/);
  }
  const autotrader = new URL(result.carLinks.autotrader);
  assert.equal(autotrader.searchParams.get('make'), 'Volkswagen');
  assert.equal(autotrader.searchParams.get('price-to'), '5000');
  assert.doesNotMatch(result.carLinks.autotrader, /heated|panoramic|extras/i);
  assert.doesNotMatch(result.carLinks.motors, /heated|panoramic|extras/i);
  for (const id of ['autotrader', 'motors']) assert.match(search.marketplaceFilterNote(id, true), /Reapply selected extras/);
  assert.match(search.marketplaceFilterNote('ebay', true), /extras are search terms/);
  assert.match(search.marketplaceFilterNote('gumtree', true), /keyword search including selected extras/);
  assert.equal(search.marketplaceFilterNote('ebay'), 'Price range carried across; year is a search term. Check sorting, unwanted listings and distance on eBay.');
});

test('part searches discard stale car extras without changing the source fields', () => {
  const input = { ...fields, carExtras: ['heated_seats'] }, before = JSON.stringify(input);
  for (const direct of [false, true]) {
    const result = search.createPartSearch(input, direct);
    assert.equal(Object.hasOwn(result, 'carExtras'), false);
    assert.equal(Object.hasOwn(result.saveItem.data, 'carExtras'), false);
    assert.doesNotMatch(result.query, /heated/i);
    assert.doesNotMatch(result.fallbackUrl, /heated/i);
  }
  assert.equal(JSON.stringify(input), before);
});

function carSubmitHarness(overrides = {}) {
  const requests = [], events = [];
  const state = { error: '', submitted: null, visible: false, revision: 0, searchInfo: null };
  const context = {
    vehicleType: 'cars', make: '', model: '', year: '', price: '5000', minPrice: '1000', carSort: 'price_asc', hideUnwanted: true, carExtras: [], postcode: '', platform: 'all',
    createCarSearch: search.createCarSearch,
    setError: value => { state.error = value; }, setSubmittedSearch: value => { state.submitted = value; },
    setShowResults: value => { state.visible = value; }, setCarSearchRevision: update => { state.revision = update(state.revision); },
    setCarSearchInfo: value => { state.searchInfo = value; },
    searchEbay: value => { requests.push(value); }, trackGrowthEvent: (...args) => events.push(args), trackActivity() {},
    ...overrides,
  };
  return { state, requests, events, run: handler('handleCarSearch', context) };
}

test('inverted car budgets show an error without changing results or sending a search', async () => {
  const app = carSubmitHarness({ minPrice: '6000', price: '5000' });
  await app.run();
  assert.match(app.state.error, /Minimum price must not be higher/);
  assert.equal(app.state.submitted, null); assert.equal(app.state.visible, false); assert.equal(app.state.revision, 0);
  assert.deepEqual(app.requests, []); assert.deepEqual(app.events, []);
});

test('budget-only car search accepts any make and preserves the selected filters', async () => {
  const app = carSubmitHarness();
  await app.run();
  assert.equal(app.state.error, ''); assert.equal(app.state.visible, true); assert.equal(app.requests.length, 1);
  const submitted = app.requests[0];
  assert.equal(submitted.title, 'All cars'); assert.equal(submitted.query, '');
  assert.equal(submitted.minPrice, '1000'); assert.equal(submitted.maxPrice, '5000');
  assert.equal(submitted.carSort, 'price_asc'); assert.equal(submitted.hideUnwanted, true);
  assert.equal(app.state.submitted, submitted);
  assert.deepEqual(app.events.map(([name]) => name), ['search_submitted']);
});

test('a marketplace-only car submission discards metadata from the previous live search', async () => {
  const controller = new AbortController();
  const ebayRequest = { current: { id: 7, controller } };
  const app = carSubmitHarness({ platform: 'more', ebayRequest, setEbayLoading() {} });
  app.state.searchInfo = { checkedCount: 144, pagesChecked: 3, hasMore: true, partial: true };
  await app.run();
  assert.equal(app.state.searchInfo, null);
  assert.equal(controller.signal.aborted, true);
  assert.equal(ebayRequest.current.id, 8);
  assert.equal(app.requests.length, 0);
  assert.equal(app.state.submitted.platform, 'more');
});

test('changing result sort uses the submitted search snapshot, preserving its budget, extras and saved state', () => {
  const submitted = search.createCarSearch({ make: 'Ford', model: 'Fiesta', year: '2018', price: '5000', minPrice: '1000', sort: 'price_asc', hideUnwanted: true, carExtras: ['heated_seats'], postcode: 'SW1A 1AA', platform: 'all' });
  const before = JSON.stringify(submitted), calls = [];
  let selectedSort, nextSearch;
  const change = handler('handleCarSortChange', {
    submittedSearch: submitted, createCarSearch: search.createCarSearch,
    make: 'Audi', model: 'A3', year: '2025', price: '30000', minPrice: '', postcode: 'B1 1AA', platform: 'autotrader', hideUnwanted: false,
    setCarSort: value => { selectedSort = value; }, setSubmittedSearch: value => { nextSearch = value; }, searchEbay: value => calls.push(value),
  });
  change('newest');
  assert.equal(selectedSort, 'newest'); assert.equal(calls.length, 1); assert.equal(calls[0], nextSearch);
  assert.equal(nextSearch.query, submitted.query); assert.equal(nextSearch.minPrice, '1000'); assert.equal(nextSearch.maxPrice, '5000');
  assert.equal(nextSearch.hideUnwanted, true); assert.equal(nextSearch.platform, 'all'); assert.equal(nextSearch.saveItem.data.postcode, 'SW1A 1AA');
  assert.equal(nextSearch.saveItem.data.sort, 'newest'); assert.equal(JSON.stringify(submitted), before);
  assert.deepEqual(Array.from(nextSearch.carExtras), ['heated_seats']);
  assert.deepEqual(Array.from(nextSearch.saveItem.data.carExtras), ['heated_seats']);
  assert.equal(new URL(nextSearch.carLinks.autotrader).searchParams.get('make'), 'Ford');
});

function requestsHarness() {
  const requests = [], events = [], timers = new Map();
  const state = { items: [], loading: false, error: '', mode: 'cars', searchInfo: null, carExtras: ['heated_seats'] };
  const ref = { current: { id: 0, controller: null } };
  let timerId = 0;
  const context = {
    filterCarListings: carFilters.filterCarListings, ebayRequest: ref, setEbayLoading: value => { state.loading = value; }, setEbayError: value => { state.error = value; }, setEbayItems: value => { state.items = value; },
    setCarSearchInfo: value => { state.searchInfo = value; },
    setMode: value => { state.mode = value; }, setShowResults() {}, setError() {},
    setVehicleType() {}, setPlatform() {}, setMake() {}, setModel() {}, setYear() {}, setEngine() {}, setFuel() {}, setBodyStyle() {}, setCarExtras: value => { state.carExtras = value; },
    setRegistration() {}, setVehicleLookup() {}, setSubmittedSearch() {}, setRestoredSearch() {}, setVehicleDetailsOpen() {},
    setPartMethod() {}, setPartCategory() {}, setPart() {}, setPartNumber() {}, setVehicleLookupLoading() {},
    vehicleLookupRequest: { current: { id: 0, controller: null } },
    trackGrowthEvent: (...args) => events.push(args),
    setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    // Deliberately ignore AbortSignal: correctness must also rely on request identity.
    fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })),
  };
  return { state, requests, events, timers, ref, run: handler('searchEbay', context), setMode: handler('setAppMode', context) };
}
const oldSearch = search.createCarSearch({ make: 'Ford', model: 'Fiesta', year: '', price: '', postcode: '', platform: 'all' });
const newSearch = search.createPartSearch(fields, true);
const response = title => ({ ok: true, json: async () => ({ items: [{ id: title, title }] }) });
const responseWithInfo = (searchInfo, title = 'Ford Fiesta') => ({ ok: true, json: async () => ({
  items: [{ id: title, title, price: '450', currency: 'GBP', condition: 'Used', buyingOptions: ['FIXED_PRICE'] }], searchInfo,
}) });

test('live car request sends selected filters and counts only the filtered visible response', async () => {
  const app = requestsHarness();
  const submitted = search.createCarSearch({ make: '', model: '', year: '', price: '5000', minPrice: '1000', sort: 'price_asc', hideUnwanted: true, postcode: '', platform: 'all' });
  const pending = app.run(submitted);
  const params = new URL(app.requests[0].url, 'https://local.test').searchParams;
  assert.equal(params.get('type'), 'cars'); assert.equal(params.get('q'), '');
  assert.equal(params.get('minPrice'), '1000'); assert.equal(params.get('maxPrice'), '5000');
  assert.equal(params.get('sort'), 'price_asc'); assert.equal(params.get('hideUnwanted'), '1');
  const item = (id, title, price) => ({ id, title, price, currency: 'GBP', condition: 'Used', buyingOptions: ['FIXED_PRICE'] });
  app.requests[0].resolve({ ok: true, json: async () => ({ items: [
    item('a', 'Ford Fiesta', '4000'), item('b', 'Audi A3 deposit only', '1500'), item('c', 'Vauxhall Corsa', '2000'), item('d', 'Expensive car', '6000'),
  ] }) });
  await pending;
  assert.deepEqual(Array.from(app.state.items, item => item.id), ['c', 'a']);
  assert.equal(app.events.length, 1); assert.equal(app.events[0][0], 'results_shown'); assert.equal(app.events[0][1].result_count, 2);
  assert.equal(app.state.error, ''); assert.equal(app.state.loading, false);
});

test('selected make/model are sent from the submitted search and unrelated suggestions are hidden', async () => {
  const app = requestsHarness();
  const submitted = search.createCarSearch({ make: 'Volkswagen', model: 'Golf', year: '', price: '5000', postcode: '', platform: 'all' });
  const pending = app.run(submitted);
  const params = new URL(app.requests[0].url, 'https://local.test').searchParams;
  assert.equal(params.get('make'), 'Volkswagen'); assert.equal(params.get('model'), 'Golf');
  const item = (id, title) => ({ id, title, price: '4500', currency: 'GBP', buyingOptions: ['FIXED_PRICE'] });
  app.requests[0].resolve({ ok: true, json: async () => ({ items: [item('golf', 'VW Golf GTI'), item('polo', 'Volkswagen Polo')] }) });
  await pending;
  assert.deepEqual(Array.from(app.state.items, item => item.id), ['golf']);
  assert.equal(app.events[0][1].result_count, 1);
});

test('selected extras reach the API from the submitted snapshot and all must match returned advert wording', async () => {
  const app = requestsHarness();
  const submitted = search.createCarSearch({ make: '', model: '', year: '', price: '5000', postcode: '', platform: 'all', carExtras: ['heated_seats', 'panoramic_roof'] });
  const pending = app.run(submitted);
  const params = new URL(app.requests[0].url, 'https://local.test').searchParams;
  assert.equal(params.get('q'), '');
  assert.equal(params.get('extras'), 'heated_seats,panoramic_roof');
  const item = (id, title, shortDescription) => ({ id, title, shortDescription, price: '4500', currency: 'GBP', buyingOptions: ['FIXED_PRICE'] });
  app.requests[0].resolve({ ok: true, json: async () => ({ items: [
    item('match', 'Volkswagen Golf heated seats', 'Panoramic roof'),
    item('missing', 'Volkswagen Golf heated seats', null),
    item('negated', 'Volkswagen Golf panoramic roof', 'No heated seats'),
  ] }) });
  await pending;
  assert.deepEqual(Array.from(app.state.items, item => item.id), ['match']);
  assert.equal(app.events[0][1].result_count, 1);
  app.setMode('parts');
  assert.deepEqual(Array.from(app.state.carExtras), [], 'changing mode clears retained car extras');
});

test('successful partial metadata is kept with matching cars and reset immediately for a new search', async () => {
  const h = requestsHarness();
  const info = { checkedCount: 96, pagesChecked: 2, hasMore: true, partial: true };
  const first = h.run(oldSearch);
  h.requests[0].resolve(responseWithInfo(info)); await first;
  assert.equal(h.state.searchInfo, info);
  assert.equal(h.state.items[0].title, 'Ford Fiesta');
  assert.equal(h.state.error, '');
  assert.deepEqual(h.events.map(([name]) => name), ['results_shown']);
  const next = h.run(oldSearch);
  assert.equal(h.state.searchInfo, null, 'old checked counts and partial status disappear before the new request returns');
  assert.equal(h.state.items.length, 0);
  assert.equal(h.state.loading, true);
  h.requests[1].resolve(responseWithInfo(undefined, 'New Ford Fiesta')); await next;
  assert.equal(h.state.searchInfo, null, 'a response without metadata cannot inherit the previous counts');
  assert.equal(h.state.items[0].title, 'New Ford Fiesta');
});

test('an older car response cannot overwrite a newer response or its checked-listing metadata', async () => {
  const h = requestsHarness();
  const old = h.run(oldSearch), latest = h.run(oldSearch);
  const latestInfo = { checkedCount: 144, pagesChecked: 3, hasMore: false, partial: false };
  h.requests[1].resolve(responseWithInfo(latestInfo, 'Current Ford Fiesta')); await latest;
  h.requests[0].resolve(responseWithInfo({ checkedCount: 48, pagesChecked: 1, hasMore: true, partial: true }, 'Stale Ford Fiesta')); await old;
  assert.equal(h.state.searchInfo, latestInfo);
  assert.equal(h.state.items[0].title, 'Current Ford Fiesta');
  assert.equal(h.state.loading, false);
  assert.equal(h.events.length, 1);
});

test('mode changes clear completed car metadata and a late car response cannot restore it', async () => {
  const h = requestsHarness();
  const first = h.run(oldSearch);
  h.requests[0].resolve(responseWithInfo({ checkedCount: 96, pagesChecked: 2, hasMore: true, partial: true })); await first;
  h.setMode('parts');
  assert.equal(h.state.searchInfo, null);
  assert.equal(h.state.items.length, 0);
  h.setMode('cars');
  const pending = h.run(oldSearch);
  h.setMode('parts');
  h.requests[1].resolve(responseWithInfo({ checkedCount: 192, pagesChecked: 4, hasMore: true, partial: true })); await pending;
  assert.equal(h.state.searchInfo, null);
  assert.equal(h.state.items.length, 0);
  assert.equal(h.state.mode, 'parts');
  assert.equal(h.events.length, 1, 'only the first completed search emits a result event');
});

test('parts and failed searches cannot adopt car checked-listing metadata from a response', async () => {
  const info = { checkedCount: 192, pagesChecked: 4, hasMore: true, partial: true };
  const h = requestsHarness();
  const part = h.run(newSearch);
  h.requests[0].resolve(responseWithInfo(info, 'Brake pads')); await part;
  assert.equal(h.state.searchInfo, null);
  assert.equal(h.state.items[0].title, 'Brake pads');
  const car = h.run(oldSearch);
  h.requests[1].resolve({ ok: false, json: async () => ({ error: 'eBay unavailable', searchInfo: info }) }); await car;
  assert.equal(h.state.searchInfo, null);
  assert.equal(h.state.items.length, 0);
  assert.equal(h.state.error, 'eBay unavailable');
});

test('an old response cannot replace results or stop the newer search loading', async () => {
  const h = requestsHarness();
  const old = h.run(oldSearch), latest = h.run(newSearch);
  assert.equal(h.requests[0].options.signal.aborted, true);
  h.requests[0].resolve(response('Old car')); await old;
  assert.equal(h.state.loading, true); assert.equal(h.state.items.length, 0); assert.equal(h.events.length, 0);
  h.requests[1].resolve(response('Correct part')); await latest;
  assert.equal(h.state.loading, false); assert.equal(h.state.items[0].title, 'Correct part'); assert.equal(h.events.length, 1);
});

test('an old rejection cannot overwrite a successful newer search', async () => {
  const h = requestsHarness();
  const old = h.run(oldSearch), latest = h.run(newSearch);
  h.requests[1].resolve(response('Correct part')); await latest;
  h.requests[0].reject(Error('Old request failed')); await old;
  assert.equal(h.state.items[0].title, 'Correct part'); assert.equal(h.state.error, ''); assert.equal(h.events.length, 1);
});

test('switching modes invalidates and clears the in-flight search', async () => {
  const h = requestsHarness();
  const old = h.run(oldSearch);
  h.setMode('parts');
  assert.equal(h.state.mode, 'parts'); assert.equal(h.requests[0].options.signal.aborted, true); assert.equal(h.state.loading, false);
  h.requests[0].resolve(response('Stale car')); await old;
  assert.equal(h.state.items.length, 0); assert.equal(h.state.error, ''); assert.equal(h.events.length, 0);
});

test('a timed-out response cannot become a successful result if fetch resolves late', async () => {
  const h = requestsHarness();
  const pending = h.run(newSearch);
  [...h.timers.values()][0]();
  assert.equal(h.requests[0].options.signal.aborted, true);
  h.requests[0].resolve(response('Late part')); await pending;
  assert.equal(h.state.items.length, 0); assert.equal(h.state.loading, false); assert.match(h.state.error, /too long|timed out/i);
  assert.ok(!h.events.some(([name]) => name === 'results_shown'));
});

test('an HTML rate-limit response shows retry guidance without trying to parse JSON', async () => {
  const h = requestsHarness();
  let jsonCalls = 0;
  const pending = h.run(newSearch);
  h.requests[0].resolve({ ok: false, status: 429, json: async () => { jsonCalls++; throw new SyntaxError('Unexpected token <'); } });
  await pending;
  assert.equal(jsonCalls, 0);
  assert.equal(h.state.error, 'Too many searches. Please wait a minute, then try again.');
  assert.equal(h.state.loading, false); assert.equal(h.state.items.length, 0); assert.equal(h.timers.size, 0);
  assert.deepEqual(h.events.map(([name]) => name), ['results_error']);
});

test('an old rate-limit response cannot overwrite a newer result', async () => {
  const h = requestsHarness();
  const old = h.run(oldSearch), latest = h.run(newSearch);
  h.requests[1].resolve(response('Correct part')); await latest;
  h.requests[0].resolve({ ok: false, status: 429, json: async () => { throw new SyntaxError('HTML response'); } });
  await old;
  assert.equal(h.state.items[0].title, 'Correct part'); assert.equal(h.state.error, ''); assert.equal(h.state.loading, false);
  assert.deepEqual(h.events.map(([name]) => name), ['results_shown']);
});

test('an HTML registration rate limit clears loading and explains when to retry', async () => {
  let jsonCalls = 0, loading = false, error = '', vehicle = { make: 'Ford' };
  const lookup = handler('handleVehicleLookup', {
    registration: 'AB12CDE',
    vehicleLookupRequest: { current: { id: 0, controller: null } },
    setVehicleLookupLoading: value => { loading = value; }, setVehicleLookup: value => { vehicle = value; }, setError: value => { error = value; },
    fetch: async () => ({ ok: false, status: 429, json: async () => { jsonCalls++; throw new SyntaxError('Unexpected token <'); } }),
  });
  await lookup();
  assert.equal(jsonCalls, 0); assert.equal(loading, false); assert.equal(vehicle, null);
  assert.equal(error, 'Too many registration lookups. Please wait a minute, then try again.');
});

test('listing image URLs only allow the expected HTTPS eBay image host and path', () => {
  assert.equal(search.safeListingImage('https://i.ebayimg.com/images/g/example/s-l500.jpg'), 'https://i.ebayimg.com/images/g/example/s-l500.jpg');
  for (const value of [null, 'javascript:alert(1)', 'data:image/svg+xml,abc', 'http://i.ebayimg.com/images/a.jpg', 'https://i.ebayimg.com.evil.test/images/a.jpg', 'https://i.ebayimg.com:8443/images/a.jpg', 'https://i.ebayimg.com/not-images/a.jpg']) assert.equal(search.safeListingImage(value), null, String(value));
});

function restoreFromUrl(query) {
  const guide = loadModule('../app/lib/parts-guide-data.ts');
  let expression;
  function visit(node) {
    if (!expression && ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') expression = node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(expression);
  const state = {};
  const setters = Object.fromEntries(['Mode', 'VehicleType', 'PartMethod', 'Make', 'Model', 'Year', 'Price', 'MinPrice', 'CarSort', 'HideUnwanted', 'CarExtras', 'Postcode', 'Platform', 'Engine', 'Fuel', 'BodyStyle', 'Part', 'PartCategory', 'PartNumber', 'VehicleDetailsOpen', 'RestoredSearch'].map(key => [`set${key}`, value => { state[key] = value; }]));
  const code = ts.transpileModule(`const restore = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const restore = vm.runInNewContext(`${code}\nrestore`, {
    URLSearchParams, parseSavedSearchParams: saved.parseSavedSearchParams, categories: guide.categories, validatedPartSelection: handler('validatedPartSelection', guide),
    trackGrowthEvent() {}, ...setters, ebayRequest: { current: { id: 0, controller: null } }, vehicleLookupRequest: { current: { id: 0, controller: null } }, guideLandingPending: { current: false },
    window: { location: { search: query }, requestAnimationFrame: fn => { fn(); return 1; }, cancelAnimationFrame() {} },
  });
  restore()();
  return state;
}

test('saved search restoration prefills the selected vehicle and part without submitting', () => {
  const result = search.createPartSearch({ ...fields, partNumber: '' });
  const state = restoreFromUrl(new URL(saved.getSavedSearchUrl(result.saveItem), 'https://mekivo.uk').search);
  assert.equal(state.Mode, 'parts'); assert.equal(state.Make, 'Ford'); assert.equal(state.Part, 'Brake Pads'); assert.equal(state.PartCategory, 'Brakes'); assert.equal(state.PartMethod, 'diagram'); assert.equal(state.RestoredSearch, true);
});

test('saved car filters restore without a request, and old saved searches retain their original broad behaviour', () => {
  const result = search.createCarSearch({ make: '', model: '', year: '', price: '5000', minPrice: '1500', sort: 'price_desc', hideUnwanted: true, carExtras: ['heated_seats', 'panoramic_roof'], postcode: '', platform: 'all' });
  const state = restoreFromUrl(new URL(saved.getSavedSearchUrl(result.saveItem), 'https://mekivo.uk').search);
  assert.equal(state.Make, ''); assert.equal(state.Price, '5000'); assert.equal(state.MinPrice, '1500');
  assert.equal(state.CarSort, 'price_desc'); assert.equal(state.HideUnwanted, true); assert.equal(state.RestoredSearch, true);
  assert.deepEqual(Array.from(state.CarExtras), ['heated_seats', 'panoramic_roof']);
  const old = restoreFromUrl('?restore=1&mode=cars&make=Audi&price=12000');
  assert.equal(old.Make, 'Audi'); assert.equal(old.Price, '12000'); assert.equal(old.MinPrice, '');
  assert.equal(old.CarSort, 'best_match'); assert.equal(old.HideUnwanted, false);
  assert.deepEqual(Array.from(old.CarExtras), []);
});

test('shared criteria restore the exact part-number suffix and car budget without private location or a submission', () => {
  const partSearch = search.createPartSearch({ ...fields, partNumber: '1K0 698 151 F' }, true);
  const partUrl = saved.getSharedSearchUrl(partSearch.saveItem);
  const partState = restoreFromUrl(new URL(partUrl, 'https://local.test').search);
  assert.equal(partState.PartNumber, '1K0 698 151 F');
  assert.equal(partState.PartMethod, 'search'); assert.equal(partState.VehicleDetailsOpen, false);
  for (const key of ['Make', 'Model', 'Year', 'Engine', 'Fuel', 'BodyStyle', 'Part', 'PartCategory']) assert.equal(partState[key], '', key);
  const carSearch = search.createCarSearch({ make: 'Ford', model: 'Fiesta', year: '2018', minPrice: '1500', price: '5000', sort: 'price_desc', hideUnwanted: true, postcode: 'SW1A 1AA', platform: 'ebay' });
  const carState = restoreFromUrl(new URL(saved.getSharedSearchUrl(carSearch.saveItem), 'https://local.test').search);
  assert.equal(carState.Make, 'Ford'); assert.equal(carState.Model, 'Fiesta'); assert.equal(carState.Year, '2018');
  assert.equal(carState.MinPrice, '1500'); assert.equal(carState.Price, '5000'); assert.equal(carState.CarSort, 'price_desc');
  assert.equal(carState.HideUnwanted, true); assert.equal(carState.Platform, 'ebay'); assert.equal(carState.Postcode, '');
  assert.equal(carState.RestoredSearch, true);
});

test('restoration rejects inherited category keys and unknown platform or method values', () => {
  const state = restoreFromUrl('?restore=1&mode=parts&make=Ford&model=Fiesta&year=2018&category=toString&part_method=catalogue&platform=javascript%3Aalert%281%29');
  assert.equal(state.PartCategory, ''); assert.equal(state.Platform, 'all');
  const parsed = saved.parseSavedSearchParams(new URLSearchParams('?restore=1&mode=parts&part_method=constructor'));
  assert.equal(parsed.partMethod, 'search');
});


test('restored electric diagrams reject combustion parts and accept their electric equivalents', () => {
  const state = restoreFromUrl('?restore=1&mode=parts&make=Tesla&model=Model%203&year=2021&fuel=Electric&category=Electrical&part=Alternator&part_method=diagram');
  assert.equal(state.PartCategory, 'Electrical'); assert.equal(state.Part, '');
  const engine = restoreFromUrl('?restore=1&mode=parts&fuel=Electric&category=Engine&part=Oil%20Filter&part_method=diagram');
  assert.equal(engine.PartCategory, ''); assert.equal(engine.Part, '');
  const valid = restoreFromUrl('?restore=1&mode=parts&fuel=Electric&category=Electrical&part=Drive%20Motor&part_method=diagram');
  assert.equal(valid.Part, 'Drive Motor');
});

test('diagram selections survive ordinary vehicle editing but clear when power type changes', () => {
  for (const [before, after, shouldClear] of [['Petrol', 'Electric', true], ['Electric', '', true], ['Electric', 'Petrol', true], ['Petrol', '', false], ['', 'Petrol', false]]) {
    let category = 'Electrical', part = 'Alternator', method = 'diagram';
    const reset = handler('resetPartsBelowVehicle', { partMethod: method, fuel: before, setPartMethod: value => { method = value; }, setPartCategory: value => { category = value; }, setPart: value => { part = value; }, setPartNumber() {}, setShowResults() {}, setError() {} });
    reset(after);
    assert.equal(category, shouldClear ? '' : 'Electrical', `${before} to ${after}`); assert.equal(part, shouldClear ? '' : 'Alternator'); assert.equal(method, 'diagram');
  }
});

test('model suggestions handle inherited names and unknown makes without crashing', () => {
  let expression;
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'datalist' && node.openingElement.attributes.properties.some(attribute => attribute.name?.getText(ast) === 'id' && attribute.initializer?.text === 'manual-model-options')) expression = node.children.find(ts.isJsxExpression).expression.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(expression);
  const code = ts.transpileModule(`exports.run = (make) => (${expression});`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, makes: handler('makes', {}), require: () => ({ jsx: (type, props) => ({ type, props }) }) });
  assert.equal(exports.run('constructor'), false); assert.equal(exports.run('toString'), false); assert.equal(exports.run('Unknown Motors'), false);
  assert.ok(exports.run('Ford').some(option => option.props.value === 'Fiesta'));
});

test('registration lookup invalidates a retained diagram part when DVLA identifies an electric vehicle', async () => {
  const state = { part: 'Alternator', category: 'Electrical', fuel: 'Petrol' };
  const common = { partMethod: 'diagram', fuel: 'Petrol', setPartMethod() {}, setPartCategory: value => { state.category = value; }, setPart: value => { state.part = value; }, setPartNumber() {}, setShowResults() {}, setError() {} };
  const lookup = handler('handleVehicleLookup', {
    ...common, registration: 'AB12CDE', makes: handler('makes', {}), resetPartsBelowVehicle: handler('resetPartsBelowVehicle', common),
    vehicleLookupRequest: { current: { id: 0, controller: null } },
    setVehicleLookupLoading() {}, setVehicleLookup() {}, setRegistration() {}, setMake() {}, setModel() {}, setYear() {}, setEngine() {}, setBodyStyle() {}, setFuel: value => { state.fuel = value; }, trackGrowthEvent() {}, trackActivity() {},
    fetch: async () => ({ ok: true, json: async () => ({ vehicle: { make: 'Tesla', model: 'Model 3', yearOfManufacture: 2021, fuelType: 'ELECTRICITY' } }) }),
  });
  await lookup();
  assert.equal(state.fuel, 'Electricity'); assert.equal(state.part, ''); assert.equal(state.category, '');
});

test('opening the picture guide clears an earlier direct OEM number', () => {
  let expression;
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'button' && node.getText(ast).includes('Find a part by picture')) expression = node.openingElement.attributes.properties.find(attribute => attribute.name?.getText(ast) === 'onClick').initializer.expression.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(expression);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  let number = '1K0698151F', method = 'search';
  const run = vm.runInNewContext(`${code}\nrun`, { setPartMethod: value => { method = value; }, setPartNumber: value => { number = value; }, setShowResults() {}, setError() {}, requestAnimationFrame: fn => fn(), guideRef: { current: null } });
  run(); assert.equal(method, 'diagram'); assert.equal(number, '');
});
