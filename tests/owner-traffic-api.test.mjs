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

function fixture(url) {
  const query = new URL(url);
  switch (query.searchParams.get('by')) {
    case 'environment': return { data: [{ environment: 'production', visitors: 75, pageviews: 124 }] };
    // These source visitor counts deliberately total more than the period total.
    case 'referrerHostname': return { data: [
      { referrerHostname: null, visitors: 50, pageviews: 70 },
      { referrerHostname: 'l.facebook.com', visitors: 45, pageviews: 54 },
    ] };
    case 'eventName': return { data: [
      { eventName: 'search_submitted', count: 29, visitors: 15 },
      { eventName: 'marketplace_outbound', count: 11, visitors: 8 },
    ] };
    default: throw new Error('Unexpected analytics grouping');
  }
}

function harness({ env: overrides = {}, upstream, authFetch, timerLimit } = {}) {
  const env = { ...defaultEnv, ...overrides };
  const calls = [];
  const clients = [];
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
      console: { error() {}, warn() {} }, fetch: fetchMock,
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
    env, state, calls, clients,
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
  assert.equal(h.providerCalls().length, 3);
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
      assert.equal(query.searchParams.get('filter'), "environment eq 'production' and (eventName eq 'search_submitted' or eventName eq 'marketplace_outbound')");
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
  assert.equal(h.providerCalls().length, 3);
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
  assert.equal(h.providerCalls().length, 3);
});

test('missing authentication configuration fails closed', async () => {
  const h = harness({ env: { NEXT_PUBLIC_SUPABASE_ANON_KEY: '' } });
  const response = await h.get();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'auth_unavailable');
  assertPrivate(response);
  assert.equal(h.calls.length, 0);
});

test('only fixed rolling ranges are accepted, with an independent cached snapshot for each', async () => {
  const h = harness();
  for (const [range, days] of [['24h', 1], ['7d', 7], ['30d', 30]]) {
    const response = await h.get(`range=${range}`);
    const report = await response.json();
    assert.equal(report.range, range);
    assert.equal(Date.parse(report.until) - Date.parse(report.since), days * 86400_000);
    await h.get(`range=${range}`);
  }
  assert.equal(h.providerCalls().length, 9);
  for (const query of ['range=', 'range=all', 'range=__proto__', 'range=365d', 'range=7d&range=30d']) {
    const response = await h.get(query);
    assert.equal(response.status, 400);
    assertPrivate(response);
  }
  assert.equal(h.providerCalls().length, 9);
});

test('snapshot cache expires at five minutes without extending expiry on reads', async () => {
  const h = harness();
  const first = await (await h.get()).json();
  h.advance(299_999);
  const cached = await (await h.get()).json();
  assert.deepEqual(cached, first);
  assert.equal(h.providerCalls().length, 3);
  h.advance(1);
  const refreshed = await (await h.get()).json();
  assert.notEqual(refreshed.fetchedAt, first.fetchedAt);
  assert.equal(h.providerCalls().length, 6);
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
    assert.equal(h.providerCalls().length - before, 3);
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
  assert.equal(h.providerCalls().length, 14 * 3);
});

test('an empty valid provider dataset means zero, including missing event groups', async () => {
  const h = harness({ upstream: () => Response.json({ data: [] }) });
  const report = await (await h.get()).json();
  assert.equal(report.visitors, 0);
  assert.equal(report.pageviews, 0);
  assert.equal(report.searches, 0);
  assert.equal(report.outboundClicks, 0);
  assert.deepEqual(report.sources, []);
  assert.equal(report.partial, false);
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
    assert.equal(h.providerCalls().length, 6);
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
    const h = harness({ upstream: url => failing && url.searchParams.get('by') === failedGroup
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
      assert.equal(report.sources.length, 2);
    } else {
      assert.equal(report.sources, null);
      assert.equal(report.searches, 29);
    }
    failing = false;
    assert.equal((await (await h.get()).json()).partial, false);
    assert.equal(h.providerCalls().length, 6);
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
    const h = harness({ upstream: url => Response.json(url.searchParams.get('by') === group ? payload : fixture(url)) });
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
    assert.equal(signals.length, 3);
    assert.ok(signals.every(signal => signal.aborted));
    assertPrivate(response);
  });
}

test('optional provider timeout preserves core traffic and reports missing event counts', async () => {
  const h = harness({ timerLimit: 15, upstream: async url => url.searchParams.get('by') === 'eventName'
    ? { ok: true, json: () => new Promise(() => {}) } : Response.json(fixture(url)) });
  const response = await h.get();
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.equal(report.visitors, 75);
  assert.equal(report.searches, null);
  assert.equal(report.outboundClicks, null);
  assert.equal(report.partial, true);
});
