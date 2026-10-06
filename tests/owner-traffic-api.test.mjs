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
const { createClient } = nativeRequire('@supabase/supabase-js');
const ownerId = '11111111-1111-4111-8111-111111111111';
const customerId = '22222222-2222-4222-8222-222222222222';
const defaultEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-test-key',
  MEKIVO_ANALYTICS_VERCEL_TOKEN: 'private-vercel-test-token',
};
const APP_USAGE_FILTER = "environment eq 'production' and (eventName eq 'app_open' or eventName eq 'browser_open' or eventName eq 'app_install')";
const FUNNEL_EVENTS_FILTER = "environment eq 'production' and (eventName eq 'search_submitted' or eventName eq 'marketplace_outbound')";
const isAppUsageQuery = url => new URL(url).searchParams.get('filter') === APP_USAGE_FILTER;
const isFunnelEventsQuery = url => new URL(url).searchParams.get('filter') === FUNNEL_EVENTS_FILTER;

function fixture(url) {
  const query = new URL(url);
  switch (query.searchParams.get('by')) {
    case 'environment': return { data: [{ environment: 'production', visitors: 75, pageviews: 124 }] };
    // These source visitor counts deliberately total more than the period total.
    case 'referrerHostname': return { data: [
      { referrerHostname: null, visitors: 50, pageviews: 70 },
      { referrerHostname: 'l.facebook.com', visitors: 45, pageviews: 54 },
    ] };
    case 'eventName': return { data: isAppUsageQuery(url) ? [
      { eventName: 'app_open', count: 41, visitors: 14 },
      { eventName: 'browser_open', count: 88, visitors: 69 },
      { eventName: 'app_install', count: 6, visitors: 5 },
    ] : [
      { eventName: 'search_submitted', count: 29, visitors: 15 },
      { eventName: 'marketplace_outbound', count: 11, visitors: 8 },
    ] };
    case 'eventData/context': return { data: [
      { 'eventData/context': 'cars:ebay:listing', count: 4 },
      { 'eventData/context': 'parts:ebay:all_results', count: 2 },
      { 'eventData/context': 'cars:autotrader:search_results', count: 3 },
      { 'eventData/context': null, count: 2 },
    ] };
    default: throw new Error('Unexpected analytics grouping');
  }
}

function harness({ env: overrides = {}, upstream, authFetch, timerLimit } = {}) {
  const env = { ...defaultEnv, ...overrides };
  const calls = [];
  const clients = [];
  const diagnostics = [];
  const state = { userId: ownerId, adminId: ownerId, authStatus: 200, adminStatus: 200 };
  let now = Date.parse('2026-09-17T12:00:00.000Z');
  class ClockDate extends Date { static now() { return now; } }
  const modules = new Map();
  async function fetchMock(input, options = {}) {
    const url = String(input);
    const headers = new Headers(options.headers);
    calls.push({ url, options, headers });
    if (url.startsWith('https://api.vercel.com/')) {
      return upstream ? upstream(new URL(url), options) : Response.json(fixture(url));
    }
    if (!url.startsWith('https://test-project.supabase.co/')) throw new Error('Unexpected network destination');
    if (authFetch) {
      const response = await authFetch(new URL(url), options);
      if (response !== undefined) return response;
    }
    if (url.includes('/auth/v1/user')) {
      return state.authStatus === 200
        ? Response.json({ id: state.userId, aud: 'authenticated', role: 'authenticated', user_metadata: { isAdmin: true } })
        : Response.json({ message: 'Secret upstream authentication error', code: 'bad_jwt' }, { status: state.authStatus });
    }
    if (url.includes('/rest/v1/admins?')) {
      return state.adminStatus === 200
        ? Response.json(state.adminId ? [{ user_id: state.adminId }] : [])
        : Response.json({ message: 'Secret admin query error' }, { status: state.adminStatus });
    }
    throw new Error('Unexpected authentication operation');
  }
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const exports = {};
    modules.set(filename, exports);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(code, {
      exports, URL, URLSearchParams, AbortController, Date: ClockDate, process: { env },
      console: { error() {}, warn(...args) { diagnostics.push(args); } }, fetch: fetchMock,
      setTimeout: (callback, delay) => setTimeout(callback, timerLimit ? Math.min(delay, timerLimit) : delay),
      clearTimeout,
      require(name) {
        if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
        if (name === '@supabase/supabase-js') return { createClient: (...args) => { clients.push(args); return createClient(...args); } };
        if (name.startsWith('node:')) return nativeRequire(name);
        if (name.startsWith('.')) return load(resolve(dirname(filename), `${name}.ts`));
        throw new Error(`Unexpected import: ${name}`);
      },
    }, { filename });
    return exports;
  }
  const api = load(resolve(repo, 'app/api/admin/traffic/route.ts'));
  return {
    env, state, calls, clients, diagnostics,
    advance: milliseconds => { now += milliseconds; },
    providerCalls: () => calls.filter(call => call.url.startsWith('https://api.vercel.com/')),
    authCalls: () => calls.filter(call => call.url.includes('/auth/v1/user')),
    get: (query = '', authorization = 'Bearer owner-session-token') => api.GET(new Request(`https://mekivo.uk/api/admin/traffic${query ? `?${query}` : ''}`, {
      headers: authorization ? { Authorization: authorization } : {},
    })),
  };
}

function assertPrivate(response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Authorization');
}

test('owner traffic verifies the bearer with Supabase and queries only the verified owner row', async () => {
  const h = harness();
  const response = await h.get();
  assert.equal(response.status, 200);
  assertPrivate(response);
  const body = await response.json();
  assert.equal(body.range, '7d');
  assert.equal(body.visitors, 75);
  assert.equal(body.pageviews, 124);
  assert.equal(body.searches, 29);
  assert.equal(body.outboundClicks, 11);
  assert.deepEqual(body.appUsage, { appVisitors: 14, browserVisitors: 69, appOpens: 41, confirmedInstalls: 6 });
  assert.deepEqual(body.clicksByDestination, { ebayCars: 4, ebayParts: 2, otherMarketplaces: 3, unclassified: 2 });
  assert.deepEqual(body.marketplaceClicks, [
    { marketplace: 'ebay', cars: 4, parts: 2, clicks: 6 },
    { marketplace: 'autotrader', cars: 3, parts: 0, clicks: 3 },
    ...['facebook', 'motors', 'gumtree', 'cargurus', 'pistonheads', 'aacars', 'carandclassic'].map(marketplace => ({ marketplace, cars: 0, parts: 0, clicks: 0 })),
    { marketplace: 'unclassified', cars: null, parts: null, clicks: 2 },
  ]);
  assert.equal(body.sources[0].source, 'Direct / unknown');
  assert.equal(body.partial, false);
  assert.deepEqual(body.warnings, []);
  assert.equal(body.since, '2026-09-10T12:00:00.000Z');
  assert.equal(body.until, '2026-09-17T12:00:00.000Z');
  assert.equal(body.fetchedAt, body.until);
  assert.equal(h.clients.length, 1);
  const [, publicKey, options] = h.clients[0];
  assert.equal(publicKey, defaultEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  assert.deepEqual({ ...options.auth }, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
  assert.equal(options.global.headers.Authorization, 'Bearer owner-session-token');
  assert.equal(h.calls[0].url, 'https://test-project.supabase.co/auth/v1/user');
  const adminQuery = new URL(h.calls[1].url);
  assert.equal(adminQuery.pathname, '/rest/v1/admins');
  assert.equal(adminQuery.searchParams.get('select'), 'user_id');
  assert.equal(adminQuery.searchParams.get('user_id'), `eq.${ownerId}`);
  for (const call of h.calls.slice(0, 2)) {
    assert.equal(call.headers.get('authorization'), 'Bearer owner-session-token');
    assert.equal(call.headers.get('apikey'), defaultEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    assert.equal(call.options.cache, 'no-store');
    assert.ok(call.options.signal instanceof AbortSignal);
  }
});

test('Vercel requests use fixed production groups and no caller-supplied project, filters or tokens', async () => {
  const h = harness();
  const response = await h.get('projectId=attacker&slug=other&filter=anything&token=leak');
  assert.equal(response.status, 200);
  assert.equal(h.providerCalls().length, 5);
  for (const { url, headers, options } of h.providerCalls()) {
    const query = new URL(url);
    assert.equal(query.origin, 'https://api.vercel.com');
    assert.equal(query.searchParams.get('projectId'), 'car-scout');
    assert.equal(query.searchParams.get('slug'), 'adamayub4-hues-projects');
    assert.equal(headers.get('authorization'), `Bearer ${defaultEnv.MEKIVO_ANALYTICS_VERCEL_TOKEN}`);
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    assert.ok(!url.includes('token'));
    if (query.searchParams.get('by') === 'eventName') {
      assert.equal(query.pathname, '/v1/query/web-analytics/events/aggregate');
      assert.ok(isFunnelEventsQuery(query) || isAppUsageQuery(query));
      assert.equal(query.searchParams.get('limit'), isAppUsageQuery(query) ? '3' : '10');
    } else if (query.searchParams.get('by') === 'eventData/context') {
      assert.equal(query.pathname, '/v1/query/web-analytics/events/aggregate');
      assert.equal(query.searchParams.get('filter'), "environment eq 'production' and eventName eq 'marketplace_outbound'");
      assert.equal(query.searchParams.get('limit'), '100');
    } else {
      assert.equal(query.pathname, '/v1/query/web-analytics/visits/aggregate');
      assert.equal(query.searchParams.get('filter'), "environment eq 'production'");
    }
  }
});

test('missing, malformed and oversized authorization are rejected before any network request', async () => {
  const h = harness();
  for (const authorization of [null, 'Basic owner', 'Bearer', 'Bearer one two', `Bearer ${'a'.repeat(8193)}`]) {
    const response = await h.get('', authorization);
    assert.equal(response.status, 401);
    assertPrivate(response);
  }
  assert.equal(h.calls.length, 0);
});

test('cached reports never bypass a fresh session or admin check', async () => {
  const h = harness();
  assert.equal((await h.get()).status, 200);
  assert.equal((await h.get('', null)).status, 401);
  for (const status of [400, 401, 403]) {
    h.state.authStatus = status;
    assert.equal((await h.get()).status, 401);
  }
  h.state.authStatus = 200;
  h.state.userId = null;
  assert.equal((await h.get()).status, 401);
  h.state.userId = customerId;
  h.state.adminId = null;
  assert.equal((await h.get('', 'Bearer customer-session-token')).status, 403);
  h.state.userId = ownerId;
  // A formerly authorized account whose admin row has been revoked is denied.
  assert.equal((await h.get()).status, 403);
  h.state.adminId = customerId;
  assert.equal((await h.get()).status, 403);
  assert.equal(h.providerCalls().length, 5);
});

test('auth and membership failures fail closed without exposing upstream details', async () => {
  for (const failure of ['auth', 'membership']) {
    const h = harness();
    h.state[failure === 'auth' ? 'authStatus' : 'adminStatus'] = 500;
    const response = await h.get();
    assert.equal(response.status, 503);
    assertPrivate(response);
    const text = await response.text();
    assert.ok(!text.includes('Secret'));
    assert.equal(h.providerCalls().length, 0);
  }
});

test('missing analytics configuration is explicit and cannot expose a cached snapshot', async () => {
  const h = harness();
  assert.equal((await h.get()).status, 200);
  delete h.env.MEKIVO_ANALYTICS_VERCEL_TOKEN;
  const response = await h.get();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'not_configured');
  assertPrivate(response);
  assert.equal(h.providerCalls().length, 5);
});

test('missing authentication configuration fails closed', async () => {
  const h = harness({ env: { NEXT_PUBLIC_SUPABASE_ANON_KEY: '' } });
  const response = await h.get();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'auth_unavailable');
  assertPrivate(response);
  assert.equal(h.calls.length, 0);
});

test('rolling ranges retain independent cached snapshots and reject unknown or duplicate periods', async () => {
  const h = harness();
  for (const [range, days] of [['24h', 1], ['7d', 7], ['30d', 30]]) {
    const response = await h.get(`range=${range}`);
    const report = await response.json();
    assert.equal(report.range, range);
    assert.equal(Date.parse(report.until) - Date.parse(report.since), days * 86400_000);
    await h.get(`range=${range}`);
  }
  assert.equal(h.providerCalls().length, 15);
  for (const query of ['range=', 'range=all', 'range=__proto__', 'range=365d', 'range=7d&range=30d']) {
    const response = await h.get(query);
    assert.equal(response.status, 400);
    assertPrivate(response);
  }
  assert.equal(h.providerCalls().length, 15);
});

test('snapshot cache expires at five minutes without extending expiry on reads', async () => {
  const h = harness();
  const first = await (await h.get()).json();
  h.advance(299_999);
  const cached = await (await h.get()).json();
  assert.deepEqual(cached, first);
  assert.equal(h.providerCalls().length, 5);
  h.advance(1);
  const refreshed = await (await h.get()).json();
  assert.notEqual(refreshed.fetchedAt, first.fetchedAt);
  assert.equal(h.providerCalls().length, 10);
  assert.equal(h.authCalls().length, 3);
});

test('changing project, team or token invalidates the cached snapshot', async () => {
  const h = harness();
  await h.get();
  for (const [key, value] of [
    ['MEKIVO_ANALYTICS_PROJECT_ID', 'different-project'],
    ['MEKIVO_ANALYTICS_TEAM_SLUG', 'different-team'],
    ['MEKIVO_ANALYTICS_VERCEL_TOKEN', 'rotated-secret'],
  ]) {
    const before = h.providerCalls().length;
    h.env[key] = value;
    const response = await h.get();
    assert.equal(response.status, 200);
    assert.ok(!(await response.text()).includes(value));
    assert.equal(h.providerCalls().length - before, 5);
  }
});

test('the snapshot cache stays bounded when server configuration changes', async () => {
  const h = harness();
  for (let index = 0; index < 13; index++) {
    h.env.MEKIVO_ANALYTICS_PROJECT_ID = `project-${index}`;
    assert.equal((await h.get()).status, 200);
  }
  h.env.MEKIVO_ANALYTICS_PROJECT_ID = 'project-0';
  assert.equal((await h.get()).status, 200);
  // The thirteenth distinct snapshot evicted the oldest from the 12-entry cache.
  assert.equal(h.providerCalls().length, 14 * 5);
});

test('an empty valid provider dataset means zero, including missing event groups', async () => {
  const h = harness({ upstream: () => Response.json({ data: [] }) });
  const report = await (await h.get()).json();
  assert.equal(report.visitors, 0);
  assert.equal(report.pageviews, 0);
  assert.equal(report.searches, 0);
  assert.equal(report.outboundClicks, 0);
  assert.deepEqual(report.appUsage, { appVisitors: 0, browserVisitors: 0, appOpens: 0, confirmedInstalls: 0 });
  assert.deepEqual(report.clicksByDestination, { ebayCars: 0, ebayParts: 0, otherMarketplaces: 0, unclassified: 0 });
  assert.equal(report.marketplaceClicks.length, 10);
  assert.ok(report.marketplaceClicks.every(row => row.clicks === 0));
  assert.ok(report.marketplaceClicks.filter(row => row.marketplace !== 'unclassified').every(row => row.cars === 0 && row.parts === 0));
  assert.deepEqual(report.sources, []);
  assert.equal(report.partial, false);
});

test('app usage uses each event visitor count directly and zero-fills only absent successful groups', async () => {
  for (const [data, expected] of [
    [[], { appVisitors: 0, browserVisitors: 0, appOpens: 0, confirmedInstalls: 0 }],
    [[{ eventName: 'app_open', count: 0, visitors: 0 }, { eventName: 'browser_open', count: 0, visitors: 0 }, { eventName: 'app_install', count: 0, visitors: 0 }],
      { appVisitors: 0, browserVisitors: 0, appOpens: 0, confirmedInstalls: 0 }],
    [[{ eventName: 'app_open', count: 37, visitors: 11 }], { appVisitors: 11, browserVisitors: 0, appOpens: 37, confirmedInstalls: 0 }],
    [[{ eventName: 'browser_open', count: 27, visitors: 16 }], { appVisitors: 0, browserVisitors: 16, appOpens: 0, confirmedInstalls: 0 }],
    [[{ eventName: 'app_install', count: 9, visitors: 7 }], { appVisitors: 0, browserVisitors: 0, appOpens: 0, confirmedInstalls: 9 }],
    [[{ eventName: 'app_install', count: 3, visitors: 2 }, { eventName: 'browser_open', count: 100, visitors: 70 }, { eventName: 'app_open', count: 51, visitors: 30 }],
      { appVisitors: 30, browserVisitors: 70, appOpens: 51, confirmedInstalls: 3 }],
    [[{ eventName: 'app_open', count: Number.MAX_SAFE_INTEGER, visitors: Number.MAX_SAFE_INTEGER }, { eventName: 'app_install', count: Number.MAX_SAFE_INTEGER, visitors: 1 }],
      { appVisitors: Number.MAX_SAFE_INTEGER, browserVisitors: 0, appOpens: Number.MAX_SAFE_INTEGER, confirmedInstalls: Number.MAX_SAFE_INTEGER }],
  ]) {
    const h = harness({ upstream: url => Response.json(isAppUsageQuery(url) ? { data } : fixture(url)) });
    const report = await (await h.get()).json();
    assert.deepEqual(report.appUsage, expected);
    assert.equal(report.visitors, 75);
    assert.equal(report.pageviews, 124);
    assert.equal(report.searches, 29);
    assert.equal(report.outboundClicks, 11);
    assert.equal(report.partial, false);
    assert.deepEqual(report.warnings, []);
    assert.deepEqual(h.diagnostics, []);
    await h.get();
    assert.equal(h.providerCalls().length, 5, 'successful app usage shares the normal report cache');
  }
});

test('malformed app usage stays unavailable and retryable while website totals remain usable', async () => {
  const malformed = [
    {}, { data: null }, { data: {} }, { data: [null] }, { data: [[]] },
    { data: [{ count: 1, visitors: 1 }] },
    { data: [{ eventName: 'search_submitted', count: 1, visitors: 1 }] },
    { data: [{ eventName: 'app_open', count: 1, visitors: 1 }, { eventName: 'app_open', count: 2, visitors: 1 }] },
    { data: ['app_open', 'browser_open', 'app_install', 'app_open'].map(eventName => ({ eventName, count: 0, visitors: 0 })) },
  ];
  for (const eventName of ['app_open', 'browser_open', 'app_install']) {
    malformed.push(
      { data: [{ eventName, visitors: 1 }] },
      { data: [{ eventName, count: 1 }] },
      { data: [{ eventName, count: 0, visitors: 1 }] },
      { data: [{ eventName, count: 2, visitors: 3 }] },
    );
    for (const invalid of [null, '1', -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      malformed.push({ data: [{ eventName, count: invalid, visitors: 0 }] });
      malformed.push({ data: [{ eventName, count: 1, visitors: invalid }] });
    }
  }
  for (const payload of malformed) {
    let failing = true;
    const h = harness({ upstream: url => Response.json(failing && isAppUsageQuery(url) ? payload : fixture(url)) });
    const response = await h.get();
    assert.equal(response.status, 200);
    assertPrivate(response);
    const report = await response.json();
    assert.equal(report.appUsage, null, JSON.stringify(payload));
    assert.equal(report.visitors, 75);
    assert.equal(report.pageviews, 124);
    assert.equal(report.searches, 29);
    assert.equal(report.outboundClicks, 11);
    assert.ok(report.clicksByDestination);
    assert.equal(report.partial, true);
    assert.deepEqual(report.warnings, ['App usage is temporarily unavailable.']);
    failing = false;
    const recovered = await (await h.get()).json();
    assert.equal(recovered.partial, false);
    assert.deepEqual(recovered.appUsage, { appVisitors: 14, browserVisitors: 69, appOpens: 41, confirmedInstalls: 6 });
    assert.equal(h.providerCalls().length, 10);
  }
});

test('app usage HTTP, JSON, network and timeout failures produce safe diagnostics and immediately recover', async () => {
  for (const [response, reason, status] of [
    [() => new Response('secret raw provider body', { status: 429 }), 'http_error', 429],
    [() => new Response('secret invalid JSON'), 'invalid_json'],
    [() => { throw new Error('private-vercel-test-token secret network failure'); }, 'network_failure'],
    [() => ({ ok: true, json: () => new Promise(() => {}) }), 'timeout'],
    [() => Response.json({ data: [{ eventName: 'private-event-name', count: 115, visitors: 1 }] }), 'unknown_event'],
    [() => Response.json({ data: [{ eventName: 'app_open', count: 1, visitors: 1 }, { eventName: 'app_open', count: 1, visitors: 1 }] }), 'duplicate_event'],
    [() => Response.json({ data: [{ eventName: 'app_open', count: '115', visitors: 1 }] }), 'invalid_count'],
    [() => Response.json({ data: [{ eventName: 'app_open', count: 1, visitors: 115 }] }), 'invalid_totals'],
  ]) {
    let failing = true;
    let appSignal;
    const h = harness({ timerLimit: 15, upstream: (url, options) => {
      if (failing && isAppUsageQuery(url)) {
        appSignal = options.signal;
        return response();
      }
      return Response.json(fixture(url));
    } });
    const result = await h.get();
    assert.equal(result.status, 200);
    const report = await result.json();
    assert.equal(report.appUsage, null);
    assert.equal(report.visitors, 75);
    assert.equal(report.partial, true);
    assert.deepEqual(report.warnings, ['App usage is temporarily unavailable.']);
    assert.equal(h.diagnostics.length, 1);
    const [label, detail] = h.diagnostics[0];
    assert.equal(label, 'Owner traffic app usage unavailable');
    assert.equal(detail.reason, reason);
    assert.deepEqual(Object.keys(detail).sort(), status ? ['reason', 'status'] : ['reason']);
    if (status) assert.equal(detail.status, status);
    if (reason === 'timeout') assert.equal(appSignal.aborted, true);
    const log = JSON.stringify(h.diagnostics);
    for (const sensitive of ['private-event-name', 'secret', '115', 'owner-session-token', 'private-vercel-test-token', 'api.vercel.com', 'app_open', APP_USAGE_FILTER]) assert.ok(!log.includes(sensitive), sensitive);
    failing = false;
    assert.equal((await (await h.get()).json()).partial, false);
    assert.equal(h.providerCalls().length, 10);
  }
});

test('null and empty referrers display direct/unknown while Others remains a separate provider group', async () => {
  const h = harness({ upstream: url => Response.json(url.searchParams.get('by') === 'referrerHostname' ? {
    data: [null, '', 'Others'].map(referrerHostname => ({ referrerHostname, visitors: 1, pageviews: 2 })),
  } : fixture(url)) });
  const report = await (await h.get()).json();
  assert.deepEqual(report.sources.map(row => row.source), ['Direct / unknown', 'Direct / unknown', 'Others']);
});

test('malformed core totals never become zeros or get cached', async () => {
  for (const payload of [
    {}, { data: null }, { data: {} }, { data: [null] },
    { data: [{ environment: 'preview', visitors: 1, pageviews: 2 }] },
    { data: [{ environment: 'production', visitors: '75', pageviews: 124 }] },
    { data: [{ environment: 'production', visitors: -1, pageviews: 124 }] },
    { data: [{ environment: 'production', visitors: 0.1, pageviews: 124 }] },
    { data: [{ environment: 'production', visitors: 75, pageviews: null }] },
    { data: [{ environment: 'production', visitors: 75, pageviews: Number.MAX_SAFE_INTEGER + 1 }] },
    { data: [fixture('https://example.test/?by=environment').data[0], fixture('https://example.test/?by=environment').data[0]] },
  ]) {
    let failed = true;
    const h = harness({ upstream: url => Response.json(failed && url.searchParams.get('by') === 'environment' ? payload : fixture(url)) });
    const response = await h.get();
    assert.equal(response.status, 502, JSON.stringify(payload));
    assertPrivate(response);
    assert.equal((await response.json()).code, 'provider_unavailable');
    failed = false;
    assert.equal((await h.get()).status, 200);
    assert.equal(h.providerCalls().length, 10);
  }
});

test('provider HTTP and JSON failures are safe errors, never fabricated counts', async () => {
  for (const makeResponse of [
    () => new Response(`${defaultEnv.MEKIVO_ANALYTICS_VERCEL_TOKEN} secret error`, { status: 403 }),
    () => new Response('rate limited secret', { status: 429 }),
    () => new Response('<html>not JSON</html>', { status: 200 }),
  ]) {
    const h = harness({ upstream: makeResponse });
    const response = await h.get();
    assert.equal(response.status, 502);
    assertPrivate(response);
    const body = await response.text();
    assert.ok(!body.includes(defaultEnv.MEKIVO_ANALYTICS_VERCEL_TOKEN));
    assert.ok(!body.includes('secret'));
    assert.ok(!body.includes('owner-session-token'));
    assert.ok(!body.includes('visitors'));
  }
});

test('failed optional sections remain null with warnings and Retry immediately recovers', async () => {
  for (const failedGroup of ['eventName', 'referrerHostname']) {
    let failing = true;
    const h = harness({ upstream: url => failing && (failedGroup === 'eventName' ? isFunnelEventsQuery(url) : url.searchParams.get('by') === failedGroup)
      ? new Response('failed', { status: 503 }) : Response.json(fixture(url)) });
    const response = await h.get();
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.equal(report.visitors, 75);
    assert.equal(report.partial, true);
    assert.equal(report.warnings.length, 1);
    if (failedGroup === 'eventName') {
      assert.equal(report.searches, null);
      assert.equal(report.outboundClicks, null);
      assert.equal(report.clicksByDestination, null);
      assert.equal(report.marketplaceClicks, null);
      assert.equal(report.sources.length, 2);
    } else {
      assert.equal(report.sources, null);
      assert.equal(report.searches, 29);
    }
    failing = false;
    assert.equal((await (await h.get()).json()).partial, false);
    assert.equal(h.providerCalls().length, 10);
  }
});

test('invalid optional numbers, duplicate event groups and missing source names are unavailable', async () => {
  for (const [group, payload] of [
    ['eventName', { data: [{ eventName: 'search_submitted', count: '10' }] }],
    ['eventName', { data: [{ eventName: 'save_confirmed', count: 10 }] }],
    ['eventName', { data: [{ eventName: 'search_submitted', count: 10 }, { eventName: 'search_submitted', count: 5 }] }],
    ['referrerHostname', { data: [{ visitors: 1, pageviews: 2 }] }],
    ['referrerHostname', { data: [{ referrerHostname: 'facebook.com', visitors: -2, pageviews: 2 }] }],
  ]) {
    const h = harness({ upstream: url => Response.json((group === 'eventName' ? isFunnelEventsQuery(url) : url.searchParams.get('by') === group) ? payload : fixture(url)) });
    const report = await (await h.get()).json();
    assert.equal(report.partial, true);
    assert.equal(report[group === 'eventName' ? 'searches' : 'sources'], null);
  }
});

for (const phase of ['auth headers', 'auth body', 'admin body']) {
  test(`authorization deadline covers stalled ${phase} and never reaches analytics`, async () => {
    let signal;
    const h = harness({ timerLimit: 15, authFetch: async (url, options) => {
      const isAuth = url.pathname === '/auth/v1/user';
      if ((phase.startsWith('auth') && isAuth) || (phase.startsWith('admin') && !isAuth)) {
        signal = options.signal;
        if (phase.endsWith('headers')) return new Promise(() => {});
        return { ok: true, status: 200, statusText: 'OK', headers: new Headers(),
          json: () => new Promise(() => {}), text: () => new Promise(() => {}) };
      }
    } });
    const response = await h.get();
    assert.equal(response.status, 504);
    assert.equal((await response.json()).code, 'auth_timeout');
    assert.equal(signal.aborted, true);
    assert.equal(h.providerCalls().length, 0);
    assertPrivate(response);
  });
}

for (const phase of ['headers', 'body']) {
  test(`provider deadline covers stalled ${phase}, including a fetch that ignores abort`, async () => {
    const signals = [];
    const h = harness({ timerLimit: 15, upstream: async (_url, options) => {
      signals.push(options.signal);
      return phase === 'headers' ? new Promise(() => {}) : { ok: true, json: () => new Promise(() => {}) };
    } });
    const response = await h.get();
    assert.equal(response.status, 504);
    assert.equal((await response.json()).code, 'provider_timeout');
    assert.equal(signals.length, 5);
    assert.ok(signals.every(signal => signal.aborted));
    assertPrivate(response);
  });
}

test('optional provider timeout preserves core traffic and reports missing event counts', async () => {
  const h = harness({ timerLimit: 15, upstream: async url => isFunnelEventsQuery(url)
    ? { ok: true, json: () => new Promise(() => {}) } : Response.json(fixture(url)) });
  const response = await h.get();
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.equal(report.visitors, 75);
  assert.equal(report.searches, null);
  assert.equal(report.outboundClicks, null);
  assert.equal(report.clicksByDestination, null);
  assert.equal(report.marketplaceClicks, null);
  assert.equal(report.partial, true);
});


test('custom dates are inclusive UK calendar days, capped at 31 days with independent cache keys', async () => {
  const h = harness(); h.advance(12 * 86400_000);
  const report = await (await h.get('range=custom&from=2026-09-14&to=2026-09-27')).json();
  assert.equal(report.range, 'custom');
  assert.deepEqual(report.calendarDates, { from: '2026-09-14', to: '2026-09-27' });
  assert.equal(report.since, '2026-09-13T23:00:00.000Z');
  assert.equal(report.until, '2026-09-27T22:59:59.999Z');
  for (const call of h.providerCalls()) {
    const query = new URL(call.url).searchParams;
    assert.equal(query.get('since'), report.since); assert.equal(query.get('until'), report.until);
  }
  await h.get('range=custom&from=2026-09-14&to=2026-09-27');
  assert.equal(h.providerCalls().length, 5);
  await h.get('range=custom&from=2026-09-15&to=2026-09-27');
  assert.equal(h.providerCalls().length, 10);
  const today = await (await h.get('range=custom&from=2026-09-29&to=2026-09-29')).json();
  assert.equal(today.until, today.fetchedAt, 'today stops at the report time');
  assert.equal((await h.get('range=custom&from=2026-08-30&to=2026-09-29')).status, 200);
  const before = h.providerCalls().length;
  for (const query of [
    'range=custom', 'range=custom&from=2026-09-01',
    'range=custom&from=2026-09-27&to=2026-09-14',
    'range=custom&from=2026-08-29&to=2026-09-29',
    'range=custom&from=2026-09-01&to=2026-09-30',
    'range=custom&from=2026-02-30&to=2026-03-01',
    'range=custom&from=2026-09-14T00:00:00Z&to=2026-09-27',
    'range=custom&from=2026-09-14&from=2026-09-15&to=2026-09-27',
    'range=custom&from=2026-09-14&to=2026-09-27&to=2026-09-28',
    'range=7d&from=2026-09-14&to=2026-09-27',
  ]) assert.equal((await h.get(query)).status, 400, query);
  assert.equal(h.providerCalls().length, before, 'invalid dates never query the provider');
});

test('UK calendar boundaries handle spring-forward, autumn-back and leap years without fixed 24-hour assumptions', async () => {
  for (const [from, to, since, until, hours] of [
    ['2025-03-30', '2025-03-30', '2025-03-30T00:00:00.000Z', '2025-03-30T22:59:59.999Z', 23],
    ['2025-10-26', '2025-10-26', '2025-10-25T23:00:00.000Z', '2025-10-26T23:59:59.999Z', 25],
    ['2024-02-29', '2024-02-29', '2024-02-29T00:00:00.000Z', '2024-02-29T23:59:59.999Z', 24],
  ]) {
    const response = await harness().get(`range=custom&from=${from}&to=${to}`);
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.equal(report.since, since); assert.equal(report.until, until);
    assert.equal(Date.parse(report.until) - Date.parse(report.since) + 1, hours * 3600_000);
  }
  assert.equal((await harness().get('range=custom&from=2025-02-29&to=2025-03-01')).status, 400);
});

test('documented context rows classify only complete known labels; old or grouped values stay unclassified', async () => {
  const contexts = ['cars:ebay:listing', 'cars:ebay:all_results', 'parts:ebay:listing', 'parts:ebay:search_results', 'parts:gumtree:search_results', 'cars:facebook:search_results', null, '', 'Others', 'cars:ebay:unknown', 'unknown:ebay:listing'];
  const h = harness({ upstream: url => Response.json(url.searchParams.get('by') === 'eventData/context' ? { data: contexts.map(eventData => ({ eventData, count: 1 })) } : fixture(url)) });
  const report = await (await h.get()).json();
  assert.deepEqual(report.clicksByDestination, { ebayCars: 2, ebayParts: 2, otherMarketplaces: 2, unclassified: 5 });
  assert.deepEqual(report.marketplaceClicks.find(row => row.marketplace === 'unclassified'), { marketplace: 'unclassified', cars: null, parts: null, clicks: 5 });
  assert.deepEqual(report.marketplaceClicks.find(row => row.marketplace === 'gumtree'), { marketplace: 'gumtree', cars: 0, parts: 1, clicks: 1 });
  assert.equal(report.partial, false);
});

test('named marketplaces combine destination contexts while keeping car and parts clicks separate', async () => {
  const contexts = [
    ['cars:ebay:listing', 4], ['cars:ebay:all_results', 3], ['cars:ebay:search_results', 2],
    ['parts:ebay:listing', 5], ['parts:ebay:all_results', 6], ['parts:ebay:search_results', 1],
    ['cars:autotrader:search_results', 2], ['cars:facebook:search_results', 3], ['cars:motors:search_results', 4],
    ['cars:gumtree:search_results', 5], ['parts:gumtree:search_results', 6], ['cars:cargurus:search_results', 7],
    ['cars:pistonheads:search_results', 8], ['cars:aacars:search_results', 9], ['cars:carandclassic:search_results', 10],
    [null, 11], ['facebook', 12], ['Others', 13], ['cars:new-marketplace:listing', 14], ['parts:gumtree:unknown', 15],
  ];
  const h = harness({ upstream: url => Response.json(url.searchParams.get('by') === 'eventData/context'
    ? { data: contexts.map(([context, count]) => ({ 'eventData/context': context, count })) }
    : isFunnelEventsQuery(url) ? { data: [{ eventName: 'marketplace_outbound', count: 140 }] } : fixture(url)) });
  const report = await (await h.get()).json();
  assert.deepEqual(report.marketplaceClicks, [
    { marketplace: 'ebay', cars: 9, parts: 12, clicks: 21 },
    { marketplace: 'autotrader', cars: 2, parts: 0, clicks: 2 },
    { marketplace: 'facebook', cars: 3, parts: 0, clicks: 3 },
    { marketplace: 'motors', cars: 4, parts: 0, clicks: 4 },
    { marketplace: 'gumtree', cars: 5, parts: 6, clicks: 11 },
    { marketplace: 'cargurus', cars: 7, parts: 0, clicks: 7 },
    { marketplace: 'pistonheads', cars: 8, parts: 0, clicks: 8 },
    { marketplace: 'aacars', cars: 9, parts: 0, clicks: 9 },
    { marketplace: 'carandclassic', cars: 10, parts: 0, clicks: 10 },
    { marketplace: 'unclassified', cars: null, parts: null, clicks: 65 },
  ]);
  assert.deepEqual(report.clicksByDestination, { ebayCars: 9, ebayParts: 12, otherMarketplaces: 54, unclassified: 65 });
  assert.equal(report.marketplaceClicks.reduce((sum, row) => sum + row.clicks, 0), report.outboundClicks);
  assert.equal(report.partial, false);
  assert.equal(h.providerCalls().length, 5, 'named breakdown reuses the existing context query');
});

test('top-100 contexts plus the provider Others row retain all clicks as unclassified', async () => {
  const h = harness({ upstream: url => Response.json(url.searchParams.get('by') === 'eventData/context'
    ? { data: [...Array.from({ length: 100 }, (_, i) => ({ eventData: `legacy-${i}`, count: 1 })), { eventData: 'Others', count: 7 }] }
    : isFunnelEventsQuery(url) ? { data: [{ eventName: 'marketplace_outbound', count: 107 }] } : fixture(url)) });
  const report = await (await h.get()).json();
  assert.equal(report.partial, false);
  assert.equal(report.marketplaceClicks.length, 10);
  assert.deepEqual(report.marketplaceClicks.find(row => row.marketplace === 'unclassified'), { marketplace: 'unclassified', cars: null, parts: null, clicks: 107 });
  assert.equal(report.marketplaceClicks.reduce((sum, row) => sum + row.clicks, 0), report.outboundClicks);
});

test('failed, malformed or unreconciled click breakdowns are unavailable and retryable, never fabricated zeros', async () => {
  for (const payload of [
    { data: [{ eventData: 'cars:ebay:listing', count: '11' }] },
    { data: [{ context: 'cars:ebay:listing', count: 11 }] },
    { data: [{ eventData: { context: 'cars:ebay:listing' }, count: 11 }] },
    { data: [{ eventData: 'cars:ebay:listing', count: -1 }] },
    { data: [{ eventData: 'cars:ebay:listing', count: 1.5 }] },
    { data: [{ eventData: 'cars:ebay:listing', count: Number.MAX_SAFE_INTEGER + 1 }] },
    { data: [{ eventData: 'cars:ebay:listing', count: Number.MAX_SAFE_INTEGER }, { eventData: 'parts:gumtree:search_results', count: 1 }] },
    { data: [{ eventData: 'cars:ebay:listing', count: 5 }, { eventData: 'cars:ebay:listing', count: 6 }] },
    { data: [{ eventData: 'cars:ebay:listing', count: 12 }] }, { data: [] },
    { data: Array.from({ length: 102 }, (_, i) => ({ eventData: String(i), count: 0 })) },
  ]) {
    let failing = true;
    const h = harness({ upstream: url => Response.json(failing && url.searchParams.get('by') === 'eventData/context' ? payload : fixture(url)) });
    const report = await (await h.get()).json();
    assert.equal(report.outboundClicks, 11); assert.equal(report.clicksByDestination, null); assert.equal(report.partial, true);
    assert.equal(report.marketplaceClicks, null);
    failing = false;
    assert.equal((await (await h.get()).json()).partial, false);
    assert.equal(h.providerCalls().length, 10);
  }
  const h = harness({ upstream: url => url.searchParams.get('by') === 'eventData/context' ? new Response('fail', { status: 503 }) : Response.json(fixture(url)) });
  const report = await (await h.get()).json();
  assert.equal(report.clicksByDestination, null);
  assert.equal(report.marketplaceClicks, null);
});


test('destination diagnostics reveal only a safe failure category and HTTP status, never schema or values', async () => {
  const samples = [
    [() => new Response('secret raw provider body', { status: 400 }), 'http_error'],
    [() => new Response('secret invalid JSON'), 'invalid_json'],
    [() => Response.json({ data: [{ context: 'private-context-value', count: 115 }] }), 'invalid_context'],
    [() => Response.json({ data: [{ eventData: { context: 'private-context-value' }, count: 115 }] }), 'invalid_context'],
    [() => Response.json({ data: [{ 'private-schema-key': 'private-context-value', count: 115 }] }), 'invalid_context'],
    [() => Response.json({ data: [{ eventData: 'private-context-value', count: '115' }] }), 'invalid_count'],
    [() => Response.json({ data: [{ eventData: 'cars:ebay:listing', count: 115 }] }), 'totals_mismatch'],
  ];
  for (const [response, expected] of samples) {
    const h = harness({ upstream: url => url.searchParams.get('by') === 'eventData/context' ? response() : Response.json(fixture(url)) });
    const report = await (await h.get()).json();
    assert.equal(report.clicksByDestination, null);
    assert.equal(report.marketplaceClicks, null);
    assert.equal(h.diagnostics.length, 1);
    const [label, detail] = h.diagnostics[0];
    assert.equal(label, 'Owner traffic destination breakdown unavailable');
    assert.equal(detail.reason, expected);
    const log = JSON.stringify(h.diagnostics);
    for (const sensitive of ['private-context-value', 'private-schema-key', 'secret', '115', 'owner-session-token', 'private-vercel-test-token', 'api.vercel.com', 'cars:ebay:listing']) assert.ok(!log.includes(sensitive), sensitive);
    if (expected === 'http_error') assert.equal(detail.status, 400);
    assert.deepEqual(Object.keys(detail).sort(), expected === 'http_error' ? ['reason', 'status'] : ['reason']);
  }
});


test('observed literal eventData/context rows and documented eventData rows both retain correct classification', async () => {
  // Counts are synthetic; the literal response column was observed in the
  // authenticated production provider diagnostic on 29 September 2026.
  for (const row of [
    { 'eventData/context': 'parts:ebay:listing', count: 11, visitors: 8 },
    { eventData: 'parts:ebay:listing', count: 11, visitors: 8 },
    { 'eventData/context': 'parts:ebay:listing', eventData: 'parts:ebay:listing', count: 11 },
  ]) {
    const h = harness({ upstream: url => Response.json(url.searchParams.get('by') === 'eventData/context' ? { data: [row] } : fixture(url)) });
    const report = await (await h.get()).json();
    assert.deepEqual(report.clicksByDestination, { ebayCars: 0, ebayParts: 11, otherMarketplaces: 0, unclassified: 0 });
    assert.deepEqual(report.marketplaceClicks.find(row => row.marketplace === 'ebay'), { marketplace: 'ebay', cars: 0, parts: 11, clicks: 11 });
    assert.equal(report.partial, false); assert.deepEqual(h.diagnostics, []);
  }
});

test('conflicting grouping aliases and duplicate contexts across response formats cannot produce misleading numbers', async () => {
  for (const data of [
    [{ 'eventData/context': 'cars:ebay:listing', eventData: 'parts:ebay:listing', count: 11 }],
    [{ 'eventData/context': null, eventData: 'parts:ebay:listing', count: 11 }],
    [{ 'eventData/context': 'cars:ebay:listing', count: 5 }, { eventData: 'cars:ebay:listing', count: 6 }],
  ]) {
    const h = harness({ upstream: url => Response.json(url.searchParams.get('by') === 'eventData/context' ? { data } : fixture(url)) });
    const report = await (await h.get()).json();
    assert.equal(report.outboundClicks, 11); assert.equal(report.clicksByDestination, null); assert.equal(report.partial, true);
    assert.equal(report.marketplaceClicks, null);
    assert.ok(['conflicting_context', 'duplicate_context'].includes(h.diagnostics[0][1].reason));
  }
});
