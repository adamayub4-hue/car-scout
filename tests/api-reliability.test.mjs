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

function loadModule(path, { fetch: fetchMock, env = {}, timerLimit, clock } = {}) {
  const modules = new Map();
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const exports = {};
    modules.set(filename, exports);
    vm.runInNewContext(code, {
      exports, URL, URLSearchParams, Buffer, AbortController, TextDecoder,
      Date: clock ?? Date, process: { env }, console: { error() {} },
      setTimeout: (callback, delay) => setTimeout(callback, timerLimit ? Math.min(delay, timerLimit) : delay),
      clearTimeout,
      fetch: fetchMock ?? (() => { throw new Error('Unexpected network request'); }),
      require(name) {
        if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
        if (name.startsWith('node:')) return nativeRequire(name);
        if (name.startsWith('.')) return load(resolve(dirname(filename), `${name}.ts`));
        throw new Error(`Unexpected import: ${name}`);
      },
    }, { filename });
    return exports;
  }
  return load(resolve(repo, path));
}

const ebayEnv = { EBAY_CLIENT_ID: 'test-client', EBAY_CLIENT_SECRET: 'test-secret' };
const vehicleEnv = { ENABLE_DVLA_LOOKUP: 'true', DVLA_API_KEY: 'test-dvla' };
const token = () => Response.json({ access_token: 'test-token', expires_in: 7200 });
const listing = { itemId: 'test-item', title: 'Test listing', itemWebUrl: 'https://www.ebay.co.uk/itm/123' };
const results = () => Response.json({ itemSummaries: [listing] });
const searchRequest = (query) => ({ nextUrl: new URL(`https://mekivo.uk/api/ebay/search?${query}`) });
const registrationRequest = (registrationNumber = 'AB12CDE', headers = {}) => new Request('https://mekivo.uk/api/vehicle', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ registrationNumber }),
});

test('eBay sends the UK category and numeric maximum price, and reuses bounded public results', async () => {
  const calls = [];
  const api = loadModule('app/api/ebay/search/route.ts', { env: ebayEnv, fetch: async (url, options) => {
    calls.push({ url: String(url), options });
    return String(url).includes('/oauth2/') ? token() : results();
  } });
  const first = await api.GET(searchRequest('q=Audi+A3&type=cars&maxPrice=05000'));
  assert.equal(first.status, 200);
  assert.equal((await first.json()).items[0].id, 'test-item');
  const upstream = new URL(calls[1].url);
  assert.equal(upstream.searchParams.get('filter'), 'price:[..5000],priceCurrency:GBP');
  assert.equal(upstream.searchParams.get('category_ids'), '9801');
  assert.equal(upstream.searchParams.get('limit'), '12');
  assert.equal(calls[1].options.headers['X-EBAY-C-MARKETPLACE-ID'], 'EBAY_GB');
  assert.ok(calls[1].options.signal instanceof AbortSignal);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  await api.GET(searchRequest('q=audi+A3&type=cars&maxPrice=5000'));
  assert.equal(calls.length, 2);
  await api.GET(searchRequest('q=Audi+A3&type=cars&maxPrice=6000'));
  assert.equal(calls.length, 3);
  await api.GET(searchRequest('q=Oil+filter&type=parts&maxPrice=invalid'));
  assert.equal(new URL(calls[3].url).searchParams.get('category_ids'), '6030');
  assert.equal(new URL(calls[3].url).searchParams.get('filter'), null);
});

test('bad eBay inputs are rejected before any provider request', async () => {
  const api = loadModule('app/api/ebay/search/route.ts', { env: ebayEnv });
  for (const query of ['q=x', 'q=Car&type=other', 'q=Car&type=cars&maxPrice=1.2.3', 'q=Car&type=cars&maxPrice=-1', 'q=Car&type=cars&maxPrice=Infinity']) {
    assert.equal((await api.GET(searchRequest(query))).status, 400, query);
  }
});

test('registration and VIN-shaped eBay searches bypass the result cache', async () => {
  let browses = 0;
  const api = loadModule('app/api/ebay/search/route.ts', { env: ebayEnv, fetch: async url => {
    if (String(url).includes('/oauth2/')) return token();
    browses++; return results();
  } });
  for (const q of ['AB12 CDE', 'ABC123D', 'A123BCD', 'ABC123', 'WVWZZZ1JZXW000001']) {
    const before = browses;
    await api.GET(searchRequest(`q=${encodeURIComponent(q)}&type=parts`));
    await api.GET(searchRequest(`q=${encodeURIComponent(q)}&type=parts`));
    assert.equal(browses - before, 2, q);
  }
});

test('failed eBay responses are not cached; a rejected token is renewed', async () => {
  let tokens = 0, browses = 0;
  const api = loadModule('app/api/ebay/search/route.ts', { env: ebayEnv, fetch: async url => {
    if (String(url).includes('/oauth2/')) { tokens++; return token(); }
    browses++; return browses === 1 ? new Response('not JSON', { status: 401 }) : results();
  } });
  assert.equal((await api.GET(searchRequest('q=Oil+filter'))).status, 502);
  assert.equal((await api.GET(searchRequest('q=Oil+filter'))).status, 200);
  assert.equal(tokens, 2);
  assert.equal(browses, 2);
});

for (const phase of ['token headers', 'search headers', 'search body']) {
  test(`eBay deadline covers stalled ${phase}`, async () => {
    let stalledSignal;
    const api = loadModule('app/api/ebay/search/route.ts', { env: ebayEnv, timerLimit: 10, fetch: async (url, { signal }) => {
      const isToken = String(url).includes('/oauth2/');
      if (isToken && phase !== 'token headers') return token();
      stalledSignal = signal;
      if (phase === 'search body') return { ok: true, json: () => new Promise(() => {}) };
      return new Promise(() => {});
    } });
    const response = await api.GET(searchRequest('q=Oil+filter'));
    assert.equal(response.status, 504);
    assert.equal(stalledSignal.aborted, true);
    assert.match((await response.json()).error, /try again/);
  });
}

test('concurrent searches share one token refresh', async () => {
  let tokens = 0;
  const api = loadModule('app/api/ebay/search/route.ts', { env: ebayEnv, fetch: async url => {
    if (String(url).includes('/oauth2/')) { tokens++; await Promise.resolve(); return token(); }
    return results();
  } });
  await Promise.all([api.GET(searchRequest('q=Brake+pads')), api.GET(searchRequest('q=Oil+filter'))]);
  assert.equal(tokens, 1);
});

test('public result cache evicts old entries and does not extend expiry on reads', () => {
  let now = 0;
  const { BoundedTtlCache } = loadModule('app/lib/server-cache.ts', { clock: { now: () => now } });
  const cache = new BoundedTtlCache(2, 30);
  cache.set('a', 1); cache.set('b', 2); cache.get('a'); cache.set('c', 3);
  assert.equal(cache.get('b'), undefined);
  now = 29; assert.equal(cache.get('a'), 1);
  now = 30; assert.equal(cache.get('a'), undefined);
});

test('registration lookup never caches vehicle responses and returns a useful timeout', async () => {
  const api = loadModule('app/api/vehicle/route.ts', { env: vehicleEnv, timerLimit: 10, fetch: async () => new Promise(() => {}) });
  const response = await api.POST(registrationRequest());
  assert.equal(response.status, 504);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.match((await response.json()).error, /Make & model/);
});

test('optional MOT enrichment timing out preserves the successful DVLA vehicle', async () => {
  const api = loadModule('app/api/vehicle/route.ts', { timerLimit: 10, env: {
    ...vehicleEnv, DVSA_MOT_API_KEY: 'mot', DVSA_MOT_CLIENT_ID: 'client', DVSA_MOT_CLIENT_SECRET: 'secret',
    DVSA_MOT_TOKEN_URL: 'https://token.example.test', DVSA_MOT_SCOPE: 'scope',
  }, fetch: async (url, options) => {
    assert.equal(options.cache, 'no-store');
    if (String(url).includes('vehicle-enquiry')) return Response.json({ make: 'FORD', registrationNumber: 'AB12CDE', yearOfManufacture: 2012 });
    return new Promise(() => {});
  } });
  const response = await api.POST(registrationRequest());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).vehicle.make, 'FORD');
  assert.match(response.headers.get('cache-control'), /private, no-store/);
});

test('registration body size is bounded even without a Content-Length header', async () => {
  const api = loadModule('app/api/vehicle/route.ts', { env: vehicleEnv });
  const request = new Request('https://mekivo.uk/api/vehicle', { method: 'POST', body: JSON.stringify({ registrationNumber: 'AB12CDE', padding: 'a'.repeat(1100) }) });
  assert.equal(request.headers.get('content-length'), null);
  assert.equal((await api.POST(request)).status, 413);
});

test('registration failures are useful and local throttling returns Retry-After', async () => {
  const api = loadModule('app/api/vehicle/route.ts', { env: vehicleEnv, fetch: async () => Response.json(null) });
  assert.equal((await api.POST(registrationRequest('X'))).status, 400);
  for (let i = 0; i < 7; i++) assert.equal((await api.POST(registrationRequest())).status, 502);
  const limited = await api.POST(registrationRequest());
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});

test('optional Commons image timeout has no cacheable error response', async () => {
  const api = loadModule('app/api/vehicle-image/route.ts', { timerLimit: 10, fetch: async () => new Promise(() => {}) });
  const response = await api.GET(new Request('https://mekivo.uk/api/vehicle-image?make=Ford&model=Focus'));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { image: null });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
