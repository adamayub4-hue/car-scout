import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const modules = new Map();
function load(relative) {
  const filename = resolve(root, relative.endsWith('.ts') ? relative : `${relative}.ts`);
  if (modules.has(filename)) return modules.get(filename);
  const exports = {}; modules.set(filename, exports);
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, URL, URLSearchParams, Date, setTimeout, clearTimeout, crypto: webcrypto, require: name => load(resolve(dirname(filename), name)) }, { filename });
  return exports;
}
const search = load('app/lib/search.ts'), saved = load('app/lib/saved-search.ts'), listings = load('app/lib/saved-listings.ts');
const plain = value => JSON.parse(JSON.stringify(value));
const fields = { make: 'Honda', model: 'CBR600', year: '2018', price: '5000', minPrice: '1000', sort: 'price_asc', hideUnwanted: true, postcode: 'SW1A 1AA', platform: 'all' };
const bike = changes => search.createCarSearch({ ...fields, vehicleType: 'motorbikes', ...changes });
const listing = { id: 'v1|123456789012|0', title: 'Honda CBR600 motorcycle', url: 'https://www.ebay.co.uk/itm/123456789012?campid=seller&customid=private', image: null, price: '2995.00', currency: 'GBP', condition: 'Used', location: 'GB' };
const params = url => new URL(url, 'https://mekivo.uk').searchParams;

test('default and explicit cars preserve every existing destination, field and saved URL', () => {
  const original = search.createCarSearch(fields), explicit = search.createCarSearch({ ...fields, vehicleType: 'cars' });
  assert.deepEqual(plain(explicit), plain(original));
  assert.equal(Object.hasOwn(original, 'vehicleType'), false);
  assert.equal(Object.hasOwn(original.saveItem.data, 'vehicleType'), false);
  assert.equal(new URL(original.fallbackUrl).searchParams.get('_sacat'), '9801');
  assert.equal(Object.keys(original.carLinks).length, 9);
  const url = saved.getSavedSearchUrl(original.saveItem);
  assert.equal(params(url).has('vehicle_type'), false);
  assert.equal(saved.parseSavedSearchParams(params(url)).vehicleType, undefined);
  assert.equal(saved.getSavedSearchUrl(explicit.saveItem), url);
});

test('motorbike searches use only the UK motorcycle eBay category with exact budgets and affiliate tags', () => {
  for (const platform of ['all', 'ebay', 'motors', 'more', 'autotrader']) {
    const input = { ...fields, vehicleType: 'motorbikes', platform }, before = plain(input);
    const result = search.createCarSearch(input), url = new URL(result.fallbackUrl);
    assert.deepEqual(plain(input), before, 'normalization never changes the form fields');
    assert.equal(result.mode, 'cars'); assert.equal(result.vehicleType, 'motorbikes');
    assert.equal(result.platform, 'ebay'); assert.equal(result.saveItem.kind, 'car_search');
    assert.equal(result.saveItem.data.platform, 'ebay'); assert.equal(result.saveItem.data.vehicleType, 'motorbikes');
    assert.deepEqual(Object.keys(result.carLinks), ['ebay']);
    assert.equal(result.saveItem.data.links.ebay, result.fallbackUrl);
    assert.equal(url.hostname, 'www.ebay.co.uk'); assert.equal(url.searchParams.get('_sacat'), '422');
    assert.equal(url.searchParams.get('_nkw'), 'Honda CBR600 2018');
    assert.equal(url.searchParams.get('_udlo'), '1000'); assert.equal(url.searchParams.get('_udhi'), '5000');
    assert.equal(url.searchParams.get('_stpos'), 'SW1A 1AA');
    assert.equal(url.searchParams.get('customid'), 'mekivo-motorbike-search');
    assert.equal(url.searchParams.get('campid'), '5339201924');
  }
  const any = bike({ make: '', model: '', year: '' });
  assert.equal(any.title, 'All motorbikes'); assert.equal(any.query, '');
  assert.equal(new URL(any.fallbackUrl).searchParams.get('_sacat'), '422');
});

test('saved search and safe local return links preserve motorcycle choice and filters with eBay-only restoration', () => {
  const item = bike().saveItem, url = saved.getSavedSearchUrl(item), restored = saved.parseSavedSearchParams(params(url));
  assert.equal(params(url).get('vehicle_type'), 'motorbikes');
  for (const key of ['make', 'model', 'year', 'price', 'minPrice', 'sort', 'hideUnwanted', 'postcode']) assert.equal(restored[key], fields[key], key);
  assert.equal(restored.platform, 'ebay'); assert.equal(restored.vehicleType, 'motorbikes');
  assert.equal(saved.safeSearchReturnUrl(`${url}&redirect=https%3A%2F%2Fevil.test&access_token=secret`), url);
  for (const platform of ['motors', 'facebook', 'all', 'constructor', '']) {
    const raw = `/?restore=1&mode=cars&vehicle_type=motorbikes&platform=${platform}&price=3000`;
    assert.equal(saved.parseSavedSearchParams(params(raw)).platform, 'ebay');
    assert.equal(params(saved.safeSearchReturnUrl(raw)).get('platform'), 'ebay');
  }
});

test('unknown or parts-only subtype inputs cannot silently change a legacy search', () => {
  for (const vehicleType of ['cars', 'bikes', 'motorbikes<script>', 'constructor', '']) {
    const input = params(`/?restore=1&mode=cars&vehicle_type=${encodeURIComponent(vehicleType)}&platform=autotrader`);
    assert.equal(saved.parseSavedSearchParams(input).vehicleType, undefined);
    assert.equal(saved.parseSavedSearchParams(input).platform, 'autotrader');
    assert.equal(params(saved.safeSearchReturnUrl(`/?${input}`)).has('vehicle_type'), false);
  }
  const item = { kind: 'part_search', title: 'Part search', data: { vehicleType: 'motorbikes', partNumber: '1K0 698 151 F', searchMethod: 'part_number' } };
  for (const url of [saved.getSavedSearchUrl(item), saved.getSharedSearchUrl(item)]) {
    assert.equal(params(url).get('mode'), 'parts'); assert.equal(params(url).has('vehicle_type'), false);
    assert.equal(saved.parseSavedSearchParams(params(url)).vehicleType, undefined);
  }
});

test('shared motorcycle searches retain public criteria while excluding postcode, identity and provider metadata', () => {
  const item = bike().saveItem;
  Object.assign(item.data, { registration: 'AB12 CDE', vin: 'WVWZZZ1KZAW123456', email: 'owner@example.test', access_token: 'private-token', userId: 'private-user', customid: 'private-campaign', platform: 'motors' });
  const before = plain(item), url = saved.getSharedSearchUrl(item), values = params(url);
  assert.equal(values.get('vehicle_type'), 'motorbikes'); assert.equal(values.get('platform'), 'ebay');
  assert.equal(values.get('make'), 'Honda'); assert.equal(values.get('model'), 'CBR600');
  assert.equal(values.get('price'), '5000'); assert.equal(values.get('min_price'), '1000');
  assert.equal(values.get('sort'), 'price_asc'); assert.equal(values.get('hide_unwanted'), '1');
  for (const key of ['postcode', 'registration', 'vin', 'email', 'access_token', 'userId', 'customid', 'links']) assert.equal(values.has(key), false, key);
  assert.deepEqual(plain(item), before);
});

test('motorbike listing saves keep the existing kind and derive their label from a safe motorcycle search URL', () => {
  const searchUrl = saved.getSavedSearchUrl(bike().saveItem), item = listings.createSavedListing(listing, 'motorbikes', searchUrl);
  assert.equal(item.kind, 'car_listing'); assert.equal(item.data.searchUrl, searchUrl);
  assert.equal(item.data.url, 'https://www.ebay.co.uk/itm/123456789012');
  assert.equal(listings.savedListingLabel(item), 'motorbike'); assert.equal(listings.savedListingSearchType(item), 'motorbikes');
  assert.equal(listings.savedListingLabel(listings.createSavedListing(listing, 'cars')), 'car');
  assert.equal(listings.savedListingLabel(listings.createSavedListing(listing, 'parts')), 'part');
  assert.deepEqual(plain(listings.parseSavedListing(item)), plain(item));
  for (const unsafe of [undefined, 'https://evil.test/', '//evil.test/', '/admin', '/?restore=1&mode=parts&part_number=private']) {
    const normalized = listings.createSavedListing(listing, 'motorbikes', unsafe);
    assert.equal(listings.savedListingLabel(normalized), 'motorbike');
    assert.equal(params(normalized.data.searchUrl).get('vehicle_type'), 'motorbikes');
    assert.equal(params(normalized.data.searchUrl).get('platform'), 'ebay');
    assert.equal(normalized.data.searchUrl.includes('evil'), false); assert.equal(normalized.data.searchUrl.includes('private'), false);
  }
});

test('pending motorcycle saves retain their subtype after provider snapshot expiry and account persistence', async () => {
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const now = 1_000_000, item = listings.createSavedListing(listing, 'motorbikes');
  const token = listings.stagePendingListing(item, storage, now), expired = listings.readPendingListing(token, storage, now + 6 * 60 * 60 * 1000);
  assert.equal(expired.title, 'Saved motorbike'); assert.equal(expired.data.price, null);
  assert.equal(listings.savedListingLabel(expired), 'motorbike');
  assert.equal(params(expired.data.searchUrl).get('vehicle_type'), 'motorbikes');
  let inserted;
  const client = { from() {
    const builder = {
      select() { return builder; }, eq() { return builder; }, maybeSingle: async () => ({ data: null, error: null }),
      insert(value) { inserted = value; return builder; }, single: async () => ({ data: { id: 'confirmed', ...inserted }, error: null }),
    };
    return builder;
  } };
  const result = await listings.saveListingToAccount(client, 'customer', expired);
  assert.equal(result.id, 'confirmed'); assert.equal(inserted.kind, 'car_listing'); assert.equal(inserted.title, 'Saved motorbike');
  assert.deepEqual(Object.keys(inserted.data).sort(), ['id', 'searchUrl', 'url', 'version']);
  assert.equal(listings.savedListingSearchType(listings.parseSavedListing(inserted)), 'motorbikes');
});
