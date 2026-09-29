import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const repo = fileURLToPath(new URL('../', import.meta.url));
const nativeRequire = createRequire(import.meta.url);

function harness(items = []) {
  const calls = [], modules = new Map();
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const exports = {};
    modules.set(filename, exports);
    vm.runInNewContext(code, {
      exports, URL, URLSearchParams, Buffer, AbortController, Date, setTimeout, clearTimeout,
      process: { env: { EBAY_CLIENT_ID: 'test-client', EBAY_CLIENT_SECRET: 'test-secret' } },
      console: { error() {} },
      fetch: async url => {
        if (String(url).includes('/oauth2/')) return Response.json({ access_token: 'test-token', expires_in: 7200 });
        calls.push(new URL(url));
        return Response.json({ itemSummaries: items });
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
  const { GET } = load(resolve(repo, 'app/api/ebay/search/route.ts'));
  return { calls, get: query => GET({ nextUrl: new URL(`https://mekivo.uk/api/ebay/search?${query}`) }) };
}

test('car price range accepts zero, decimal bounds and one-sided budgets', async () => {
  const h = harness();
  for (const [input, expected] of [
    ['minPrice=0000&maxPrice=03000', 'price:[0..3000],priceCurrency:GBP'],
    ['minPrice=0500.50&maxPrice=3000.75', 'price:[500.5..3000.75],priceCurrency:GBP'],
    ['minPrice=1500', 'price:[1500],priceCurrency:GBP'],
    ['minPrice=0', 'price:[0],priceCurrency:GBP'],
    ['maxPrice=5000', 'price:[..5000],priceCurrency:GBP'],
    ['minPrice=500&maxPrice=500', 'price:[500..500],priceCurrency:GBP'],
  ]) {
    assert.equal((await h.get(`type=cars&q=Ford+Fiesta&${input}`)).status, 200, input);
    assert.equal(h.calls.at(-1).searchParams.get('filter'), expected);
  }
});

test('invalid budget, sort and hide values never reach eBay', async () => {
  const h = harness();
  for (const input of [
    'minPrice=-1', 'minPrice=1.234', 'minPrice=Infinity', 'minPrice=1e3', 'minPrice=100000001',
    'maxPrice=0', 'maxPrice=1.234', 'maxPrice=100000001', 'minPrice=3000&maxPrice=2000',
    'sort=distance', 'sort=__proto__', 'sort=constructor', 'sort=', 'hideUnwanted=yes', 'hideUnwanted=',
  ]) {
    assert.equal((await h.get(`type=cars&q=Ford&${input}`)).status, 400, input);
  }
  assert.equal(h.calls.length, 0);
});

test('car sorting is sent to eBay before the result limit and preserves provider order', async () => {
  const items = Array.from({ length: 60 }, (_, index) => ({
    itemId: String(index), title: `Car ${index}`, itemWebUrl: `https://www.ebay.co.uk/itm/${123456789000 + index}`,
    price: { value: String(60000 - index * 100), currency: 'GBP' },
  }));
  const h = harness(items);
  for (const [sort, expected] of [['best_match', null], ['price_asc', 'price'], ['price_desc', '-price'], ['newest', 'newlyListed']]) {
    const response = await h.get(`type=cars&q=Ford&sort=${sort}`);
    assert.equal(response.status, 200);
    const { items: actual } = await response.json();
    assert.equal(h.calls.at(-1).searchParams.get('sort'), expected);
    assert.equal(h.calls.at(-1).searchParams.get('limit'), '48');
    assert.equal(actual.length, 48);
    assert.deepEqual(actual.map(item => item.id), items.slice(0, 48).map(item => item.itemId));
  }
});

test('all-make cars omit q and search the car category; parts still require a query', async () => {
  const h = harness();
  assert.equal((await h.get('type=cars&maxPrice=3000&sort=price_asc')).status, 200);
  assert.equal(h.calls[0].searchParams.has('q'), false);
  assert.equal(h.calls[0].searchParams.get('category_ids'), '9801');
  assert.equal(h.calls[0].searchParams.get('sort'), 'price');
  assert.equal((await h.get('type=cars&q=x')).status, 400);
  assert.equal((await h.get('type=parts')).status, 400);
  assert.equal((await h.get('type=parts&q=x')).status, 400);
  assert.equal((await h.get('q=')).status, 400);
  assert.equal(h.calls.length, 1);
});

test('normalised options reuse cache but different bounds, order and hide settings stay separate', async () => {
  const h = harness();
  const request = suffix => h.get(`type=cars&q=Ford+Fiesta&maxPrice=3000${suffix}`);
  await request('');
  await request('&sort=best_match&hideUnwanted=0');
  assert.equal(h.calls.length, 1);
  await request('&minPrice=500');
  await request('&minPrice=0500.00');
  assert.equal(h.calls.length, 2);
  await request('&sort=price_asc');
  await request('&sort=price_desc');
  await request('&sort=newest');
  await request('&hideUnwanted=1');
  await request('&hideUnwanted=true');
  assert.equal(h.calls.length, 6);
  await request('&hideUnwanted=false');
  assert.equal(h.calls.length, 6);
  await h.get('type=cars&q=Ford+Fiesta&maxPrice=4000');
  assert.equal(h.calls.length, 7);
});

test('parts retain 12 results and ignore car-only options; purchase prices never fall back to bids', async () => {
  const items = Array.from({ length: 15 }, (_, index) => ({
    itemId: String(index), title: `Listing ${index}`, itemWebUrl: `https://www.ebay.co.uk/itm/${123456789000 + index}`,
    ...(index ? { price: { value: '5000', currency: 'GBP' }, buyingOptions: ['FIXED_PRICE'] } : { buyingOptions: ['AUCTION'], currentBidPrice: { value: '99', currency: 'GBP' } }),
  }));
  const h = harness(items);
  const response = await h.get('type=parts&q=Oil+filter&minPrice=-1&maxPrice=bad&sort=invalid&hideUnwanted=yes');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.items.length, 12);
  assert.equal(data.items[0].price, null);
  assert.equal(h.calls[0].searchParams.get('limit'), '12');
  assert.equal(h.calls[0].searchParams.get('category_ids'), '6030');
  assert.equal(h.calls[0].searchParams.get('sort'), null);
  assert.equal(h.calls[0].searchParams.get('filter'), null);
  const carResponse = await h.get('type=cars&q=Ford&sort=price_asc&hideUnwanted=1');
  assert.equal((await carResponse.json()).items[0].price, null);
});
