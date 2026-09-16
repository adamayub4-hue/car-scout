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

function requestsHarness() {
  const requests = [], events = [], timers = new Map();
  const state = { items: [], loading: false, error: '', mode: 'cars' };
  const ref = { current: { id: 0, controller: null } };
  let timerId = 0;
  const context = {
    ebayRequest: ref, setEbayLoading: value => { state.loading = value; }, setEbayError: value => { state.error = value; }, setEbayItems: value => { state.items = value; },
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
  const setters = Object.fromEntries(['Mode', 'PartMethod', 'Make', 'Model', 'Year', 'Price', 'Postcode', 'Platform', 'Engine', 'Fuel', 'BodyStyle', 'Part', 'PartCategory', 'PartNumber', 'VehicleDetailsOpen', 'RestoredSearch'].map(key => [`set${key}`, value => { state[key] = value; }]));
  const code = ts.transpileModule(`const restore = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const restore = vm.runInNewContext(`${code}\nrestore`, {
    URLSearchParams, parseSavedSearchParams: saved.parseSavedSearchParams, categories: guide.categories, validatedPartSelection: handler('validatedPartSelection', guide),
    trackGrowthEvent() {}, ...setters, ebayRequest: { current: { id: 0, controller: null } },
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
