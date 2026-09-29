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
  const helpers = load('app/lib/part-recommendations.ts');
  return {
    ...search, ...helpers, load, events,
    render(props) {
      const Component = load('app/components/part-recommendations.tsx').default;
      const tree = Component(props);
      return { tree, html: renderToStaticMarkup(tree) };
    },
  };
}

const h = harness();
const fields = { make: 'Ford', model: 'Fiesta', year: '2018', engine: '', fuel: '', bodyStyle: '', part: 'Brake Disc', partNumber: '', partCategory: 'Brakes', partMethod: 'diagram' };
const search = changes => h.createPartSearch({ ...fields, ...changes });
const part = (index = 1, changes = {}) => ({ id: `id-${index}`, title: 'Ford Fiesta Brake Discs 2012-2018', url: `https://www.ebay.co.uk/itm/${123456789000 + index}`, image: null, price: '25.99', currency: 'GBP', condition: 'New', location: 'GB', buyingOptions: ['FIXED_PRICE'], ...changes });
const picks = (items, submitted = search()) => h.getPartRecommendations(items, submitted, NOW);
const props = changes => ({ search: search(), items: [part()], loading: false, error: '', ...changes });

test('part shortlist ranks numeric item prices only, never silently treats unknown postage as free', () => {
  const items = [part(1, { price: '19.99', postage: { price: '20', currency: 'GBP' } }), part(2, { price: '20', postage: { price: '0', currency: 'GBP' } }), part(3, { price: '9.90' }), part(4, { price: '50' })];
  const original = structuredClone(items), result = picks(items);
  assert.deepEqual(Array.from(result, entry => entry.item.id), ['id-3', 'id-1', 'id-2']);
  assert.deepEqual(Array.from(result, entry => entry.pricePence), [990, 1999, 2000]);
  assert.deepEqual(items, original);
  assert.equal(h.partPostageLabel(items[2]), 'Postage: check on eBay');
  assert.match(h.partPostageLabel(items[0]), /£20.00/);
  assert.match(h.partPostageLabel(items[1]), /Free postage shown/);
  for (const postage of [null, { price: '0', currency: 'EUR' }, { price: '-1', currency: 'GBP' }, { price: '', currency: 'GBP' }, { price: 'NaN', currency: 'GBP' }]) assert.equal(h.partPostageLabel(part(1, { postage })), 'Postage: check on eBay');
});

test('number matches require the complete number but allow printed spacing and separators', () => {
  const submitted = h.createPartSearch({ ...fields, partNumber: '1K0 698 151 F' }, true);
  for (const title of ['Brake pads 1K0698151F', '1K0-698-151-F brake pads', 'Brake pads 1K0.698.151.F']) assert.equal(picks([part(1, { title })], submitted).length, 1, title);
  for (const title of ['1K0698151FX pads', 'X1K0698151F pads', '1K0698151 pads', 'Ford Fiesta Brake Disc']) assert.equal(picks([part(1, { title })], submitted).length, 0, title);
  assert.equal(picks([part()], search({ partNumber: '12' })).length, 0);
});

test('named parts require whole make/model and all part words, without implying fitment from year ranges', () => {
  assert.equal(picks([part()]).length, 1);
  for (const title of ['Ford Focus Brake Discs', 'Ford Fiesta Brake Pads', 'Vauxhall Corsa Brake Discs', 'Ford Fiestavan Brake Discs', 'Ford Fiesta Brake Disc Screws', 'Ford Fiesta Brake Disc fitting kit', 'Ford Fiesta Brake Disc and Pad bundle']) assert.equal(picks([part(1, { title })]).length, 0, title);
  assert.equal(picks([part(1, { title: 'Ford Fiesta Brake Disc Screws' })], search({ part: 'Brake Disc Screws' })).length, 1);
  assert.equal(picks([part()], search({ part: '' })).length, 0);
  assert.equal(picks([part()], search({ model: '' })).length, 0);
  assert.equal(picks([part(1, { title: 'VW Golf brake discs' })], search({ make: 'Volkswagen', model: 'Golf' })).length, 1);
  const submitted = search(); fields.part = 'Oil Filter';
  assert.equal(picks([part()], submitted).length, 1, 'submitted criteria are a snapshot');
  fields.part = 'Brake Disc';
});

test('non-purchase prices, bids, broken parts, unsafe destinations and stale listings are excluded', () => {
  const invalid = [
    { currency: 'EUR' }, { price: null }, { price: '0' }, { price: '-1' }, { price: '1e3' }, { price: '1.999' }, { price: 'NaN' }, { price: '9007199254740992' },
    { buyingOptions: ['AUCTION'] }, { buyingOptions: [] }, { buyingOptions: null }, { buyingOptions: ['CLASSIFIED_AD'] },
    { condition: 'For parts or not working' }, { title: 'Ford Fiesta Brake Discs deposit' }, { title: 'Ford Fiesta Brake Discs repair service' },
    { url: 'https://evil.test/itm/123456789000' }, { url: 'http://www.ebay.co.uk/itm/123456789000' },
    { itemEndDate: '2026-09-20T00:00:00Z' }, { itemEndDate: 'invalid' },
  ];
  for (const override of invalid) assert.equal(picks([part(1, override)]).length, 0, JSON.stringify(override));
  assert.equal(picks([part(1, { buyingOptions: ['AUCTION', 'FIXED_PRICE'] })]).length, 1);
  assert.equal(picks([part(), part(2, { url: part().url })]).length, 1);
  assert.equal(picks([part()], { ...search(), mode: 'cars' }).length, 0);
});

test('rendered shortlist states price scope, fitment caveats and correct parts affiliate tracking', () => {
  const { html, tree } = h.render(props());
  assert.match(html, /Ranked by item price, before postage/);
  assert.match(html, /Postage: check on eBay/);
  assert.match(html, /Title matches do not confirm compatibility/);
  assert.match(html, /Brands, condition, quantity and side can differ/);
  assert.match(html, /only the returned eBay listings/);
  assert.match(html, /£25.99/);
  const links = [];
  function visit(node) { if (!React.isValidElement(node)) return; if (node.type === 'a') links.push(node); React.Children.forEach(node.props.children, visit); }
  visit(tree);
  assert.equal(links.length, 1);
  const url = new URL(links[0].props.href);
  assert.equal(url.searchParams.get('campid'), '5339201924');
  assert.equal(url.searchParams.get('customid'), 'mekivo-parts-shortlist');
  links[0].props.onClick();
  assert.deepEqual({ ...h.events.at(-1)[1] }, { marketplace: 'ebay', search_type: 'parts', destination: 'listing' });
  for (const override of [{ loading: true }, { error: 'Provider unavailable' }, { items: [] }]) {
    const state = h.render(props(override)).html;
    assert.doesNotMatch(state, /£25.99|\/itm\//);
  }
});

test('API exposes only explicit fixed postage, and never substitutes unknown or calculated shipping with zero', async () => {
  const shipping = [undefined, [], [{ shippingCostType: 'FIXED', shippingCost: { value: '0.00', currency: 'GBP' } }], [{ shippingCostType: 'FIXED', shippingCost: { value: '3.99', currency: 'GBP' } }], [{ shippingCostType: 'CALCULATED', shippingCost: { value: '0', currency: 'GBP' } }], [{ shippingCostType: 'FIXED', shippingCost: { value: '-1', currency: 'GBP' } }]];
  const api = harness({ fetch: async url => String(url).includes('/oauth2/') ? Response.json({ access_token: 'test-token', expires_in: 7200 }) : Response.json({ itemSummaries: shipping.map((shippingOptions, index) => ({ itemId: String(index), title: part().title, itemWebUrl: part(index).url, shippingOptions })) }) }).load('app/api/ebay/search/route.ts');
  const result = await api.GET({ nextUrl: new URL('https://mekivo.uk/api/ebay/search?type=parts&q=Ford+Fiesta+Brake+Disc') });
  const { items } = await result.json();
  assert.deepEqual(items.map(item => item.postage), [null, null, { price: '0.00', currency: 'GBP' }, { price: '3.99', currency: 'GBP' }, null, null]);
});
