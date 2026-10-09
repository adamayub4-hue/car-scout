import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const code = compile('../app/lib/return-visits.ts');
const pref = 'mekivo_return_visit_preference_v1', history = 'mekivo_return_visit_last_seen_v1';
const gap = 30 * 60 * 1000, lifetime = 30 * 24 * 60 * 60 * 1000;
const plain = value => JSON.parse(JSON.stringify(value));

function harness(options = {}) {
  const store = options.store ?? new Map(), calls = [], events = [], timers = new Map(), windowListeners = new Map(), documentListeners = new Map(), audienceListeners = new Set();
  const flags = { denied: false, writeDenied: false, removeDenied: false };
  let now = options.now ?? 100000000, audience = options.audience ?? 'included', nextTimer = 0;
  const setTimer = (callback, ms) => { const id = ++nextTimer; timers.set(id, { callback, at: now + ms }); return id; };
  const clearTimer = id => timers.delete(id);
  const add = (map, type, callback) => { if (!map.has(type)) map.set(type, new Set()); map.get(type).add(callback); };
  const window = {
    location: new URL('https://mekivo.uk/'),
    localStorage: {
      getItem(key) { calls.push(['get', key]); if (flags.denied) throw Error('Denied'); return store.get(key) ?? null; },
      setItem(key, value) { calls.push(['set', key, value]); if (flags.denied || flags.writeDenied) throw Error('Denied'); store.set(key, value); },
      removeItem(key) { calls.push(['remove', key]); if (flags.denied || flags.removeDenied) throw Error('Denied'); store.delete(key); },
    },
    addEventListener(type, callback) { add(windowListeners, type, callback); },
    ...(options.sdk === false ? {} : { va: () => {} }),
  };
  const document = { visibilityState: 'visible', addEventListener(type, callback) { add(documentListeners, type, callback); } };
  const context = {
    exports: {}, URL, setTimeout: setTimer, clearTimeout: clearTimer,
    Date: { now: () => now },
    ...(options.server ? {} : { window, document, navigator: options.locks === false ? {} : { locks: options.lockManager ?? { request(_name, callback) { return Promise.resolve(callback()); } } } }),
    require(name) {
      if (name === '@vercel/analytics') return { track(name, properties) { events.push(plain({ name, properties })); window.va?.('event', { name, data: properties }); } };
      if (name === './analytics-audience') return {
        analyticsAudience: () => audience,
        subscribeAnalyticsAudience(listener) { audienceListeners.add(listener); return () => audienceListeners.delete(listener); },
      };
      throw Error(`Unexpected import ${name}`);
    },
  };
  vm.runInNewContext(code, context);
  return {
    api: context.exports, store, calls, events, flags, timers, window, document, windowListeners, documentListeners,
    get now() { return now; },
    get currentAudience() { return audience; },
    time(value) { now = value; },
    advance(ms) {
      const end = now + ms;
      for (let count = 0; timers.size; count++) {
        assert.ok(count < 100, 'startup wait must stay bounded');
        const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (timer.at > end) break;
        now = timer.at; timers.delete(id); timer.callback();
      }
      now = end;
    },
    emit(type, event = {}) { for (const listener of windowListeners.get(type) ?? []) listener(event); },
    visibility(value) { document.visibilityState = value; for (const listener of documentListeners.get('visibilitychange') ?? []) listener({}); },
    audience(value) { audience = value; for (const listener of audienceListeners) listener(); },
    storage(key, value) {
      if (key === null) store.clear(); else if (value === null) store.delete(key); else store.set(key, value);
      for (const listener of windowListeners.get('storage') ?? []) listener({ key, newValue: value });
    },
  };
}

function preferenceComponent(h, options = {}) {
  const componentCode = compile('../app/components/return-visit-preference.tsx');
  const slots = [], effects = [];
  let cursor = 0, pathname = options.pathname ?? '/';
  const hooks = {
    useState(initial) {
      const at = cursor++; if (!(at in slots)) slots[at] = initial;
      return [slots[at], value => { slots[at] = value; }];
    },
    useSyncExternalStore(subscribe, snapshot) {
      const at = cursor++; if (!(at in slots)) slots[at] = { unsubscribe: subscribe(() => {}) };
      return snapshot();
    },
    useEffect(callback, dependencies) {
      const at = cursor++;
      if (!slots[at] || dependencies.some((value, index) => value !== slots[at].dependencies[index])) {
        effects.push(() => { slots[at]?.cleanup?.(); slots[at] = { dependencies, cleanup: callback() }; });
      }
    },
  };
  const exports = {};
  vm.runInNewContext(componentCode, {
    exports, window: h.window,
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'next/link') return { default: () => null };
      if (name === 'next/navigation') return { usePathname: () => pathname };
      if (name === '../lib/return-visits') return h.api;
      if (name === '../lib/analytics-audience') return { analyticsAudience: () => h.currentAudience, subscribeAnalyticsAudience: () => () => {} };
      if (name === 'react/jsx-runtime') return { Fragment: Symbol('Fragment'), jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      throw Error(`Unexpected component import ${name}`);
    },
  });
  const nodes = (tree, predicate) => {
    if (tree === null || tree === undefined || typeof tree !== 'object') return [];
    if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
    return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
  };
  const textContent = tree => {
    if (tree === null || tree === undefined || typeof tree === 'boolean') return '';
    if (typeof tree !== 'object') return String(tree);
    if (Array.isArray(tree)) return tree.map(textContent).join('');
    return textContent(tree.props?.children);
  };
  return {
    render() { cursor = 0; const tree = exports.ReturnVisitPreference({ settings: options.settings ?? false }); effects.splice(0).forEach(effect => effect()); return tree; },
    navigate(value) { pathname = value; }, nodes, textContent,
  };
}

test('unknown, declined and invalid preferences never read or write return history', () => {
  for (const choice of [null, 'declined', 'yes', 'invalid']) {
    const store = new Map([[history, '1']]); if (choice !== null) store.set(pref, choice);
    const h = harness({ store }); h.api.initializeReturnVisits(); h.api.trackReturnVisitActivity();
    assert.equal(h.events.length, 0);
    assert.deepEqual(h.calls.filter(call => call[1] === history), []);
    assert.equal(h.store.get(history), '1', 'preference lookup never inspects earlier history');
  }
});

test('server rendering never accesses browser storage or measures', () => {
  const h = harness({ server: true });
  assert.equal(h.api.returnVisitPreference(), 'unknown');
  h.api.initializeReturnVisits(); h.api.trackReturnVisitActivity();
  assert.equal(h.api.setReturnVisitPreference('allowed'), false);
  assert.deepEqual(h.calls, []); assert.deepEqual(h.events, []);
});

test('owner, preview and pending audiences cannot inspect or renew allowed history', () => {
  for (const audience of ['excluded', 'pending']) {
    const h = harness({ audience, store: new Map([[pref, 'allowed'], [history, '1']]) });
    h.api.initializeReturnVisits(); h.api.trackReturnVisitActivity(); h.emit('focus');
    assert.deepEqual(h.calls.filter(call => call[1] === history), []);
    assert.equal(h.events.length, 0);
  }
});

test('Allow seeds a fresh timestamp, and repeated renders, navigations and reloads are not returns', () => {
  const h = harness({ store: new Map([[history, '1']]) });
  assert.equal(h.api.setReturnVisitPreference('allowed'), true);
  h.api.initializeReturnVisits(); h.api.initializeReturnVisits(); h.api.trackReturnVisitActivity();
  h.advance(1001); h.emit('focus'); h.api.trackReturnVisitActivity();
  assert.equal(h.events.length, 0);
  const reloaded = harness({ now: h.now + 1000, store: h.store }); reloaded.api.initializeReturnVisits();
  assert.equal(reloaded.events.length, 0);
  assert.equal(h.windowListeners.get('focus').size, 1, 'singleton listeners survive double mounting');
  assert.deepEqual([...h.store.keys()].sort(), [history, pref].sort(), 'only choice and timestamp are stored');
});

test('one event is emitted after 30 minutes inactivity with no user or campaign properties', () => {
  const h = harness({ store: new Map([[pref, 'allowed']]) }); h.api.initializeReturnVisits();
  h.advance(gap - 1); h.emit('focus'); assert.equal(h.events.length, 0);
  h.advance(gap); h.emit('focus'); h.emit('pageshow'); h.api.trackReturnVisitActivity();
  assert.deepEqual(h.events, [{ name: 'return_visit', properties: { context: 'browser' } }]);
  h.advance(gap); h.api.trackReturnVisitActivity();
  assert.equal(h.events.length, 2, 'a later independent return is another visit, not a new person');
});

test('visible interaction keeps an active visit alive; hidden tabs cannot renew memory', () => {
  const h = harness({ store: new Map([[pref, 'allowed']]) }); h.api.initializeReturnVisits();
  for (const type of ['pointerdown', 'keydown', 'scroll']) { h.advance(20 * 60 * 1000); h.emit(type); }
  assert.equal(h.events.length, 0);
  const saved = h.store.get(history); h.visibility('hidden'); h.advance(gap); h.emit('focus'); h.emit('scroll');
  assert.equal(h.store.get(history), saved); assert.equal(h.events.length, 0);
  h.visibility('visible'); assert.equal(h.events.length, 1); h.emit('focus'); assert.equal(h.events.length, 1);
});

test('history is forgotten after 30 inactive days, and invalid or future timestamps seed fresh', () => {
  for (const stored of ['garbage', '-10', '1.5', '99999999999999999999999', String(100000000 + gap), String(100000000 - lifetime)]) {
    const h = harness({ store: new Map([[pref, 'allowed'], [history, stored]]) }); h.api.initializeReturnVisits();
    assert.equal(h.events.length, 0); assert.equal(h.store.get(history), String(h.now));
  }
  const h = harness({ store: new Map([[pref, 'allowed']]) }); h.api.initializeReturnVisits();
  h.time(h.now - 10000); h.api.trackReturnVisitActivity();
  assert.equal(h.store.get(history), String(h.now), 'a backward clock change never wedges renewal');
});

test('history and preference storage failures skip counts and never block the page', () => {
  const h = harness({ store: new Map([[pref, 'allowed'], [history, String(100000000 - gap)]]) });
  h.flags.writeDenied = true; assert.doesNotThrow(h.api.initializeReturnVisits);
  assert.equal(h.events.length, 0); assert.equal(h.store.get(history), String(100000000 - gap));
  h.flags.denied = true; assert.doesNotThrow(h.api.trackReturnVisitActivity); assert.equal(h.events.length, 0);
  assert.equal(h.api.setReturnVisitPreference('declined'), false);
  assert.equal(h.api.returnVisitPreference(), 'declined', 'blocked writes cannot override this page’s withdrawal');
  h.flags.denied = false; h.flags.writeDenied = false; h.api.trackReturnVisitActivity(); assert.equal(h.events.length, 0);
});

test('withdrawal removes timestamp and only its queued SDK events, even when preference save fails', () => {
  const h = harness({ store: new Map([[pref, 'allowed'], [history, String(100000000 - gap)]]) });
  h.window.vaq = [['beforeSend', 'guard'], ['pageview', { path: '/' }], ['event', { name: 'search_submitted' }], ['event', { name: 'return_visit', data: { context: 'browser' } }]];
  h.api.initializeReturnVisits(); h.flags.writeDenied = true;
  assert.equal(h.api.setReturnVisitPreference('declined'), false);
  assert.equal(h.store.has(history), false); assert.equal(h.store.has(pref), false, 'stale Allow is removed if a quota failure leaves it readable');
  assert.deepEqual(plain(h.window.vaq), [['beforeSend', 'guard'], ['pageview', { path: '/' }], ['event', { name: 'search_submitted' }]]);
  h.flags.writeDenied = false; h.api.setReturnVisitPreference('allowed'); h.emit('focus');
  assert.equal(h.events.length, 1, 'only the already sent event exists; reallow never replays old history');
});

test('cross-tab withdrawal and storage clear stop future activity and cancel pending startup', () => {
  for (const key of [pref, null]) {
    const h = harness({ sdk: false, store: new Map([[pref, 'allowed'], [history, String(100000000 - gap)]]) });
    h.api.initializeReturnVisits(); assert.equal(h.timers.size, 1);
    h.storage(key, key === null ? null : 'declined'); assert.equal(h.timers.size, 0);
    h.window.va = () => {}; h.advance(1000); h.emit('focus');
    assert.equal(h.events.length, 0); assert.equal(h.store.has(history), false);
  }
});

test('reallow always starts fresh when deleting old browser history is blocked', () => {
  const h = harness({ store: new Map([[pref, 'allowed'], [history, String(100000000 - gap)]]) });
  h.flags.removeDenied = true;
  h.api.setReturnVisitPreference('declined');
  assert.equal(h.store.has(history), true, 'browser refused deletion');
  h.api.setReturnVisitPreference('allowed');
  assert.equal(h.events.length, 0, 'a previous choice cannot manufacture a new return');
  assert.equal(h.store.get(history), String(h.now));
});

test('startup buffers one event for at most two seconds without injecting an SDK', () => {
  const store = new Map([[pref, 'allowed'], [history, String(100000000 - gap)]]);
  const h = harness({ sdk: false, store }); h.api.initializeReturnVisits(); h.api.trackReturnVisitActivity();
  h.advance(1950); assert.equal(h.events.length, 0); h.window.va = () => {}; h.advance(50);
  assert.equal(h.events.length, 0, 'the deadline itself expires rather than emitting a stale event');
  assert.equal(h.timers.size, 0);
  const ready = harness({ sdk: false, store: new Map([[pref, 'allowed'], [history, String(100000000 - gap)]]) });
  ready.api.initializeReturnVisits(); ready.advance(100); ready.window.va = () => {}; ready.advance(50);
  assert.equal(ready.events.length, 1); assert.equal(ready.timers.size, 0);
});

test('audience exclusion cancels a pending return but preserves unrelated SDK queue entries', () => {
  const h = harness({ sdk: false, store: new Map([[pref, 'allowed'], [history, String(100000000 - gap)]]) });
  h.window.vaq = [['event', { name: 'marketplace_outbound' }], ['event', { name: 'return_visit' }]];
  h.api.initializeReturnVisits(); h.audience('excluded');
  h.window.va = () => {}; h.advance(5000);
  assert.equal(h.events.length, 0); assert.equal(h.timers.size, 0);
  assert.deepEqual(plain(h.window.vaq), [['event', { name: 'marketplace_outbound' }]]);
});

test('a settings-page Allow cannot seed history until an eligible public route is reached', () => {
  const h = harness({ audience: 'excluded' }); h.api.initializeReturnVisits(); h.api.setReturnVisitPreference('allowed');
  assert.equal(h.store.has(history), false); h.audience('included');
  assert.equal(h.store.get(history), String(h.now)); assert.equal(h.events.length, 0);
});

test('live filter checks runtime payload.name, strips optional event queries, and preserves other events', () => {
  const h = harness();
  const ordinary = { type: 'event', url: 'https://mekivo.uk/?utm_source=facebook', payload: { name: 'search_submitted', data: { campaign: 'approved' } } };
  const event = { type: 'event', url: 'https://mekivo.uk/?postcode=SW1A&account=secret#search', payload: { name: 'return_visit', data: { campaign: 'secret', account: 'secret' } } };
  assert.strictEqual(h.api.filterReturnVisitEvent(ordinary), ordinary);
  assert.equal(h.api.filterReturnVisitEvent(event), null);
  h.api.setReturnVisitPreference('allowed');
  assert.deepEqual(plain(h.api.filterReturnVisitEvent(event)), { type: 'event', url: 'https://mekivo.uk/', payload: { name: 'return_visit', data: { context: 'browser' } } });
  assert.equal(event.payload.data.account, 'secret', 'input is never mutated');
  h.api.setReturnVisitPreference('declined'); assert.equal(h.api.filterReturnVisitEvent(event), null);
  assert.strictEqual(h.api.filterReturnVisitEvent(ordinary), ordinary);
  h.api.setReturnVisitPreference('allowed'); h.audience('excluded'); assert.equal(h.api.filterReturnVisitEvent(event), null);
});

test('real installed analytics track queue cannot replay a withdrawn return after reallow', () => {
  const sdkCode = readFileSync(new URL('../node_modules/@vercel/analytics/dist/index.js', import.meta.url), 'utf8');
  const h = harness({ store: new Map([[pref, 'allowed'], [history, String(100000000 - gap)]]) });
  const sdkModule = { exports: {} };
  vm.runInNewContext(sdkCode, { window: h.window, module: sdkModule, exports: sdkModule.exports, process: { env: { NODE_ENV: 'production' } } });
  h.window.vaq = [['beforeSend', 'guard'], ['pageview', { path: '/' }]];
  h.window.va = (...args) => h.window.vaq.push(args);
  // Track through the actual installed SDK, then the same narrow queue policy.
  sdkModule.exports.track('search_submitted', { context: 'cars:all' });
  sdkModule.exports.track('return_visit', { context: 'browser' });
  h.api.setReturnVisitPreference('declined'); h.api.setReturnVisitPreference('allowed');
  assert.deepEqual(plain(h.window.vaq), [['beforeSend', 'guard'], ['pageview', { path: '/' }], ['event', { name: 'search_submitted', data: { context: 'cars:all' } }]]);
});

test('the optional invitation has distinct equal controls, and a choice leaves an accessible confirmation', () => {
  const h = harness(), ui = preferenceComponent(h);
  let tree = ui.render();
  const buttons = ui.nodes(tree, node => node.type === 'button');
  assert.deepEqual(buttons.map(node => ui.textContent(node)), ['Allow return counting', 'No thanks']);
  assert.equal(buttons[0].props.className, buttons[1].props.className, 'declining is equally prominent');
  assert.match(ui.textContent(tree), /rather than different people/);
  buttons[1].props.onClick(); tree = ui.render();
  assert.equal(h.api.returnVisitPreference(), 'declined');
  assert.equal(ui.nodes(tree, node => node.props?.role === 'status').length, 1);
  assert.match(ui.textContent(tree), /Return counting is off/);
  assert.equal(ui.nodes(tree, node => node.type === 'button').length, 0, 'the footer does not nag after a decision');
});

test('invitation stays out of internal/settings routes and production owner browsers; settings remains available', () => {
  const h = harness({ audience: 'excluded' });
  for (const pathname of ['/admin', '/admin/report', '/account', '/traffic-settings', '/return-visit-settings', '/reset-password']) {
    const ui = preferenceComponent(h, { pathname }); assert.equal(ui.render(), null);
  }
  assert.equal(preferenceComponent(h).render(), null, 'excluded production browsers do not get the invitation');
  h.window.location = new URL('http://127.0.0.1:3000/');
  assert.ok(preferenceComponent(h).render(), 'local QA can inspect the invitation without sending any event');
  const settings = preferenceComponent(h, { pathname: '/return-visit-settings', settings: true });
  const tree = settings.render();
  assert.equal(settings.nodes(tree, node => node.type === 'button').length, 2);
  assert.match(settings.textContent(tree), /Not chosen — off/);
  assert.equal(h.events.length, 0);
});

test('settings withdrawal click cancels pending and queued returns when writes and removal both fail', () => {
  const h = harness({ sdk: false, store: new Map([[pref, 'allowed'], [history, String(100000000 - gap)]]) });
  h.window.vaq = [['event', { name: 'return_visit' }], ['event', { name: 'search_submitted' }], ['pageview', { path: '/' }]];
  const ui = preferenceComponent(h, { settings: true });
  const tree = ui.render(); assert.equal(h.timers.size, 1);
  h.flags.writeDenied = true; h.flags.removeDenied = true;
  ui.nodes(tree, node => node.type === 'button')[1].props.onClick();
  assert.equal(h.api.returnVisitPreference(), 'declined'); assert.equal(h.timers.size, 0);
  assert.deepEqual(plain(h.window.vaq), [['event', { name: 'search_submitted' }], ['pageview', { path: '/' }]]);
  assert.match(ui.textContent(ui.render()), /could not save this choice/);
  h.window.va = () => {}; h.advance(gap); h.emit('focus'); assert.equal(h.events.length, 0);
});

function queuedLocks() {
  const requests = [];
  return {
    requests,
    request(name, callback) {
      return new Promise((resolve, reject) => { requests.push({ name, callback, resolve, reject }); });
    },
    releaseNext() {
      const request = requests.shift(); assert.ok(request, 'a lock request must exist');
      try { request.resolve(request.callback({ name: request.name })); } catch (error) { request.reject(error); }
    },
  };
}

test('two tabs resuming together serialize one return, and StrictMode cannot queue duplicate activity', () => {
  const locks = queuedLocks(), store = new Map([[pref, 'allowed'], [history, String(100000000 - gap)]]);
  const first = harness({ store, lockManager: locks }), second = harness({ store, lockManager: locks });
  first.api.initializeReturnVisits(); first.api.initializeReturnVisits(); first.api.trackReturnVisitActivity();
  second.api.initializeReturnVisits(); second.emit('focus');
  assert.equal(locks.requests.length, 2, 'one pending lock per page');
  assert.deepEqual(locks.requests.map(request => request.name), ['mekivo-return-visit-counter-v1', 'mekivo-return-visit-counter-v1']);
  locks.releaseNext(); locks.releaseNext();
  assert.equal(first.events.length + second.events.length, 1);
  assert.equal(store.get(history), String(first.now));
});

test('withdrawal, owner exclusion and backgrounding while waiting for a lock abort before reading history', () => {
  for (const block of ['withdraw', 'owner', 'hidden']) {
    const locks = queuedLocks(), h = harness({ lockManager: locks, store: new Map([[pref, 'allowed'], [history, String(100000000 - gap)]]) });
    h.api.initializeReturnVisits(); assert.equal(locks.requests.length, 1);
    if (block === 'withdraw') h.api.setReturnVisitPreference('declined');
    if (block === 'owner') h.audience('excluded');
    if (block === 'hidden') h.visibility('hidden');
    const priorReads = h.calls.filter(call => call[0] === 'get' && call[1] === history).length;
    locks.releaseNext();
    assert.equal(h.events.length, 0);
    assert.equal(h.calls.filter(call => call[0] === 'get' && call[1] === history).length, priorReads);
  }
});

test('an old lock request cannot replay history after a quick withdrawal and reallow', () => {
  const locks = queuedLocks(), h = harness({ lockManager: locks, store: new Map([[pref, 'allowed'], [history, String(100000000 - gap)]]) });
  h.api.initializeReturnVisits(); h.flags.removeDenied = true;
  h.api.setReturnVisitPreference('declined'); h.api.setReturnVisitPreference('allowed');
  locks.releaseNext(); assert.equal(h.events.length, 0, 'the stale revision aborts');
  h.api.trackReturnVisitActivity(); locks.releaseNext();
  assert.equal(h.events.length, 0, 'the new revision seeds fresh, even when deleting failed');
  assert.equal(h.store.get(history), String(h.now));
});

test('unsupported atomic browser updates fail closed for return counts without touching other queues', () => {
  const h = harness({ locks: false, store: new Map([[pref, 'allowed'], [history, String(100000000 - gap)]]) });
  h.window.vaq = [['event', { name: 'search_submitted' }], ['pageview', { path: '/' }]];
  h.api.initializeReturnVisits(); h.api.trackReturnVisitActivity(); h.emit('focus');
  assert.deepEqual(h.calls.filter(call => call[1] === history), []);
  assert.equal(h.events.length, 0); assert.equal(h.timers.size, 0);
  assert.deepEqual(plain(h.window.vaq), [['event', { name: 'search_submitted' }], ['pageview', { path: '/' }]]);
});

test('a shared withdrawal blocks counting and the SDK filter even before its storage notification arrives', () => {
  const locks = queuedLocks(), store = new Map([[pref, 'allowed'], [history, String(100000000 - gap)]]);
  const h = harness({ store, lockManager: locks });
  h.api.setReturnVisitPreference('allowed'); locks.releaseNext();
  h.advance(gap); h.api.trackReturnVisitActivity();
  store.set(pref, 'declined');
  const previousHistory = store.get(history); locks.releaseNext();
  assert.equal(store.get(history), previousHistory);
  assert.equal(h.events.length, 0);
  assert.equal(h.api.filterReturnVisitEvent({ type: 'event', url: 'https://mekivo.uk/', payload: { name: 'return_visit' } }), null);
});
