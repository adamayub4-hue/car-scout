import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const usageCode = compile('../app/lib/app-usage.ts');
const growthCode = compile('../app/lib/growth-events.ts');

// Execute the real usage helper and growth-event buffer together. The audience
// policy's owner resolution and path rules have their own integration tests.
function harness(options = {}) {
  const events = [], requests = [], timers = new Map(), listeners = new Map(), mediaListeners = new Set();
  const storage = new Map();
  let audience = options.audience ?? 'included', nextTimer = 0, now = 0;
  const media = {
    matches: options.standalone ?? false,
    ...(options.legacyMedia ? {
      addListener(listener) { mediaListeners.add(listener); },
    } : {
      addEventListener(name, listener) { assert.equal(name, 'change'); mediaListeners.add(listener); },
    }),
  };
  const browser = {
    location: new URL(options.url ?? 'https://mekivo.uk/'),
    addEventListener(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
    },
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    ...(options.ready === false ? {} : { va() {} }),
    ...(options.noMedia ? {} : {
      matchMedia(query) {
        if (options.mediaError) throw new Error('Media queries unavailable');
        assert.equal(query, '(display-mode: standalone)', 'fullscreen is never queried as installation evidence');
        return media;
      },
    }),
  };
  const policy = {
    analyticsAudience() {
      return options.excludedTraffic || browser.location.pathname === '/account' || browser.location.pathname.startsWith('/account/')
        ? 'excluded' : audience;
    },
    initializeAnalyticsAudience() {},
  };
  const context = {
    URLSearchParams,
    Date: { now: () => now },
    ...(options.server ? {} : { window: browser, navigator: { standalone: options.appleStandalone } }),
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const growth = {}, usage = {};
  vm.runInNewContext(growthCode, {
    ...context, exports: growth,
    require(name) {
      if (name === './analytics-audience') return policy;
      assert.equal(name, '@vercel/analytics');
      return { track: (name, properties) => events.push(JSON.parse(JSON.stringify({ name, properties }))) };
    },
  });
  vm.runInNewContext(usageCode, {
    ...context, exports: usage,
    require(name) {
      if (name === './analytics-audience') return policy;
      assert.equal(name, './growth-events');
      return { trackGrowthEvent(name, properties) {
        requests.push(JSON.parse(JSON.stringify({ name, properties })));
        growth.trackGrowthEvent(name, properties);
      } };
    },
  });
  return {
    usage, browser, events, requests, timers, storage,
    start() { usage.initializeAppUsage(); usage.trackAppOpen(); },
    navigate(path) { browser.location = new URL(path, browser.location.origin); usage.trackAppOpen(); },
    audience(value) { audience = value; usage.trackAppOpen(); },
    dispatch(name, event = {}) { for (const listener of listeners.get(name) ?? []) listener(event); },
    standalone(value) { media.matches = value; for (const listener of mediaListeners) listener(); },
    listenerCount(name) { return listeners.get(name)?.size ?? 0; },
    get modeListenerCount() { return mediaListeners.size; },
    advance(ms) {
      const end = now + ms;
      for (let calls = 0; timers.size; calls++) {
        assert.ok(calls < 300, 'existing startup buffer must remain bounded');
        const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (timer.at > end) break;
        now = timer.at; timers.delete(id); timer.callback();
      }
      now = end;
    },
  };
}

test('browser opens and both desktop and iOS app opens use only the approved static context', () => {
  for (const [options, event, context] of [
    [{}, 'browser_open', 'browser'],
    [{ standalone: true }, 'app_open', 'standalone'],
    [{ appleStandalone: true, noMedia: true }, 'app_open', 'standalone'],
  ]) {
    const h = harness(options); h.start();
    assert.equal(h.usage.appDisplayMode(), context);
    assert.deepEqual(h.requests, [{ name: event, properties: {} }]);
    assert.deepEqual(h.events, [{ name: event, properties: { campaign: 'direct', context } }]);
    assert.equal(h.storage.size, 0, 'usage tracking adds no persisted identifiers');
  }
});

test('generic fullscreen, unsupported media queries and false iOS hints remain browser opens', () => {
  for (const options of [{ fullscreen: true }, { noMedia: true }, { mediaError: true }, { appleStandalone: false }, { appleStandalone: 'true' }]) {
    const h = harness(options); h.start();
    assert.equal(h.usage.appDisplayMode(), 'browser');
    assert.deepEqual(h.events.map(event => event.name), ['browser_open']);
  }
});

test('navigation, StrictMode remounts and token refresh do not repeat an open event', () => {
  const h = harness(); h.start();
  h.start(); h.usage.initializeAppUsage(); h.usage.trackAppOpen();
  h.navigate('/guides/finding-the-right-car-part'); h.navigate('/account'); h.navigate('/');
  h.audience('pending'); h.audience('included');
  assert.deepEqual(h.events.map(event => event.name), ['browser_open']);
  assert.equal(h.listenerCount('appinstalled'), 1);
  assert.equal(h.modeListenerCount, 1);
  const newDocument = harness(); newDocument.start();
  assert.deepEqual(newDocument.events.map(event => event.name), ['browser_open'], 'a new document may count its own open');
});

test('a first excluded account route does not claim browser or app mode before public navigation', () => {
  for (const standalone of [false, true]) {
    const h = harness({ url: 'https://mekivo.uk/account', standalone }); h.start();
    h.navigate('/account/saved');
    assert.equal(h.requests.length, 0);
    h.navigate('/'); h.navigate('/guides');
    assert.deepEqual(h.events.map(event => event.name), [standalone ? 'app_open' : 'browser_open']);
  }
});

test('owner and testing exclusions suppress launch and install signals', () => {
  const owner = harness({ audience: 'excluded', standalone: true }); owner.start(); owner.dispatch('appinstalled');
  assert.equal(owner.requests.length, 0);
  owner.audience('included');
  assert.deepEqual(owner.events.map(event => event.name), ['app_open'], 'a skipped launch did not claim its mode');
  const testing = harness({ excludedTraffic: true }); testing.start(); testing.dispatch('appinstalled'); testing.navigate('/guides');
  assert.equal(testing.requests.length, 0);
  assert.equal(testing.storage.size, 0);
});

test('pending identity and SDK startup buffer the first launch and confirmed install once', () => {
  const h = harness({ audience: 'pending', ready: false, standalone: true }); h.start();
  h.start(); h.dispatch('appinstalled'); h.dispatch('appinstalled');
  assert.deepEqual(h.requests, [{ name: 'app_open', properties: {} }, { name: 'app_install', properties: {} }]);
  assert.equal(h.events.length, 0);
  h.advance(7000); h.audience('included'); h.advance(1000);
  assert.equal(h.events.length, 0);
  h.browser.va = () => {}; h.advance(50); h.usage.trackAppOpen(); h.dispatch('appinstalled');
  assert.deepEqual(h.events, [
    { name: 'app_open', properties: { campaign: 'direct', context: 'standalone' } },
    { name: 'app_install', properties: { campaign: 'direct', context: 'confirmed' } },
  ]);
  assert.equal(h.timers.size, 0);
});

test('owner resolution or startup expiry discards queued usage events', () => {
  const owner = harness({ audience: 'pending', ready: false }); owner.start(); owner.dispatch('appinstalled');
  owner.audience('excluded'); owner.browser.va = () => {}; owner.advance(50);
  assert.equal(owner.events.length, 0); assert.equal(owner.timers.size, 0);
  const missing = harness({ ready: false }); missing.start(); missing.advance(2500);
  missing.browser.va = () => {}; missing.start();
  assert.equal(missing.events.length, 0, 'expired opens are not retried as new launches');
  assert.equal(missing.timers.size, 0);
});

test('only actual appinstalled signals count installs, with one confirmation per document', async () => {
  const h = harness(); h.start();
  h.dispatch('beforeinstallprompt', { userChoice: Promise.resolve({ outcome: 'accepted' }) });
  await Promise.resolve();
  assert.equal(h.requests.length, 1, 'accepting an install offer is not confirmation');
  assert.equal(h.listenerCount('beforeinstallprompt'), 0);
  h.dispatch('appinstalled'); h.start(); h.dispatch('appinstalled');
  assert.deepEqual(h.events.map(event => event.name), ['browser_open', 'app_install']);
  const excluded = harness({ url: 'https://mekivo.uk/account' }); excluded.start(); excluded.dispatch('appinstalled');
  excluded.navigate('/');
  assert.deepEqual(excluded.events.map(event => event.name), ['browser_open'], 'navigation does not infer a skipped installation');
});

test('display mode changes count each eligible mode once, including legacy media listeners', () => {
  for (const legacyMedia of [false, true]) {
    const h = harness({ legacyMedia }); h.start();
    h.standalone(true); h.standalone(true); h.standalone(false); h.standalone(true);
    assert.deepEqual(h.events.map(event => event.name), ['browser_open', 'app_open']);
    assert.equal(h.modeListenerCount, 1);
  }
});

test('server execution cannot access browser globals or register tracking', () => {
  const h = harness({ server: true });
  assert.equal(h.usage.appDisplayMode(), null);
  assert.doesNotThrow(() => h.start());
  assert.equal(h.requests.length, 0); assert.equal(h.events.length, 0);
  assert.equal(h.listenerCount('appinstalled'), 0);
});
