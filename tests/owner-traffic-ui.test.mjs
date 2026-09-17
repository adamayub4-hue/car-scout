import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

const code = ts.transpileModule(readFileSync(new URL('../app/components/owner-traffic.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const session = { access_token: 'owner-test-token', user: { id: 'owner' } };
const sessionResult = value => ({ data: { session: value }, error: null });
const report = changes => ({
  range: '7d', since: '2026-09-10T12:00:00.000Z', until: '2026-09-17T12:00:00.000Z',
  fetchedAt: '2026-09-17T12:01:00.000Z', visitors: 1234, pageviews: 2345,
  searches: 21, outboundClicks: 16, partial: false,
  sources: [{ source: 'facebook.com', visitors: 43, pageviews: 55 }], ...changes,
});
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Run the actual component with deterministic effect cleanup and clock control.
// HTML is rendered by ReactDOM; this does not replace browser interaction/layout QA.
function harness(options = {}) {
  let cursor = 0, now = 0, timerId = 0, mounted = true, dirty = true, tree;
  let currentSession = session;
  const slots = [], effectSlots = new Map(), pendingEffects = [];
  const timers = new Map(), listeners = new Set(), requests = [], writes = [];
  const calls = { sessions: 0, subscriptions: 0, unsubscriptions: 0 };
  const setTimer = (callback, delay = 0) => { const id = ++timerId; timers.set(id, { at: now + delay, callback }); return id; };
  const clearTimer = id => timers.delete(id);
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value;
        writes.push({ mounted, value: next });
        if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(callback, dependencies) {
      const index = cursor++;
      const previous = effectSlots.get(index);
      if (!previous || !dependencies || dependencies.some((value, i) => !Object.is(value, previous.dependencies?.[i]))) {
        pendingEffects.push(() => {
          previous?.cleanup?.();
          const effect = { dependencies: dependencies?.slice(), cleanup: callback() };
          effectSlots.set(index, effect);
        });
      }
    },
  };
  const client = {
    auth: {
      getSession() {
        calls.sessions++;
        return options.getSession ? options.getSession() : Promise.resolve(sessionResult(currentSession));
      },
      onAuthStateChange(callback) {
        calls.subscriptions++; listeners.add(callback);
        return { data: { subscription: { unsubscribe() { calls.unsubscriptions++; listeners.delete(callback); } } } };
      },
    },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports, Error, AbortController, setTimeout: setTimer, clearTimeout: clearTimer,
    fetch(url, init) { const request = { url, init, ...deferred() }; requests.push(request); return request.promise; },
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'next/link') return { default: props => React.createElement('a', props) };
      if (name === '../lib/supabase') return { getSupabaseBrowserClient: () => options.noClient ? null : client };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  function render() {
    assert.ok(mounted, 'cannot render an unmounted test component');
    if (dirty || !tree) {
      cursor = 0; dirty = false; tree = exports.default();
      for (const effect of pendingEffects.splice(0)) effect();
    }
    return tree;
  }
  async function flush() {
    for (let i = 0; i < 20; i++) { await Promise.resolve(); if (mounted && dirty) render(); }
  }
  return {
    calls, requests, timers, writes, render, flush,
    html() { return renderToStaticMarkup(render()); },
    view(state) { return renderToStaticMarkup(React.createElement(exports.OwnerTrafficView, { range: '7d', state, onRangeChange() {}, onRefresh() {} })); },
    changeRange(value) { render().props.onRangeChange(value); render(); },
    refresh() { render().props.onRefresh(); render(); },
    auth(event, value) { currentSession = value; for (const listener of listeners) listener(event, value); },
    respond(index, body, status = 200) { requests[index].resolve({ ok: status >= 200 && status < 300, status, json: async () => body }); },
    unmount() { mounted = false; for (const effect of effectSlots.values()) effect.cleanup?.(); },
    async advance(ms) {
      const end = now + ms;
      render(); await flush();
      for (let count = 0; timers.size; count++) {
        assert.ok(count < 100, 'component timers must stay bounded');
        const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (timer.at > end) break;
        now = timer.at; timers.delete(id); timer.callback(); await flush();
      }
      now = end;
    },
  };
}

const labels = ['Visitors', 'Page views', 'Searches', 'Listing clicks'];
function card(html, label) { return html.match(new RegExp(`>${label}</p><p[^>]*>([^<]*)</p>`))?.[1]; }
function assertNoFigures(html) { for (const label of labels) assert.equal(card(html, label), undefined, label); }
async function loaded(changes) {
  const h = harness(); await h.advance(0); h.respond(0, report(changes)); await h.flush(); return h;
}

test('loading and errors never present zeros or a previous private report as current figures', () => {
  const h = harness();
  const loading = h.view({ report: report(), loading: true, error: null });
  assert.match(loading, /role="status"[^>]*>Loading your visitor report/);
  assertNoFigures(loading);
  const failure = h.view({ report: report(), loading: false, error: 'Try again later.' });
  assert.match(failure, /role="alert"/); assert.match(failure, /Visitor figures unavailable/);
  assertNoFigures(failure);
});

test('successful report shows real totals, genuine zero actions and explanatory labels', async () => {
  const h = await loaded({ searches: 0, outboundClicks: 0 });
  const html = h.html();
  assert.deepEqual(labels.map(label => card(html, label)), ['1,234', '2,345', '0', '0']);
  assert.match(html, /facebook\.com/); assert.match(html, /UK time/);
  assert.match(html, /actions, not extra people or confirmed sales/);
  assert.match(html, /href="\/traffic-settings"/);
  assert.doesNotMatch(html, /Visitor figures unavailable|Loading your visitor report/);
  assert.equal(h.timers.size, 0);
});

test('missing optional sections remain unavailable while an actual empty report displays zero', async () => {
  const h = await loaded({ searches: null, outboundClicks: null, sources: null, partial: true });
  const partial = h.html();
  assert.equal(card(partial, 'Visitors'), '1,234');
  assert.equal(card(partial, 'Searches'), 'Unavailable');
  assert.equal(card(partial, 'Listing clicks'), 'Unavailable');
  assert.match(partial, /Traffic sources are temporarily unavailable/);
  assert.match(partial, /Some sections could not be loaded/);
  assert.doesNotMatch(partial, /No traffic sources recorded/);
  const empty = h.view({ report: report({ visitors: 0, pageviews: 0, searches: 0, outboundClicks: 0, sources: [] }), loading: false, error: null });
  assert.deepEqual(labels.map(label => card(empty, label)), ['0', '0', '0', '0']);
  assert.match(empty, /No traffic sources recorded for this period/);
});

test('owner request waits for the session and uses the private bearer endpoint without browser caching', async () => {
  const initial = deferred();
  const h = harness({ getSession: () => initial.promise });
  await h.advance(0);
  assert.equal(h.calls.sessions, 1); assert.equal(h.requests.length, 0);
  initial.resolve(sessionResult(session)); await h.flush();
  assert.equal(h.requests.length, 1);
  const { url, init } = h.requests[0];
  assert.equal(url, '/api/admin/traffic?range=7d');
  assert.equal(init.headers.Authorization, 'Bearer owner-test-token');
  assert.equal(init.cache, 'no-store'); assert.equal(init.signal.aborted, false);
  assert.ok(!url.includes(session.access_token), 'credentials must not enter a URL');
  h.unmount();
});

for (const status of [401, 403, 503]) {
  test(`HTTP ${status} is an unavailable report, never zero visitors`, async () => {
    const h = harness(); await h.advance(0); h.respond(0, {}, status); await h.flush();
    const html = h.html(); assert.match(html, /Visitor figures unavailable/); assertNoFigures(html);
    assert.match(html, status === 503 ? /does not mean there were no visitors/ : /sign in to your owner account again/);
  });
}

test('missing reporting connection tells the owner setup is needed without claiming collection stopped', async () => {
  const h = harness(); await h.advance(0); h.respond(0, { code: 'not_configured' }, 503); await h.flush();
  assert.match(h.html(), /private connection.*needs to be set up/);
  assert.match(h.html(), /still collecting eligible visitor activity/); assertNoFigures(h.html());
});

for (const [name, options] of [
  ['missing client', { noClient: true }],
  ['signed out', { getSession: async () => sessionResult(null) }],
  ['session error', { getSession: async () => ({ data: { session }, error: { message: 'Offline' } }) }],
]) {
  test(`${name} cannot fetch or reveal private figures`, async () => {
    const h = harness(options); await h.advance(0);
    assert.equal(h.requests.length, 0); assert.match(h.html(), /sign in to your owner account again/);
    assertNoFigures(h.html()); assert.equal(h.timers.size, 0);
  });
}

for (const stage of ['session', 'fetch', 'response body']) {
  test(`${stage} hang has a deadline and late completion cannot replace the timeout`, async () => {
    const pending = deferred();
    const h = harness(stage === 'session' ? { getSession: () => pending.promise } : {});
    await h.advance(0);
    if (stage === 'response body') { h.requests[0].resolve({ ok: true, json: () => pending.promise }); await h.flush(); }
    await h.advance(19999); assert.match(h.html(), /Loading your visitor report/);
    await h.advance(1); assert.match(h.html(), /took too long to load/); assertNoFigures(h.html());
    if (stage === 'session') pending.resolve(sessionResult(session));
    else if (stage === 'fetch') h.respond(0, report());
    else pending.resolve(report());
    await h.flush();
    assert.match(h.html(), /took too long to load/); assertNoFigures(h.html());
    if (stage === 'session') assert.equal(h.requests.length, 0, 'a timed-out session cannot start a late request');
    else assert.equal(h.requests[0].init.signal.aborted, true);
    assert.equal(h.timers.size, 0);
  });
}

test('rapid range changes abort older requests and ignore their late success or error', async () => {
  const h = harness(); await h.advance(0);
  h.changeRange('24h'); await h.advance(0);
  h.changeRange('30d'); await h.advance(0);
  assert.deepEqual(h.requests.map(request => request.url), [
    '/api/admin/traffic?range=7d', '/api/admin/traffic?range=24h', '/api/admin/traffic?range=30d',
  ]);
  assert.deepEqual(h.requests.map(request => request.init.signal.aborted), [true, true, false]);
  h.respond(2, report({ range: '30d', visitors: 330 })); await h.flush();
  assert.equal(card(h.html(), 'Visitors'), '330');
  const before = h.writes.length;
  h.respond(0, report({ visitors: 999 })); h.respond(1, {}, 503); await h.flush();
  assert.equal(h.writes.length, before, 'stale requests must not commit any state');
  assert.equal(card(h.html(), 'Visitors'), '330');
  assert.equal(h.render().props.range, '30d');
  assert.equal(h.calls.unsubscriptions, 2);
});

test('refresh and range changes immediately hide older figures until the new report arrives', async () => {
  const h = await loaded();
  h.refresh(); assertNoFigures(h.html()); await h.advance(0);
  h.respond(1, {}, 503); await h.flush(); assertNoFigures(h.html());
  h.refresh(); await h.advance(0); h.respond(2, report({ visitors: 7 })); await h.flush();
  assert.equal(card(h.html(), 'Visitors'), '7');
  h.changeRange('24h'); assertNoFigures(h.html()); await h.advance(0);
  h.respond(3, report({ range: '24h', visitors: 2 })); await h.flush();
  assert.equal(card(h.html(), 'Visitors'), '2');
});

test('unmount aborts the request, removes auth listeners and prevents late state writes', async () => {
  const h = harness(); await h.advance(0);
  h.unmount(); const before = h.writes.length;
  assert.equal(h.requests[0].init.signal.aborted, true);
  assert.equal(h.calls.unsubscriptions, 1); assert.equal(h.timers.size, 0);
  h.respond(0, report()); h.auth('SIGNED_OUT', null); await h.flush();
  assert.equal(h.writes.length, before); assert.ok(h.writes.every(write => write.mounted));
});

test('sign-out immediately removes previously loaded private figures', async () => {
  const h = await loaded(); assert.equal(card(h.html(), 'Visitors'), '1,234');
  h.auth('SIGNED_OUT', null);
  assertNoFigures(h.html()); assert.match(h.html(), /sign in to your owner account again/);
  assert.equal(h.requests[0].init.signal.aborted, true);
  h.refresh(); await h.advance(0);
  assert.equal(h.requests.length, 1, 'refresh after sign-out cannot reuse the old bearer token');
  assertNoFigures(h.html());
});

test('sign-out during a request prevents its late response from restoring private figures', async () => {
  const h = harness(); await h.advance(0);
  h.auth('SIGNED_OUT', null); const before = h.writes.length;
  h.respond(0, report()); await h.flush();
  assert.equal(h.writes.length, before); assertNoFigures(h.html());
  assert.match(h.html(), /sign in to your owner account again/); assert.equal(h.timers.size, 0);
});

test('switching accounts clears private figures while token refresh for the same owner keeps them', async () => {
  const h = await loaded();
  h.auth('TOKEN_REFRESHED', { ...session, access_token: 'refreshed-owner-token' });
  assert.equal(card(h.html(), 'Visitors'), '1,234');
  h.auth('SIGNED_IN', { access_token: 'customer-token', user: { id: 'customer' } });
  assertNoFigures(h.html()); assert.match(h.html(), /sign in to your owner account again/);
  assert.equal(h.requests[0].init.signal.aborted, true);
});

test('an account switch while getSession is pending cannot load the previous owner report', async () => {
  const initial = deferred();
  const h = harness({ getSession: () => initial.promise });
  await h.advance(0);
  h.auth('SIGNED_IN', { access_token: 'customer-token', user: { id: 'customer' } });
  initial.resolve(sessionResult(session)); await h.flush();
  assert.equal(h.requests.length, 0, 'a stale session cannot send the previous owner bearer token');
  assertNoFigures(h.html());
});

test('the matching initial auth event does not cancel a valid owner session lookup', async () => {
  const initial = deferred();
  const h = harness({ getSession: () => initial.promise });
  await h.advance(0); h.auth('INITIAL_SESSION', session);
  initial.resolve(sessionResult(session)); await h.flush();
  assert.equal(h.requests.length, 1);
  h.respond(0, report()); await h.flush();
  assert.equal(card(h.html(), 'Visitors'), '1,234');
});
