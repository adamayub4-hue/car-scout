import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const repo = fileURLToPath(new URL('../', import.meta.url));
const ID = '123456789012', NOW = Date.parse('2026-09-29T12:00:00.000Z');
const row = (userId = 'customer-one', id = ID) => ({ user_id: userId, kind: 'part_listing', title: 'Saved brake disc', data: { version: 1, id, url: `https://www.ebay.co.uk/itm/${id.split(':')[0]}${id.includes(':') ? `?var=${id.split(':')[1]}` : ''}`, searchUrl: '/?restore=1&mode=parts&make=Ford&model=Fiesta&part=Brake+Disc' } });
const payload = (changes = {}) => ({ itemId: `v1|${ID}|0`, title: 'Ford Fiesta Brake Disc', itemWebUrl: `https://www.ebay.co.uk/itm/${ID}?mkcid=99&customid=seller`, price: { value: '29.95', currency: 'GBP' }, image: { imageUrl: 'https://i.ebayimg.com/images/g/example/s-l1600.jpg' }, condition: 'New', itemLocation: { country: 'GB' }, shippingOptions: [{ shippingCostType: 'FIXED', shippingCost: { value: '0.00', currency: 'GBP' } }], ...changes });
const request = (id = ID, token = 'customer-token') => new Request(`https://mekivo.uk/api/ebay/saved-listing?id=${encodeURIComponent(id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
const privacy = response => {
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Authorization');
};

function harness(options = {}) {
  let now = NOW;
  const calls = { auth: [], queries: [], fetch: [], clients: [] }, rows = options.rows ?? [row()];
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const modules = new Map();
  const provider = async (url, init) => {
    calls.fetch.push({ url: String(url), init });
    if (String(url).includes('/oauth2/')) return Response.json({ access_token: 'test-ebay-token', expires_in: 7200 });
    return options.provider ? options.provider(url, init) : Response.json(payload());
  };
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const exports = {}; modules.set(filename, exports);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, {
      exports, URL, URLSearchParams, Buffer, AbortController, Date: ClockDate, fetch: provider,
      process: { env: options.unconfigured ? {} : { NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon', EBAY_CLIENT_ID: 'test-client', EBAY_CLIENT_SECRET: 'test-secret' } },
      setTimeout: (callback, delay) => setTimeout(callback, options.timerLimit ? Math.min(delay, options.timerLimit) : delay), clearTimeout,
      require(name) {
        if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
        if (name === '@supabase/supabase-js') return { createClient(url, key, config) {
          calls.clients.push({ url, key, config });
          return {
            auth: { async getUser(token) {
              calls.auth.push(token);
              if (options.auth) return options.auth(token);
              const userId = { 'customer-token': 'customer-one', 'other-token': 'customer-two', 'owner-token': 'master-owner' }[token];
              return { data: { user: userId ? { id: userId } : null }, error: userId ? null : { status: 401 } };
            } },
            from(table) {
              const query = { table, select: '', filters: [], kinds: [], limit: 0 };
              calls.queries.push(query);
              const builder = {
                select(value) { query.select = value; return builder; },
                eq(column, value) { query.filters.push([column, value]); return builder; },
                in(column, values) { query.kinds = [column, values]; return builder; },
                async limit(value) {
                  query.limit = value;
                  if (options.databaseError) return { data: null, error: { message: 'Unavailable' } };
                  return { data: rows.filter(item => query.filters.every(([column, expected]) => (column === 'data->>id' ? item.data.id : item[column]) === expected) && (query.kinds[1] ?? []).includes(item.kind)).slice(0, value), error: null };
                },
              };
              return builder;
            },
          };
        } };
        if (name.startsWith('.')) return load(resolve(dirname(filename), `${name}.ts`));
        throw new Error(`Unexpected saved listing API dependency: ${name}`);
      },
    }, { filename });
    return exports;
  }
  const api = load(resolve(repo, 'app/api/ebay/saved-listing/route.ts'));
  return { ...api, calls, rows, advance(milliseconds) { now += milliseconds; }, browses() { return calls.fetch.filter(call => call.url.includes('/buy/browse/')); } };
}

test('saved listing details recheck identity and ownership on every request, including shared cache hits and owner accounts', async () => {
  const app = harness();
  for (let i = 0; i < 2; i++) { const result = await app.GET(request()); assert.equal(result.status, 200); privacy(result); }
  assert.equal(app.browses().length, 1);
  assert.equal(app.calls.auth.length, 2);
  assert.equal(app.calls.queries.length, 2);
  for (const [token, status] of [[null, 401], ['invalid-token', 401], ['other-token', 404], ['owner-token', 404]]) {
    const result = await app.GET(request(ID, token)); assert.equal(result.status, status, String(token)); privacy(result);
  }
  assert.equal(app.browses().length, 1, 'neither cached data nor a provider call bypasses ownership');
  const ownerQuery = app.calls.queries.at(-1);
  assert.deepEqual(Array.from(ownerQuery.filters, entry => Array.from(entry)), [['user_id', 'master-owner'], ['data->>id', ID]]);
  assert.deepEqual(Array.from(ownerQuery.kinds[1]), ['car_listing', 'part_listing']);
  assert.equal(ownerQuery.limit, 1);
  app.rows.push(row('master-owner'));
  assert.equal((await app.GET(request(ID, 'owner-token'))).status, 200);
  assert.equal(app.browses().length, 1, 'authorized owners may reuse fresh public listing details');
  assert.equal(app.calls.clients.at(-1).config.global.headers.Authorization, 'Bearer owner-token');
  assert.equal(app.calls.clients.at(-1).config.auth.persistSession, false);
});

test('malformed, duplicate and missing item identities fail before authentication or provider access', async () => {
  const app = harness();
  for (const id of ['', '123', '1234567890123456', `${ID}:123456789012345678901`, `${ID}/evil`, 'https://ebay.co.uk/itm/123456789012']) {
    const result = await app.GET(request(id)); assert.equal(result.status, 400, id); privacy(result);
  }
  for (const url of ['https://mekivo.uk/api/ebay/saved-listing', `https://mekivo.uk/api/ebay/saved-listing?id=${ID}&id=${ID}`]) assert.equal((await app.GET(new Request(url))).status, 400);
  assert.equal(app.calls.auth.length, 0);
  assert.equal(app.calls.fetch.length, 0);
});

test('unsaved, malformed stored records and failed ownership reads never reach eBay', async () => {
  for (const options of [
    { rows: [] }, { rows: [row('customer-two')] },
    { rows: [{ ...row(), data: { ...row().data, url: 'https://example.com/itm/123456789012' } }] },
    { rows: [{ ...row(), kind: 'part_search' }] },
  ]) {
    const app = harness(options), result = await app.GET(request());
    assert.equal(result.status, 404); privacy(result); assert.equal(app.calls.fetch.length, 0);
  }
  for (const options of [{ databaseError: true }, { unconfigured: true }, { auth: async () => ({ data: { user: null }, error: { status: 500 } }) }]) {
    const app = harness(options), result = await app.GET(request());
    assert.equal(result.status, 503); privacy(result); assert.equal(app.calls.fetch.length, 0);
  }
});

test('details are normalized before returning and fetched as UK listings without public caching', async () => {
  const app = harness(), result = await app.GET(request()), body = await result.json();
  assert.equal(result.status, 200); privacy(result);
  assert.equal(body.item.id, ID);
  assert.equal(body.item.url, `https://www.ebay.co.uk/itm/${ID}`);
  assert.equal(body.item.title, 'Ford Fiesta Brake Disc');
  assert.equal(body.item.price, '29.95');
  assert.equal(body.item.currency, 'GBP');
  assert.deepEqual(body.item.postage, { price: '0.00', currency: 'GBP' });
  assert.equal(body.checkedAt, new Date(NOW).toISOString());
  const call = app.browses()[0];
  assert.match(call.url, /v1%7C123456789012%7C0$/);
  assert.equal(call.init.headers['X-EBAY-C-MARKETPLACE-ID'], 'EBAY_GB');
  assert.equal(call.init.cache, 'no-store');
  assert.ok(call.init.signal instanceof AbortSignal);
  const other = harness({ provider: async () => Response.json(payload({ image: { imageUrl: 'https://attacker.example/photo.jpg' }, shippingOptions: [{ shippingCostType: 'CALCULATED', shippingCost: { value: '0', currency: 'GBP' } }] })) });
  const safe = await (await other.GET(request())).json();
  assert.equal(safe.item.image, null);
  assert.equal(safe.item.postage, null);
});

test('saved variation identity is preserved through ownership, provider lookup and safe destination', async () => {
  const variation = '12345678901234567890', id = `${ID}:${variation}`;
  const app = harness({ rows: [row('customer-one', id)], provider: async () => Response.json(payload({ itemId: `v1|${ID}|${variation}`, itemWebUrl: `https://www.ebay.co.uk/itm/${ID}?var=${variation}&customid=remove` })) });
  const result = await app.GET(request(id)); assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.item.id, id);
  assert.equal(body.item.url, `https://www.ebay.co.uk/itm/${ID}?var=${variation}`);
  assert.ok(app.browses()[0].url.endsWith(`v1%7C${ID}%7C${variation}`));
});

test('eBay 404, 410, ended and out-of-stock items are unavailable while their bookmark remains', async () => {
  for (const provider of [
    async () => new Response('', { status: 404 }), async () => new Response('', { status: 410 }),
    async () => Response.json(payload({ itemEndDate: new Date(NOW - 1).toISOString() })),
    async () => Response.json(payload({ estimatedAvailabilities: [{ estimatedAvailabilityStatus: 'OUT_OF_STOCK' }] })),
  ]) {
    const app = harness({ provider }), result = await app.GET(request());
    assert.equal(result.status, 200); privacy(result);
    assert.deepEqual(await result.json(), { item: null, checkedAt: new Date(NOW).toISOString(), unavailable: true });
    assert.equal(app.rows.length, 1);
  }
});

test('provider failures and mismatched details remain errors, are not sold-out claims, and are retried', async () => {
  for (const broken of [
    () => new Response('', { status: 500 }), () => new Response('', { status: 401 }),
    () => new Response('bad JSON'), () => Response.json(null),
    () => Response.json(payload({ itemWebUrl: 'https://attacker.example/itm/123456789012' })),
    () => Response.json(payload({ itemWebUrl: 'https://www.ebay.co.uk/itm/123456789099' })),
  ]) {
    let attempts = 0;
    const app = harness({ provider: async () => ++attempts === 1 ? broken() : Response.json(payload()) });
    const first = await app.GET(request()), body = await first.json();
    assert.equal(first.status, 502); privacy(first);
    assert.equal(typeof body.error, 'string'); assert.equal(body.unavailable, undefined);
    assert.equal((await app.GET(request())).status, 200);
    assert.equal(attempts, 2);
  }
});

test('five-minute data cache does not extend on reads and still runs account authorization', async () => {
  const app = harness();
  assert.equal((await app.GET(request())).status, 200);
  app.advance(299_999);
  assert.equal((await app.GET(request())).status, 200);
  assert.equal(app.browses().length, 1);
  app.advance(1);
  assert.equal((await app.GET(request())).status, 200);
  assert.equal(app.browses().length, 2);
  assert.equal(app.calls.auth.length, 3);
});

test('stalled authentication and provider responses receive private retryable timeouts', async () => {
  for (const options of [ { auth: () => new Promise(() => {}) }, { provider: () => new Promise(() => {}) } ]) {
    const app = harness({ ...options, timerLimit: 10 }), result = await app.GET(request());
    assert.equal(result.status, 504); privacy(result);
    assert.match((await result.json()).error, /try again/i);
  }
});
