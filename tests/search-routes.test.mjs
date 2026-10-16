import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, URL, URLSearchParams, require(name) {
    assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
    return imports[name];
  } });
  return exports;
}
const routes = load('../app/lib/search-routes.ts');
const extras = load('../app/lib/car-extras.ts');
const saved = load('../app/lib/saved-search.ts', { './car-extras': extras });
const edge = load('../proxy.ts', {
  './app/lib/search-routes': routes,
  'next/server': { NextResponse: {
    next: () => ({ kind: 'next' }),
    redirect: (url, status) => ({ kind: 'redirect', url: String(url), status }),
  } },
});
function redirect(url) {
  const nextUrl = new URL(url, 'https://mekivo.uk');
  nextUrl.clone = () => new URL(nextUrl.href);
  return edge.proxy({ nextUrl });
}
const plain = value => JSON.parse(JSON.stringify(value));

test('legacy campaign and guide links select the same search journey without redirecting ordinary Home visits', () => {
  for (const [query, expected] of [
    ['', null],
    ['utm_source=facebook&utm_medium=organic_social&utm_content=week_budget_v1', null],
    ['utm_source=ig&utm_medium=social&utm_content=link_in_bio', null],
    ['analytics=off', null],
    ['mode=cars&utm_content=budget_car', '/cars'],
    ['mode=parts&utm_content=part_number', '/parts'],
    ['mode=parts&guide=1&utm_content=followon_shape_v1', '/parts'],
    ['mode=cars&vehicle_type=motorbikes', '/motorbikes'],
    ['vehicle_type=motorbikes', '/motorbikes'],
    ['restore=1&make=Ford&model=Fiesta', '/cars'],
    ['mode=parts&vehicle_type=motorbikes', '/parts'],
    ['mode=https://untrusted.test', null],
    ['mode=other&vehicle_type=cars&restore=0', null],
  ]) assert.equal(routes.legacySearchPath(new URLSearchParams(query)), expected, query);
  assert.equal(edge.config.matcher, '/', 'only the legacy root entry is intercepted');
  assert.equal(redirect('/?utm_source=facebook').kind, 'next');
});

test('redirects preserve campaign labels, repeated parameters and analytics exclusion without modifying the input', () => {
  const input = 'https://www.mekivo.uk/?mode=parts&guide=1&utm_source=facebook&utm_medium=organic_social&utm_campaign=october_followon&utm_content=followon_shape_v1&analytics=off&x=one&x=two';
  const result = redirect(input);
  assert.equal(result.kind, 'redirect'); assert.equal(result.status, 307);
  const before = new URL(input), after = new URL(result.url);
  assert.equal(after.origin, before.origin); assert.equal(after.pathname, '/parts');
  assert.equal(after.search, before.search);
  assert.deepEqual(after.searchParams.getAll('x'), ['one', 'two']);
  assert.equal(after.searchParams.get('analytics'), 'off');
});

test('existing private saved searches restore identical car, bike and parts criteria after routing', () => {
  const examples = [
    ['car_search', { make: 'Volkswagen', model: 'Golf', year: '2018', price: '5000', minPrice: '1000', sort: 'price_asc', hideUnwanted: true, carExtras: ['heated_seats'], platform: 'facebook', postcode: 'B1 1AA' }, '/cars'],
    ['car_search', { vehicleType: 'motorbikes', make: 'Honda', model: 'CBR600F', price: '2000', platform: 'ebay' }, '/motorbikes'],
    ['part_search', { make: 'Audi', model: 'A5', year: '2014', engine: '2.0L', fuel: 'Diesel', part: 'Brake Pads', partCategory: 'Braking', partMethod: 'catalogue' }, '/parts'],
    ['part_search', { searchMethod: 'part_number', partNumber: '06J115403Q' }, '/parts'],
  ];
  for (const [kind, data, path] of examples) {
    const oldUrl = new URL(saved.getSavedSearchUrl({ kind, title: 'Saved search', data }), 'https://mekivo.uk');
    const result = redirect(oldUrl.href);
    const nextUrl = new URL(result.url);
    assert.equal(nextUrl.pathname, path);
    assert.equal(nextUrl.search, oldUrl.search);
    assert.deepEqual(plain(saved.parseSavedSearchParams(nextUrl.searchParams)), plain(saved.parseSavedSearchParams(oldUrl.searchParams)));
    assert.equal(nextUrl.searchParams.has('run'), false, 'restoring never opts into an automatic search');
  }
});

test('shared search privacy survives routing and does not opt in to automatic execution', () => {
  const item = { kind: 'car_search', title: 'Share', data: { make: 'Ford', model: 'Fiesta', price: '1000', platform: 'facebook', postcode: 'B1 1AA', registration: 'AB12CDE', ownerToken: 'secret', run: '1' } };
  const oldUrl = new URL(saved.getSharedSearchUrl(item), 'https://mekivo.uk');
  const nextUrl = new URL(redirect(oldUrl.href).url);
  assert.equal(nextUrl.pathname, '/cars'); assert.equal(nextUrl.search, oldUrl.search);
  for (const key of ['postcode', 'registration', 'ownerToken', 'run']) assert.equal(nextUrl.searchParams.has(key), false, key);
  assert.equal(nextUrl.searchParams.get('platform'), 'facebook', 'external marketplace choice remains editable');
});
