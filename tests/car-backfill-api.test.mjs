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
const requestQuery = 'type=cars&maxPrice=1000&sort=price_asc&hideUnwanted=1';
const next = 'https://api.ebay.com/buy/browse/v1/item_summary/search?offset=48';
const car = (id, price = '750') => ({
  itemId: id, title: `Ford Focus full car ${id}`, itemWebUrl: `https://www.ebay.co.uk/itm/${id}`,
  price: { value: price, currency: 'GBP' }, buyingOptions: ['FIXED_PRICE'],
});
const unwanted = id => ({ ...car(id, '100'), title: 'Ford Focus deposit only monthly finance' });
const page = (items, nextUrl, total = 0) => Response.json({ itemSummaries: items, ...(nextUrl ? { next: nextUrl } : {}), total });

function harness(fetchPage, timerLimit) {
  const calls = [], modules = new Map();
  let tokens = 0;
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const exports = {};
    modules.set(filename, exports);
    vm.runInNewContext(code, {
      exports, URL, URLSearchParams, Buffer, AbortController, Date,
      setTimeout: (callback, delay) => setTimeout(callback, timerLimit ? Math.min(delay, timerLimit) : delay),
      clearTimeout,
      process: { env: { EBAY_CLIENT_ID: 'test-client', EBAY_CLIENT_SECRET: 'test-secret' } },
      console: { error() {} },
      fetch: async (url, options) => {
        if (String(url).includes('/oauth2/')) {
          tokens++;
          return Response.json({ access_token: 'test-token', expires_in: 7200 });
        }
        const parsed = new URL(url);
        calls.push({ url: parsed, options });
        return fetchPage(parsed, options, calls.length);
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
  return {
    calls, tokenCount: () => tokens,
    get: (query = requestQuery) => GET({ nextUrl: new URL(`https://mekivo.uk/api/ebay/search?${query}`) }),
  };
}

test('a short final car page stops without next and caches its results and metadata together', async () => {
  const h = harness(() => page([car('a', '900'), car('b', '700')], undefined, 99999));
  const first = await h.get();
  assert.equal(first.status, 200);
  const body = await first.json();
  assert.deepEqual(body.items.map(item => item.id), ['b', 'a']);
  assert.deepEqual(body.searchInfo, { checkedCount: 2, pagesChecked: 1, hasMore: false, partial: false });
  const cached = await h.get();
  assert.deepEqual(await cached.json(), body);
  assert.equal(h.calls.length, 1);
  assert.equal(cached.headers.get('cache-control'), 'no-store');
});

test('a page of hidden adverts is backfilled with real cars using fixed offsets and one deadline', async () => {
  const remoteNext = 'https://attacker.example/steal-token?offset=999999&filter=none';
  const h = harness(url => Number(url.searchParams.get('offset')) === 0
    ? page(Array.from({ length: 48 }, (_, index) => unwanted(`hidden-${index}`)), remoteNext)
    : page(Array.from({ length: 48 }, (_, index) => car(`good-${index}`, String(950 - index))), next));
  const response = await h.get();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.items.length, 48);
  assert.ok(body.items.every(item => item.id.startsWith('good-')));
  assert.deepEqual(body.searchInfo, { checkedCount: 96, pagesChecked: 2, hasMore: true, partial: false });
  assert.equal(h.calls.length, 2, 'stop once 48 matching cars have been collected');
  assert.deepEqual(h.calls.map(call => call.url.searchParams.get('offset')), ['0', '48']);
  for (const { url, options } of h.calls) {
    assert.equal(url.origin, 'https://api.ebay.com');
    assert.equal(url.pathname, '/buy/browse/v1/item_summary/search');
    assert.equal(url.searchParams.get('limit'), '48');
    assert.equal(url.searchParams.get('category_ids'), '9801');
    assert.equal(url.searchParams.get('filter'), 'itemLocationCountry:GB,price:[..1000],priceCurrency:GBP');
    assert.equal(url.searchParams.get('sort'), 'price');
    assert.equal(options.headers['X-EBAY-C-MARKETPLACE-ID'], 'EBAY_GB');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, h.calls[0].options.signal);
  }
  assert.equal(h.tokenCount(), 1);
});

test('short pages continue only when next is present and repeated IDs do not consume the target', async () => {
  const pages = [[car('a'), car('b')], [car('b'), car('c')], [car('d')]];
  const h = harness(url => {
    const index = Number(url.searchParams.get('offset')) / 48;
    return page(pages[index], index < 2 ? next : undefined, 0);
  });
  const body = await (await h.get()).json();
  assert.deepEqual(body.items.map(item => item.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(h.calls.map(call => call.url.searchParams.get('offset')), ['0', '48', '96']);
  assert.deepEqual(body.searchInfo, { checkedCount: 5, pagesChecked: 3, hasMore: false, partial: false });
});

test('backfill stops at four pages even when every candidate is hidden and more pages exist', async () => {
  const h = harness(url => page(Array.from({ length: 48 }, (_, index) => unwanted(`${url.searchParams.get('offset')}-${index}`)), next));
  const response = await h.get();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.items, []);
  assert.deepEqual(body.searchInfo, { checkedCount: 192, pagesChecked: 4, hasMore: true, partial: false });
  assert.deepEqual(h.calls.map(call => call.url.searchParams.get('offset')), ['0', '48', '96', '144']);
  await h.get();
  assert.equal(h.calls.length, 4, 'the completed bounded scan remains cacheable');
});

test('an empty page stops backfill even if next is present', async () => {
  const h = harness(() => page([], next));
  const body = await (await h.get()).json();
  assert.equal(h.calls.length, 1);
  assert.deepEqual(body.searchInfo, { checkedCount: 0, pagesChecked: 1, hasMore: true, partial: false });
});

for (const failure of ['http', 'invalid body', 'malformed JSON']) {
  test(`a later ${failure} failure preserves cars and is not cached`, async () => {
    const h = harness((url, _options, count) => {
      if (count === 2) {
        if (failure === 'http') return new Response('', { status: 500 });
        if (failure === 'invalid body') return Response.json({ itemSummaries: 'invalid' });
        return new Response('not JSON', { status: 200 });
      }
      return Number(url.searchParams.get('offset')) === 0 ? page([car('a')], next) : page([car('b')]);
    });
    const partial = await h.get();
    assert.equal(partial.status, 200);
    const partialBody = await partial.json();
    assert.deepEqual(partialBody.items.map(item => item.id), ['a']);
    assert.deepEqual(partialBody.searchInfo, { checkedCount: 1, pagesChecked: 1, hasMore: true, partial: true });
    assert.equal(partial.headers.get('cache-control'), 'no-store');
    const complete = await (await h.get()).json();
    assert.deepEqual(complete.items.map(item => item.id), ['a', 'b']);
    assert.equal(complete.searchInfo.partial, false);
    assert.equal(h.calls.length, 4);
    assert.deepEqual(await (await h.get()).json(), complete);
    assert.equal(h.calls.length, 4);
  });
}

for (const phase of ['headers', 'body']) {
  test(`a later ${phase} timeout aborts the shared signal, preserves cars and is not cached`, async () => {
    const h = harness((url, _options, count) => {
      if (count === 2) return phase === 'body'
        ? { ok: true, json: () => new Promise(() => {}) }
        : new Promise(() => {});
      return Number(url.searchParams.get('offset')) === 0 ? page([car('a')], next) : page([car('b')]);
    }, 10);
    const response = await h.get();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.items.map(item => item.id), ['a']);
    assert.equal(body.searchInfo.partial, true);
    assert.equal(h.calls[0].options.signal, h.calls[1].options.signal);
    assert.equal(h.calls[0].options.signal.aborted, true);
    const retry = await (await h.get()).json();
    assert.equal(retry.searchInfo.partial, false);
    assert.deepEqual(retry.items.map(item => item.id), ['a', 'b']);
    assert.equal(h.calls.length, 4);
  });
}

for (const failure of ['http', 'timeout']) {
  test(`a later ${failure} failure with no matching cars retains the error response`, async () => {
    const h = harness((_url, _options, count) => count === 1
      ? page([unwanted('hidden')], next)
      : failure === 'http' ? new Response('', { status: 500 }) : new Promise(() => {}), 10);
    const response = await h.get();
    assert.equal(response.status, failure === 'http' ? 502 : 504);
    assert.ok((await response.json()).error);
  });
}

test('parts remain a single page of twelve items even with next and car-only options', async () => {
  const h = harness(() => page(Array.from({ length: 15 }, (_, index) => unwanted(`part-${index}`)), next));
  const body = await (await h.get('type=parts&q=oil+filter&sort=price_asc&hideUnwanted=1')).json();
  assert.equal(body.items.length, 12);
  assert.equal(body.searchInfo, undefined);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url.searchParams.get('limit'), '12');
  assert.equal(h.calls[0].url.searchParams.get('category_ids'), '6030');
  assert.equal(h.calls[0].url.searchParams.has('offset'), false);
  assert.equal(h.calls[0].url.searchParams.has('sort'), false);
  assert.equal(h.calls[0].url.searchParams.has('filter'), false);
});
