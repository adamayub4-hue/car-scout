import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const audienceCode = compile('../app/lib/analytics-audience.ts');
const savedCode = compile('../app/lib/saved-search.ts');
const marker = 'mekivo_internal_traffic';
const session = id => id ? { user: { id } } : null;
const sessionResult = id => ({ data: { session: session(id) }, error: null });
const membership = id => ({ data: id ? { user_id: id } : null, error: null });
const pageview = { type: 'pageview', url: 'https://mekivo.uk/' };
const customEvent = { type: 'event', url: 'https://mekivo.uk/?mode=parts' };

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function settle() { for (let index = 0; index < 12; index++) await Promise.resolve(); }

function harness(options = {}) {
  const storage = options.storage ?? new Map();
  const timers = new Map(), domListeners = new Map(), roleRequests = [], authListeners = [];
  const flags = { storageDenied: options.storageDenied ?? false };
  const calls = { clients: 0, sessions: 0 };
  const initial = options.initial ?? deferred();
  let now = 0, nextTimer = 0;
  const setTimer = (callback, delay) => { const id = ++nextTimer; timers.set(id, { at: now + delay, callback }); return id; };
  const clearTimer = id => timers.delete(id);
  const window = {
    location: new URL(options.url ?? 'https://mekivo.uk/'),
    localStorage: {
      getItem(key) { if (flags.storageDenied) throw new Error('Storage denied'); return storage.get(key) ?? null; },
      setItem(key, value) { if (flags.storageDenied) throw new Error('Storage denied'); storage.set(key, value); },
    },
    addEventListener(type, callback) {
      if (!domListeners.has(type)) domListeners.set(type, new Set());
      domListeners.get(type).add(callback);
    },
    setTimeout: setTimer, clearTimeout: clearTimer,
  };
  const client = {
    auth: {
      getSession() { calls.sessions++; return initial.promise; },
      onAuthStateChange(callback) {
        authListeners.push(callback);
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    from(table) {
      assert.equal(table, 'admins', 'the audience check only needs owner membership');
      let userId;
      return {
        select(columns) { assert.equal(columns, 'user_id'); return this; },
        eq(key, value) { assert.equal(key, 'user_id'); userId = value; return this; },
        maybeSingle() {
          const request = { userId, ...deferred() };
          roleRequests.push(request);
          return request.promise;
        },
      };
    },
  };
  const context = {
    URL, URLSearchParams, setTimeout: setTimer, clearTimeout: clearTimer,
    process: { env: { NODE_ENV: options.nodeEnv ?? 'production', NEXT_PUBLIC_VERCEL_ENV: options.vercelEnv ?? 'production' } },
    ...(options.server ? {} : { window }),
  };
  const saved = {};
  vm.runInNewContext(savedCode, { ...context, exports: saved });
  const api = {};
  vm.runInNewContext(audienceCode, {
    ...context, exports: api,
    require(name) {
      if (name === './saved-search') return saved;
      if (name === './supabase') return { getSupabaseBrowserClient() { calls.clients++; return options.noClient ? null : client; } };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return {
    api, storage, flags, calls, initial, roleRequests, timers,
    navigate(url) { window.location = new URL(url, window.location.origin); },
    auth(event, id) { for (const listener of authListeners) listener(event, session(id)); },
    storageEvent(key, newValue) {
      if (key === null) storage.clear();
      else if (newValue === null) storage.delete(key);
      else storage.set(key, newValue);
      for (const listener of domListeners.get('storage') ?? []) listener({ key, newValue });
    },
    async advance(ms) {
      const end = now + ms;
      await settle();
      for (let count = 0; timers.size; count++) {
        assert.ok(count < 100, 'policy timers must remain bounded');
        const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (timer.at > end) break;
        now = timer.at; timers.delete(id); timer.callback(); await settle();
      }
      now = end;
    },
  };
}

async function anonymous(options = {}) {
  const h = harness(options);
  h.api.initializeAnalyticsAudience();
  h.initial.resolve(sessionResult(null));
  await settle();
  return h;
}

test('owner detection excludes the first pageview and custom event before a browser marker exists', async () => {
  const h = harness();
  assert.equal(h.api.analyticsAudience(), 'pending');
  assert.equal(h.api.filterAnalyticsEvent(pageview), null);
  h.api.initializeAnalyticsAudience();
  h.initial.resolve(sessionResult('owner'));
  await settle();
  assert.equal(h.api.analyticsAudience(), 'pending');
  assert.equal(h.api.filterAnalyticsEvent(customEvent), null);
  assert.equal(h.roleRequests[0].userId, 'owner');
  h.roleRequests[0].resolve(membership('owner'));
  await settle();
  assert.equal(h.api.analyticsAudience(), 'excluded');
  assert.equal(h.api.filterAnalyticsEvent(pageview), null);
  assert.equal(h.api.filterAnalyticsEvent(customEvent), null);
  assert.deepEqual([...h.storage], [[marker, '1']], 'only a boolean flag is persisted, never the owner ID');
});

test('ordinary anonymous visitors are included without an owner-table query', async () => {
  const h = await anonymous();
  assert.equal(h.api.analyticsAudience(), 'included');
  assert.strictEqual(h.api.filterAnalyticsEvent(pageview), pageview);
  assert.strictEqual(h.api.filterAnalyticsEvent(customEvent), customEvent);
  assert.equal(h.roleRequests.length, 0);
  h.api.initializeAnalyticsAudience();
  assert.equal(h.calls.sessions, 1, 'initialization remains a singleton');
});

test('a signed-in customer stays pending until their nonowner status is confirmed', async () => {
  const h = harness(); h.api.initializeAnalyticsAudience();
  h.initial.resolve(sessionResult('customer')); await settle();
  assert.equal(h.api.filterAnalyticsEvent(pageview), null);
  assert.equal(h.api.analyticsAudience(), 'pending');
  h.roleRequests[0].resolve(membership(null)); await settle();
  assert.equal(h.api.analyticsAudience(), 'included');
  assert.strictEqual(h.api.filterAnalyticsEvent(customEvent), customEvent);
  assert.equal(h.api.browserExclusionStatus(), 'off');
});

test('the persisted browser marker excludes signed-out reloads and cannot be undone by analytics=on', () => {
  const h = harness({ storage: new Map([[marker, '1']]), url: 'https://mekivo.uk/?analytics=on' });
  assert.equal(h.api.analyticsAudience(), 'excluded');
  h.api.initializeAnalyticsAudience();
  assert.equal(h.api.browserExclusionStatus(), 'saved');
  assert.equal(h.calls.clients, 0);
  assert.equal(h.api.filterAnalyticsEvent(pageview), null);
});

test('analytics=off excludes the first event and persists through clean navigation', () => {
  const h = harness({ url: 'https://mekivo.uk/?analytics=off' });
  assert.equal(h.api.filterAnalyticsEvent(pageview), null);
  h.api.initializeAnalyticsAudience();
  assert.equal(h.api.browserExclusionStatus(), 'saved');
  h.navigate('/?analytics=on');
  assert.equal(h.api.analyticsAudience(), 'excluded');
  const reloaded = harness({ storage: h.storage });
  assert.equal(reloaded.api.analyticsAudience(), 'excluded');
});

test('blocked storage still excludes this page and remains excluded after sign-out', async () => {
  const h = await anonymous({ storageDenied: true });
  assert.equal(h.api.analyticsAudience(), 'included');
  assert.doesNotThrow(() => h.api.excludeThisBrowser());
  assert.equal(h.api.browserExclusionStatus(), 'temporary');
  h.auth('SIGNED_OUT', null); await h.advance(0);
  h.navigate('/?mode=parts');
  assert.equal(h.api.analyticsAudience(), 'excluded');
  assert.equal(h.api.filterAnalyticsEvent(customEvent), null);
  assert.equal(h.storage.size, 0);
});

test('owner recognition retains exclusion after sign-out in the same page', async () => {
  const h = harness(); h.api.initializeAnalyticsAudience();
  h.initial.resolve(sessionResult('owner')); await settle();
  h.roleRequests[0].resolve(membership('owner')); await settle();
  h.auth('SIGNED_OUT', null);
  assert.equal(h.api.filterAnalyticsEvent(pageview), null, 'sign-out must not create a sending window');
  await h.advance(0);
  assert.equal(h.api.analyticsAudience(), 'excluded');
  assert.equal(h.api.browserExclusionStatus(), 'saved');
});

for (const errorKind of ['session-error', 'session-rejection', 'membership-error', 'membership-rejection']) {
  test(`${errorKind} excludes analytics rather than assuming a nonowner`, async () => {
    const h = harness(); h.api.initializeAnalyticsAudience();
    if (errorKind === 'session-error') h.initial.resolve({ data: { session: null }, error: new Error('Auth unavailable') });
    else if (errorKind === 'session-rejection') h.initial.reject(new Error('Offline'));
    else {
      h.initial.resolve(sessionResult('unknown-user')); await settle();
      if (errorKind === 'membership-error') h.roleRequests[0].resolve({ data: null, error: new Error('Permission check failed') });
      else h.roleRequests[0].reject(new Error('Offline'));
    }
    await settle();
    assert.equal(h.api.analyticsAudience(), 'excluded');
    assert.equal(h.api.filterAnalyticsEvent(pageview), null);
    assert.equal(h.api.filterAnalyticsEvent(customEvent), null);
  });
}

for (const stage of ['session', 'membership']) {
  test(`${stage} timeout excludes and a late response cannot reopen tracking`, async () => {
    const h = harness(); h.api.initializeAnalyticsAudience();
    if (stage === 'membership') { h.initial.resolve(sessionResult('customer')); await settle(); }
    await h.advance(4999);
    assert.equal(h.api.analyticsAudience(), 'pending');
    await h.advance(1);
    assert.equal(h.api.analyticsAudience(), 'excluded');
    if (stage === 'session') h.initial.resolve(sessionResult(null));
    else h.roleRequests[0].resolve(membership(null));
    await settle();
    assert.equal(h.api.analyticsAudience(), 'excluded');
    assert.equal(h.timers.size, 0);
  });
}

test('sign-in blocks immediately and stale nonowner checks cannot override the newer owner', async () => {
  const h = await anonymous();
  h.auth('SIGNED_IN', 'customer');
  assert.equal(h.api.analyticsAudience(), 'pending');
  assert.equal(h.api.filterAnalyticsEvent(pageview), null);
  await h.advance(0);
  h.auth('SIGNED_IN', 'owner'); await h.advance(0);
  h.roleRequests[0].resolve(membership(null)); await settle();
  assert.equal(h.api.analyticsAudience(), 'pending');
  h.roleRequests[1].resolve(membership('owner')); await settle();
  assert.equal(h.api.analyticsAudience(), 'excluded');
  assert.equal(h.api.browserExclusionStatus(), 'saved');
});

test('a late initial session response cannot override owner sign-in', async () => {
  const h = harness(); h.api.initializeAnalyticsAudience();
  h.auth('SIGNED_IN', 'owner'); await h.advance(0);
  h.roleRequests[0].resolve(membership('owner')); await settle();
  h.initial.resolve(sessionResult(null)); await settle();
  assert.equal(h.api.analyticsAudience(), 'excluded');
  assert.equal(h.api.filterAnalyticsEvent(customEvent), null);
});

test('confirmed owner membership arriving after sign-out still excludes that testing browser', async () => {
  const h = harness({ url: 'https://mekivo.uk/account' });
  h.api.initializeAnalyticsAudience();
  h.initial.resolve(sessionResult('owner')); await settle();
  h.auth('SIGNED_OUT', null); await h.advance(0);
  h.navigate('/');
  assert.equal(h.api.analyticsAudience(), 'excluded', 'sign-out must not release the unresolved owner visit as anonymous');
  assert.equal(h.api.filterAnalyticsEvent(pageview), null);
  h.roleRequests[0].resolve(membership('owner')); await settle();
  h.navigate('/');
  assert.equal(h.api.analyticsAudience(), 'excluded');
  assert.equal(h.api.browserExclusionStatus(), 'saved');
  assert.equal(h.api.filterAnalyticsEvent(pageview), null);
});

test('manual exclusion cannot be undone by an in-flight customer check', async () => {
  const h = harness(); h.api.initializeAnalyticsAudience();
  h.initial.resolve(sessionResult('customer')); await settle();
  h.api.excludeThisBrowser();
  h.roleRequests[0].resolve(membership(null)); await settle();
  assert.equal(h.api.analyticsAudience(), 'excluded');
});

test('exclusion in another tab notifies subscribers and blocks already-loaded SDK events', async () => {
  const h = await anonymous();
  let notifications = 0;
  const unsubscribe = h.api.subscribeAnalyticsAudience(() => { notifications++; });
  h.storageEvent(marker, '1');
  assert.equal(notifications, 1);
  assert.equal(h.api.analyticsAudience(), 'excluded');
  assert.equal(h.api.filterAnalyticsEvent(customEvent), null);
  unsubscribe(); h.storageEvent('unrelated', 'value');
  assert.equal(notifications, 1);
});

test('internal and testing routes are excluded both at navigation and when a queued event arrives later', async () => {
  const h = await anonymous();
  for (const path of ['/admin', '/admin/reports', '/traffic-settings', '/account', '/account/reset-password', '/forgot-password', '/reset-password']) {
    h.navigate(path);
    assert.equal(h.api.analyticsAudience(), 'excluded', path);
    h.navigate('/');
    assert.equal(h.api.analyticsAudience(), 'included');
    assert.equal(h.api.filterAnalyticsEvent({ type: 'pageview', url: `https://mekivo.uk${path}` }), null, path);
  }
  assert.equal(h.api.filterAnalyticsEvent({ type: 'event', url: '/?analytics=off' }), null);
  assert.strictEqual(h.api.filterAnalyticsEvent(pageview), pageview);
  assert.ok(h.api.filterAnalyticsEvent({ type: 'pageview', url: '/guides/finding-the-right-car-part' }));
  assert.equal(h.api.filterAnalyticsEvent({ type: 'event', url: 'https://not-mekivo.test/' }), null);
});

for (const options of [
  { url: 'http://localhost:3000/' },
  { url: 'http://127.0.0.1:3000/' },
  { url: 'https://car-scout-preview.vercel.app/' },
  { url: 'https://mekivo.uk/', vercelEnv: 'preview' },
  { url: 'https://mekivo.uk/', nodeEnv: 'development' },
  { url: 'https://mekivo.uk/', nodeEnv: 'test' },
  { noClient: true },
  { server: true },
]) {
  test(`non-production or unavailable configuration is excluded: ${JSON.stringify(options)}`, () => {
    const h = harness(options);
    assert.doesNotThrow(() => h.api.initializeAnalyticsAudience());
    assert.equal(h.api.analyticsAudience(), 'excluded');
    assert.equal(h.api.filterAnalyticsEvent(pageview), null);
    assert.equal(h.calls.sessions, 0);
  });
}
