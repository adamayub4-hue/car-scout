import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual page handlers with controlled Supabase responses.
// This lightweight hook harness is not a substitute for browser layout QA.
const code = ts.transpileModule(readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function harness(options = {}) {
  let cursor = 0, mounted = false;
  const slots = [], effects = [], calls = [], subscriptions = new Set(), cleanups = [];
  const result = (table, config, update, filters) => {
    calls.push({ table, config, update });
    if (options.hang === table) return new Promise(() => {});
    if (options.fail === table) return { data: null, error: { message: 'Unavailable' }, count: null };
    if (options.reject === table) throw new Error('Network failure');
    let response;
    if (table === 'admins') response = { data: options.denied || filters.user_id !== 'owner' ? null : { user_id: 'owner' }, error: null };
    else if (update) response = options.saveFail ? { data: null, error: { message: 'Denied' } } : { data: { id: 'report', status: update.status }, error: null };
    else {
      const data = table === 'complaints' && !config?.head && options.report ? [{ id: 'report', user_id: 'owner', subject: 'Test report', message: 'Example', status: 'open', created_at: '2026-08-31' }] : options.records?.[table] ?? [];
      response = { data, error: null, count: config?.count ? (options.nullCount ? null : (config.head ? Number(!!options.report) : 1234)) : null };
    }
    return options.deferResponse?.({ table, update, response }) ?? response;
  };
  const client = {
    auth: {
      getUser: async () => {
        const response = { data: { user: options.signedOut ? null : { id: options.userId ?? 'owner' } }, error: options.authError ? { message: 'Auth unavailable' } : null };
        return options.deferUser?.(response) ?? response;
      },
      onAuthStateChange(callback) { subscriptions.add(callback); return { data: { subscription: { unsubscribe() { subscriptions.delete(callback); } } } }; },
    },
    from(table) {
      let config, update;
      const filters = {};
      const query = {
        select(_columns, selected) { config = selected; return query; },
        update(value) { update = value; return query; },
        eq(key, value) { filters[key] = value; return query; }, neq() { return query; }, order() { return query; }, limit() { return query; },
        maybeSingle() { return query; }, single() { return query; },
        then(resolve, reject) { return Promise.resolve().then(() => result(table, config, update, filters)).then(resolve, reject); },
      };
      return query;
    },
  };
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useMemo(fn) { return fn(); },
    useEffect(fn) { if (!mounted) effects.push(fn); },
  };
  const exports = {};
  const jsx = (type, props) => ({ type, props: props || {} });
  vm.runInNewContext(code, {
    exports, setTimeout: (fn, delay) => setTimeout(fn, options.fastDeadline && delay === 15000 ? 1 : delay), clearTimeout, window: { setTimeout, clearTimeout },
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/link') return { default: 'a' };
      if (name === '../components/owner-traffic') return { default: 'owner-traffic' };
      if (name === '../lib/supabase') return { getSupabaseBrowserClient: () => options.noClient ? null : client };
      throw new Error(name);
    },
  });
  const render = () => { cursor = 0; const tree = exports.default(); if (!mounted) { mounted = true; effects.forEach(fn => cleanups.push(fn())); } return tree; };
  const auth = (event, userId) => {
    options.signedOut = userId === null;
    options.userId = userId;
    subscriptions.forEach(callback => callback(event, userId === null ? null : { user: { id: userId } }));
  };
  return { render, calls, options, auth, state: () => JSON.stringify(slots), unmount: () => cleanups.forEach(fn => fn?.()), subscriptions };
}
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]; }
function text(tree) { return tree == null ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(text).join(' ') : text(tree.props?.children); }
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function loaded(options) { const h = harness(options); assert.match(text(h.render()), /Loading dashboard/); await tick(); return h; }

test('success uses exact totals instead of list length', async () => {
  const h = await loaded({}); const output = text(h.render());
  assert.match(output, /1234 Registered accounts/); assert.match(output, /1234 Saved items/);
  assert.match(output, /0 Unresolved reports/); assert.match(output, /No feedback submitted/);
  assert.match(output, /Recorded account actions/);
});
for (const table of ['profiles', 'complaints', 'activity_events', 'saved_items', 'admins']) {
  test(`${table} failure never appears as an empty dashboard`, async () => {
    const h = await loaded({ fail: table }); const output = text(h.render());
    assert.match(output, /Dashboard unavailable/); assert.doesNotMatch(output, /No feedback submitted|0 Unresolved reports/);
    h.options.fail = null;
    await nodes(h.render()).find(n => n.type === 'button').props.onClick(); await tick();
    assert.match(text(h.render()), /Mekivo control centre/);
  });
}
for (const options of [{ authError: true }, { noClient: true }, { nullCount: true }, { reject: 'complaints' }]) {
  test(`unavailable service is explicit: ${JSON.stringify(options)}`, async () => {
    const h = await loaded(options); assert.match(text(h.render()), /Dashboard unavailable/);
  });
}
for (const options of [{ denied: true }, { signedOut: true }, { signedOut: true, authError: true }]) {
  test(`non-owner cannot load private records: ${JSON.stringify(options)}`, async () => {
    const h = await loaded(options); assert.match(text(h.render()), /Owner access only/);
    assert.ok(h.calls.every(c => c.table === 'admins'));
  });
}
test('failed status change keeps confirmed status and requires refresh', async () => {
  const h = await loaded({ report: true, saveFail: true });
  await nodes(h.render()).find(n => n.type === 'select').props.onChange({ target: { value: 'resolved' } }); await tick();
  const tree = h.render(); assert.match(text(tree), /status change could not be confirmed/);
  const select = nodes(tree).find(n => n.type === 'select');
  assert.equal(select.props.value, 'open'); assert.equal(select.props.disabled, true);
  assert.match(text(tree), /1 Unresolved reports/);
});
test('confirmed status change updates report and open count', async () => {
  const h = await loaded({ report: true });
  await nodes(h.render()).find(n => n.type === 'select').props.onChange({ target: { value: 'resolved' } }); await tick();
  assert.equal(nodes(h.render()).find(n => n.type === 'select').props.value, 'resolved');
  assert.match(text(h.render()), /0 Unresolved reports/);
});
test('a stalled request times out and can be retried', async () => {
  const h = await loaded({ hang: 'complaints', fastDeadline: true });
  for (let i = 0; i < 20 && /Loading dashboard/.test(text(h.render())); i++) await tick();
  assert.match(text(h.render()), /Dashboard unavailable/);
  h.options.hang = null;
  await nodes(h.render()).find(n => n.type === 'button').props.onClick(); await tick();
  assert.match(text(h.render()), /Mekivo control centre/);
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const privateRecords = {
  profiles: [{ id: 'owner', email: 'private-owner@example.test', created_at: '2026-08-31' }],
  saved_items: [{ id: 'private-save', user_id: 'owner', kind: 'car', title: 'Private saved vehicle', created_at: '2026-08-31' }],
  activity_events: [{ id: 1, user_id: 'owner', event_name: 'private_owner_action', created_at: '2026-08-31' }],
};

for (const nextUser of [null, 'another-account']) {
  test(`identity change to ${nextUser} immediately clears private records and blocks stale actions`, async () => {
    const h = await loaded({ report: true, records: privateRecords });
    const oldStatusAction = nodes(h.render()).find(n => n.type === 'select').props.onChange;
    assert.match(text(h.render()), /private-owner@example.test|Private saved vehicle/);
    h.auth(nextUser === null ? 'SIGNED_OUT' : 'SIGNED_IN', nextUser);
    assert.doesNotMatch(text(h.render()), /private-owner@example.test|Private saved vehicle|Test report|1234/);
    assert.doesNotMatch(h.state(), /private-owner@example.test|Private saved vehicle|private_owner_action|Test report|1234/);
    await oldStatusAction({ target: { value: 'resolved' } });
    await tick();
    assert.equal(h.calls.filter(call => call.update).length, 0);
    assert.match(text(h.render()), /Owner access only/);
    assert.equal(nodes(h.render()).some(node => node.type === 'owner-traffic'), false);
  });

  test(`identity change to ${nextUser} cancels an older in-flight identity check`, async () => {
    const pending = deferred();
    let oldResponse;
    const h = await loaded({ deferUser(response) {
      if (oldResponse) return response;
      oldResponse = response;
      return pending.promise;
    } });
    h.auth(nextUser === null ? 'SIGNED_OUT' : 'SIGNED_IN', nextUser);
    pending.resolve(oldResponse);
    await tick();
    assert.match(text(h.render()), /Owner access only/);
    assert.ok(h.calls.every(call => call.table === 'admins'));
    assert.doesNotMatch(text(h.render()), /Mekivo control centre/);
  });

  test(`identity change to ${nextUser} discards late private data`, async () => {
    const pending = deferred();
    let oldResponse;
    const h = await loaded({ report: true, records: privateRecords, deferResponse({ table, response }) {
      if (table !== 'profiles') return response;
      oldResponse = response;
      return pending.promise;
    } });
    assert.ok(oldResponse, 'private records request has started');
    h.auth(nextUser === null ? 'SIGNED_OUT' : 'SIGNED_IN', nextUser);
    pending.resolve(oldResponse);
    await tick();
    assert.match(text(h.render()), /Owner access only/);
    assert.doesNotMatch(h.state(), /private-owner@example.test|Private saved vehicle|private_owner_action|Test report|1234/);
  });
}

for (const failure of [false, true]) {
  test(`late ${failure ? 'failed' : 'successful'} status response cannot affect a new owner session or save`, async () => {
    const pending = [];
    const h = await loaded({ report: true, deferResponse({ update, response }) {
      if (!update) return response;
      const request = deferred(); pending.push({ ...request, response }); return request.promise;
    } });
    const firstSave = nodes(h.render()).find(n => n.type === 'select').props.onChange({ target: { value: 'resolved' } });
    await tick();
    h.auth('SIGNED_OUT', null);
    h.auth('SIGNED_IN', 'owner');
    await tick();
    const nextSave = nodes(h.render()).find(n => n.type === 'select').props.onChange({ target: { value: 'in_progress' } });
    await tick();
    assert.equal(pending.length, 2);
    if (failure) pending[0].reject(new Error('Late failure'));
    else pending[0].resolve(pending[0].response);
    await firstSave;
    const output = text(h.render());
    assert.match(output, /Saving report status/);
    assert.match(output, /1 Unresolved reports/);
    assert.doesNotMatch(output, /status change could not be confirmed/);
    assert.equal(nodes(h.render()).find(n => n.type === 'select').props.value, 'open');
    assert.equal(nodes(h.render()).find(n => n.type === 'select').props.disabled, true);
    pending[1].resolve(pending[1].response);
    await nextSave;
    assert.equal(nodes(h.render()).find(n => n.type === 'select').props.value, 'in_progress');
  });
}

test('same-account token refresh and sign-in events preserve displayed data and an in-flight save', async () => {
  const pending = deferred(); let saveResponse;
  const h = await loaded({ report: true, deferResponse({ update, response }) {
    if (!update) return response;
    saveResponse = response;
    return pending.promise;
  } });
  const save = nodes(h.render()).find(n => n.type === 'select').props.onChange({ target: { value: 'resolved' } });
  await tick();
  const before = text(h.render()), callCount = h.calls.length;
  h.auth('TOKEN_REFRESHED', 'owner'); h.auth('SIGNED_IN', 'owner');
  await tick();
  assert.equal(text(h.render()), before);
  assert.equal(h.calls.length, callCount);
  pending.resolve(saveResponse); await save;
  assert.equal(nodes(h.render()).find(n => n.type === 'select').props.value, 'resolved');
  assert.match(text(h.render()), /0 Unresolved reports/);
});

test('unmount unsubscribes and ignores a late dashboard response', async () => {
  const pending = deferred(); let oldResponse;
  const h = await loaded({ records: privateRecords, deferResponse({ table, response }) {
    if (table !== 'profiles') return response;
    oldResponse = response; return pending.promise;
  } });
  h.unmount();
  assert.equal(h.subscriptions.size, 0);
  const afterUnmount = h.state();
  pending.resolve(oldResponse); await tick();
  assert.equal(h.state(), afterUnmount);
});
