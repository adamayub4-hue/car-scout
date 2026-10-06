import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadModule(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, URL, URLSearchParams });
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

function carSubmitHarness(overrides = {}) {
  const requests = [], events = [];
  const state = { error: '', submitted: null, visible: false, revision: 0, searchInfo: null };
  const context = {
    make: '', model: '', year: '', price: '5000', minPrice: '1000', carSort: 'price_asc', hideUnwanted: true, postcode: '', platform: 'all',
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

test('changing result sort uses the submitted search snapshot, preserving its budget and saved state', () => {
  const submitted = search.createCarSearch({ make: 'Ford', model: 'Fiesta', year: '2018', price: '5000', minPrice: '1000', sort: 'price_asc', hideUnwanted: true, postcode: 'SW1A 1AA', platform: 'all' });
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
  assert.equal(new URL(nextSearch.carLinks.autotrader).searchParams.get('make'), 'Ford');
});

function requestsHarness() {
  const requests = [], events = [], timers = new Map();
  const state = { items: [], loading: false, error: '', mode: 'cars', searchInfo: null };
  const ref = { current: { id: 0, controller: null } };
  let timerId = 0;
  const context = {
    filterCarListings: carFilters.filterCarListings, ebayRequest: ref, setEbayLoading: value => { state.loading = value; }, setEbayError: value => { state.error = value; }, setEbayItems: value => { state.items = value; },
    setCarSearchInfo: value => { state.searchInfo = value; },
    setMode: value => { state.mode = value; }, setShowResults() {}, setError() {},
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
  const setters = Object.fromEntries(['Mode', 'PartMethod', 'Make', 'Model', 'Year', 'Price', 'MinPrice', 'CarSort', 'HideUnwanted', 'Postcode', 'Platform', 'Engine', 'Fuel', 'BodyStyle', 'Part', 'PartCategory', 'PartNumber', 'VehicleDetailsOpen', 'RestoredSearch'].map(key => [`set${key}`, value => { state[key] = value; }]));
  const code = ts.transpileModule(`const restore = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const restore = vm.runInNewContext(`${code}\nrestore`, {
    URLSearchParams, parseSavedSearchParams: saved.parseSavedSearchParams, categories: guide.categories, validatedPartSelection: handler('validatedPartSelection', guide),
    trackGrowthEvent() {}, ...setters, ebayRequest: { current: { id: 0, controller: null } }, guideLandingPending: { current: false },
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
  const result = search.createCarSearch({ make: '', model: '', year: '', price: '5000', minPrice: '1500', sort: 'price_desc', hideUnwanted: true, postcode: '', platform: 'all' });
  const state = restoreFromUrl(new URL(saved.getSavedSearchUrl(result.saveItem), 'https://mekivo.uk').search);
  assert.equal(state.Make, ''); assert.equal(state.Price, '5000'); assert.equal(state.MinPrice, '1500');
  assert.equal(state.CarSort, 'price_desc'); assert.equal(state.HideUnwanted, true); assert.equal(state.RestoredSearch, true);
  const old = restoreFromUrl('?restore=1&mode=cars&make=Audi&price=12000');
  assert.equal(old.Make, 'Audi'); assert.equal(old.Price, '12000'); assert.equal(old.MinPrice, '');
  assert.equal(old.CarSort, 'best_match'); assert.equal(old.HideUnwanted, false);
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
