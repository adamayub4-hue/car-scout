import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

const repo = fileURLToPath(new URL('../', import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const NOW = Date.parse('2026-09-21T12:00:00Z');
class ClockDate extends Date { static now() { return NOW; } }

function harness({ fetch: fetchMock } = {}) {
  const modules = new Map(), events = [];
  function load(relativePath) {
    let filename = resolve(repo, relativePath);
    if (!existsSync(filename)) filename += existsSync(`${filename}.ts`) ? '.ts' : '.tsx';
    if (modules.has(filename)) return modules.get(filename);
    const exports = {};
    modules.set(filename, exports);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(code, {
      exports, URL, URLSearchParams, Buffer, AbortController, Date: ClockDate, setTimeout, clearTimeout,
      console: { error() {} }, process: { env: { EBAY_CLIENT_ID: 'test-client', EBAY_CLIENT_SECRET: 'test-secret' } },
      fetch: fetchMock ?? (() => { throw new Error('Unexpected network request'); }),
      require(name) {
        if (name === 'react') return React;
        if (name === 'react/jsx-runtime') return jsxRuntime;
        if (name === 'next/image') return { default: ({ src, alt }) => React.createElement('img', { src, alt }) };
        if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
        if (name.endsWith('/growth-events')) return { trackGrowthEvent: (...args) => events.push(args) };
        if (name.startsWith('node:')) return nativeRequire(name);
        if (name.startsWith('.')) return load(resolve(dirname(filename), name));
        throw new Error(`Unexpected import: ${name}`);
      },
    }, { filename });
    return exports;
  }
  const search = load('app/lib/search.ts');
  const helpers = load('app/lib/car-recommendations.ts');
  return {
    ...search, ...helpers, load, events,
    render(props) {
      const Component = load('app/components/car-recommendations.tsx').default;
      const tree = Component(props);
      return { tree, html: renderToStaticMarkup(tree) };
    },
  };
}

const h = harness();
const carSearch = changes => h.createCarSearch({ make: 'Ford', model: 'Fiesta', year: '2018', price: '5000', postcode: 'SW1A 1AA', platform: 'all', ...changes });
const car = (index = 1, changes = {}) => ({
  id: `v1|${123456789000 + index}|0`, title: '2018 Ford Fiesta Zetec 1.0 Petrol',
  url: `https://www.ebay.co.uk/itm/${123456789000 + index}`, image: 'https://i.ebayimg.com/images/g/test/s-l500.jpg',
  price: '4500', currency: 'GBP', condition: 'Used', location: 'GB',
  buyingOptions: ['FIXED_PRICE'], itemEndDate: null, ...changes,
});
const shortlist = (items, search = carSearch()) => h.getCarRecommendations(items, search, NOW);
const ids = items => Array.from(items, result => result.item.id);
const props = changes => ({ search: carSearch(), items: [car()], loading: false, error: '', ...changes });

function elements(tree, type) {
  const matches = [];
  function visit(element) {
    if (!React.isValidElement(element)) return;
    if (element.type === type) matches.push(element);
    React.Children.forEach(element.props.children, visit);
  }
  visit(tree);
  return matches;
}

test('shortlist orders positive advertised GBP amounts numerically, keeps only three and preserves general results', () => {
  const items = [car(1, { price: '10000' }), car(2, { price: '999.99' }), car(3, { price: '2500.50' }), car(4, { price: '999.90' }), car(5, { price: '12', currency: 'EUR' })];
  const before = structuredClone(items);
  const result = shortlist(items, carSearch({ price: '' }));
  assert.deepEqual(ids(result), [items[3].id, items[1].id, items[2].id]);
  assert.deepEqual(Array.from(result, item => item.pricePence), [99990, 99999, 250050]);
  assert.deepEqual(items, before);
  assert.ok(result.every(item => item.belowBudgetPence === null));
});

test('budget gap is exact, inclusive at the maximum and never a claimed discount', () => {
  const result = shortlist([car(1, { price: '4999.99' }), car(2, { price: '5000' }), car(3, { price: '5000.01' })]);
  assert.equal(result.length, 2);
  assert.equal(result[0].belowBudgetPence, 1);
  assert.equal(result[1].belowBudgetPence, null);
  for (const price of ['not a number', '-10', '0', 'Infinity']) assert.equal(shortlist([car()], carSearch({ price })).length, 0);
});

test('missing, malformed and non-GBP prices cannot be recommended', () => {
  for (const price of [null, undefined, '', ' ', '0', '-1', 'NaN', 'Infinity', '1e3', '£500', '1,000', '999.999', '9007199254740992', 500]) {
    assert.equal(shortlist([car(1, { price })]).length, 0, String(price));
  }
  for (const currency of [null, undefined, '', 'EUR', 'USD', 'gbp']) assert.equal(shortlist([car(1, { currency })]).length, 0, String(currency));
});

test('fixed-price, classified and auction-with-Buy-It-Now listings use purchase price, never a bid', () => {
  for (const [buyingOptions, format] of [
    [['FIXED_PRICE'], 'Fixed price'], [['CLASSIFIED_AD'], 'Classified ad'], [['AUCTION', 'FIXED_PRICE'], 'Fixed price'],
  ]) {
    const result = shortlist([car(1, { buyingOptions, currentBidPrice: { value: '1', currency: 'GBP' } })]);
    assert.equal(result[0].purchaseFormat, format);
    assert.equal(result[0].pricePence, 450000);
  }
  for (const buyingOptions of [[], undefined, null, 'FIXED_PRICE', ['AUCTION'], ['BEST_OFFER'], ['UNKNOWN']]) {
    assert.equal(shortlist([car(1, { buyingOptions, currentBidPrice: { value: '1', currency: 'GBP' } })]).length, 0);
  }
  assert.equal(shortlist([car(1, { price: null, currentBidPrice: { value: '100', currency: 'GBP' } })]).length, 0);
});

test('make, complete model tokens and selected vehicle year must match the submitted search', () => {
  for (const title of ['2018 Vauxhall Corsa', '2018 Ford Focus', '2017 Ford Fiesta', 'Ford Fiesta Zetec', '2012 Ford Fiesta MOT until 2018', '2018 Ford Fiesta 2018-2022']) {
    assert.equal(shortlist([car(1, { title })]).length, 0, title);
  }
  assert.equal(shortlist([car(1, { title: '2018 Audi A30' })], carSearch({ make: 'Audi', model: 'A3' })).length, 0);
  assert.equal(shortlist([car(1, { title: '2018 FORD FIESTA ST-Line MOT 2027' })]).length, 1);
});

test('common make aliases, accents, hyphens and letter-number model spacing remain useful matches', () => {
  for (const [make, model, title] of [
    ['Volkswagen', 'Golf', '2018 VW Golf TSI'], ['Citroen', 'C3', '2018 Citroën C3'],
    ['Mazda', 'Mazda3', '2018 Mazda 3 Sport'], ['Mercedes', 'A Class', '2018 Mercedes-Benz A-Class'],
    ['Land Rover', 'Range Rover', '2018 Range Rover Vogue'], ['Honda', 'CR-V', '2018 Honda CR V'],
  ]) assert.equal(shortlist([car(1, { title })], carSearch({ make, model })).length, 1, title);
});

test('optional model and year allow an honest make-only shortlist without matching other makes', () => {
  const result = shortlist([car(1, { title: 'Ford Focus Zetec' }), car(2, { title: '2012 Ford Mondeo' }), car(3, { title: '2018 Audi A3' })], carSearch({ model: '', year: '' }));
  assert.equal(result.length, 2);
  assert.equal(shortlist([car()], carSearch({ make: '' })).length, 0);
  assert.equal(shortlist([car()], carSearch({ make: 'constructor' })).length, 0);
});

test('parts, salvage, repair, deposits and monthly finance offers never populate the full-car shortlist', () => {
  for (const suffix of [
    'bumper', 'brake pads', 'key fob', 'engine only', 'engine complete', 'gearbox complete', 'spares or repair',
    'breaking', 'salvage', 'damaged', 'non-runner', 'CAT S', 'CAT-S', 'Category-N', 'write-off', 'no MOT',
    'deposit £199', '£99 pcm', '£199 a month', '£199 each month', 'finance only', 'lease', 'monthly payment',
    '1:43 model', 'scale model', 'diecast', 'toy car',
  ]) {
    const title = `2018 Ford Fiesta ${suffix}`;
    assert.equal(shortlist([car(1, { title })]).length, 0, title);
  }
  assert.equal(shortlist([car(1, { condition: 'For parts or not working' })]).length, 0);
  assert.equal(shortlist([car(1, { title: '2018 Ford Fiesta part exchange welcome' })]).length, 1);
  assert.equal(shortlist([car(1, { title: '2018 Ford Fiesta finance available' })]).length, 1);
});

test('expired or malformed end dates are excluded while Good Til Cancelled and future dates remain eligible', () => {
  for (const itemEndDate of ['2026-09-20T12:00:00Z', '2026-09-21T12:00:00Z', 'bad date']) {
    assert.equal(shortlist([car(1, { itemEndDate })]).length, 0);
  }
  for (const itemEndDate of [null, undefined, '2026-09-22T12:00:00Z']) assert.equal(shortlist([car(1, { itemEndDate })]).length, 1);
});

test('recommendation destinations require HTTPS eBay listing paths without credentials or foreign hosts', () => {
  for (const url of [
    'https://www.ebay.co.uk/itm/123456789012', 'https://www.ebay.com/itm/Ford-Fiesta/123456789012?hash=test',
    'https://ebay.co.uk/itm/123456789012', 'https://m.ebay.co.uk/itm/123456789012',
  ]) assert.ok(h.safeEbayListingUrl(url), url);
  for (const url of [
    'javascript:alert(1)', 'http://www.ebay.co.uk/itm/123456789012', 'https://www.ebay.co.uk.evil.test/itm/123456789012',
    'https://evil.test/itm/123456789012', 'https://www.ebay.co.uk:8443/itm/123456789012',
    'https://owner@www.ebay.co.uk/itm/123456789012', 'https://www.ebay.co.uk/login', 'https://www.ebay.co.uk/sch/i.html',
    'https://www.ebay.co.uk/itm/not-an-item', '//www.ebay.co.uk/itm/123456789012',
  ]) {
    assert.equal(h.safeEbayListingUrl(url), null, url);
    assert.equal(shortlist([car(1, { url })]).length, 0, url);
  }
});

test('duplicate eBay item IDs across equivalent domains do not fill the shortlist twice', () => {
  const result = shortlist([car(1), car(1, { id: 'different-api-id', url: 'https://www.ebay.com/itm/Car/123456789001' }), car(2)]);
  assert.equal(result.length, 2);
});

test('editing form inputs after submission cannot change recommendation criteria or budget', () => {
  const fields = { make: 'Ford', model: 'Fiesta', year: '2018', price: '5000', postcode: '', platform: 'all' };
  const submitted = h.createCarSearch(fields);
  Object.assign(fields, { make: 'Audi', model: 'A3', year: '2021', price: '1000', platform: 'facebook' });
  const result = shortlist([car(), car(2, { title: '2021 Audi A3', price: '999' })], submitted);
  assert.equal(result.length, 1);
  assert.equal(result[0].item.title, car().title);
  assert.equal(result[0].belowBudgetPence, 50000);
});

test('parts searches and other selected marketplaces cannot inherit old car recommendations', () => {
  const partSearch = h.createPartSearch({ make: 'Ford', model: 'Fiesta', year: '2018', engine: '', fuel: '', bodyStyle: '', part: 'Brake pads', partNumber: '', partCategory: 'Brakes', partMethod: 'diagram' });
  assert.equal(shortlist([car()], partSearch).length, 0);
  assert.equal(shortlist([car()], { ...carSearch(), carCriteria: undefined }).length, 0);
  for (const platform of ['facebook', 'autotrader', 'more', 'gumtree']) assert.equal(shortlist([car()], carSearch({ platform })).length, 0);
});

test('rendered shortlist states price scope, original seller, fees and budget difference without savings claims', () => {
  const { html, tree } = h.render(props());
  assert.match(html, /Lowest-priced matches/);
  assert.match(html, /matching eBay results returned/);
  assert.match(html, /Other marketplaces may have a better offer/);
  assert.match(html, /£4,500/);
  assert.match(html, /£500\.00 below your maximum/);
  assert.match(html, /Delivery and extra fees are not included/);
  assert.match(html, /may earn a commission/);
  assert.doesNotMatch(html, /guaranteed|cheapest in|save £|discount|star rating/i);
  const links = elements(tree, 'a');
  assert.equal(links.length, 1);
  const url = new URL(links[0].props.href);
  assert.equal(url.hostname, 'www.ebay.co.uk');
  assert.equal(url.searchParams.get('campid'), '5339201924');
  assert.equal(url.searchParams.get('customid'), 'mekivo-cars-shortlist');
  assert.match(links[0].props.rel, /sponsored/);
  const before = h.events.length;
  links[0].props.onClick();
  assert.equal(h.events.length, before + 1);
  assert.equal(h.events.at(-1)[0], 'marketplace_outbound');
  assert.deepEqual({ ...h.events.at(-1)[1] }, { marketplace: 'ebay', search_type: 'cars', destination: 'listing' });
});

test('loading and failed comparisons hide any older priced cards and preserve clear next steps', () => {
  const loading = h.render(props({ loading: true }));
  assert.equal(elements(loading.tree, 'a').length, 0);
  assert.match(loading.html, /Checking the returned eBay listings/);
  assert.doesNotMatch(loading.html, /£4,500/);
  const error = h.render(props({ error: 'Provider unavailable' }));
  assert.equal(elements(error.tree, 'a').length, 0);
  assert.match(error.html, /temporarily unavailable/);
  assert.match(error.html, /marketplace links below/);
  assert.doesNotMatch(error.html, /£4,500/);
});

test('empty, unpriced-marketplace and parts rendering never invent comparison prices', () => {
  const empty = h.render(props({ items: [car(1, { buyingOptions: ['AUCTION'] })] }));
  assert.match(empty.html, /couldn’t identify/);
  assert.equal(elements(empty.tree, 'a').length, 0);
  const other = h.render(props({ search: carSearch({ platform: 'facebook' }) }));
  assert.match(other.html, /Compare asking prices/);
  assert.match(other.html, /eBay only/);
  assert.doesNotMatch(other.html, /£4,500|Lowest-priced matches/);
  assert.equal(elements(other.tree, 'a').length, 0);
  assert.equal(h.render(props({ search: { ...carSearch(), mode: 'parts' } })).html, '');
});

test('the API maps buying options and end dates while preserving auction and parts rows in ordinary results', async () => {
  const requests = [];
  const summaries = [
    { itemId: 'fixed', title: '2018 Ford Fiesta', itemWebUrl: car().url, buyingOptions: ['FIXED_PRICE'], price: { value: '4500', currency: 'GBP' }, itemEndDate: '2026-10-01T00:00:00Z' },
    { itemId: 'auction', title: '2018 Ford Fiesta auction', itemWebUrl: car(2).url, buyingOptions: ['AUCTION'], currentBidPrice: { value: '100', currency: 'GBP' } },
    { itemId: 'part', title: '2018 Ford Fiesta engine complete', itemWebUrl: car(3).url, buyingOptions: ['FIXED_PRICE', 4, null], price: { value: '250', currency: 'GBP' } },
  ];
  const apiHarness = harness({ fetch: async (url, options) => {
    requests.push({ url: String(url), options });
    return String(url).includes('/oauth2/') ? Response.json({ access_token: 'test-token', expires_in: 7200 }) : Response.json({ itemSummaries: summaries });
  } });
  const route = apiHarness.load('app/api/ebay/search/route.ts');
  for (const type of ['cars', 'parts']) {
    const response = await route.GET({ nextUrl: new URL(`https://mekivo.uk/api/ebay/search?type=${type}&q=Ford+Fiesta`) });
    assert.equal(response.status, 200);
    const { items } = await response.json();
    assert.equal(items.length, 3, 'shortlist exclusions must not silently change general search results');
    assert.deepEqual(items[0].buyingOptions, ['FIXED_PRICE']);
    assert.equal(items[0].itemEndDate, '2026-10-01T00:00:00Z');
    assert.equal(items[1].price, null, 'current bid must never become purchase price');
    assert.deepEqual(items[1].buyingOptions, ['AUCTION']);
    assert.deepEqual(items[2].buyingOptions, ['FIXED_PRICE']);
  }
  const searches = requests.filter(request => request.url.includes('/item_summary/search'));
  assert.equal(new URL(searches[0].url).searchParams.get('category_ids'), '9801');
  assert.equal(new URL(searches[1].url).searchParams.get('category_ids'), '6030');
  for (const request of searches) assert.equal(new URL(request.url).searchParams.get('filter'), null);
});
