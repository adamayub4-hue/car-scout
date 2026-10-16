import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

const code = ts.transpileModule(readFileSync(new URL('../app/components/account-management.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const owner = { id: 'owner', email: 'owner@example.test', created_at: '2026-10-01' };
const admin = { id: 'admin', email: 'admin@example.test', created_at: '2026-10-02' };
const target = { id: '11111111-1111-4111-8111-111111111111', email: 'my-test@example.test', created_at: '2026-10-03' };
const other = { id: '22222222-2222-4222-8222-222222222222', email: 'other@example.test', created_at: '2026-10-04' };
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(text).join(' ') : node?.props ? text(node.props.children) : '';
function nodes(node, found = []) {
  if (Array.isArray(node)) node.forEach(child => nodes(child, found));
  else if (node?.props) { found.push(node); nodes(node.props.children, found); }
  return found;
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const flush = () => new Promise(resolve => setImmediate(resolve));

// Run the real handlers and controlled state. A dialog double models native
// opening/closing and focus; no browser, network, database or live accounts run.
function harness(options = {}) {
  let cursor = 0, mounted = false, tree, focused;
  const slots = [], effects = [], effectSetups = [], layouts = [], cleanups = [], subscriptions = new Set(), elements = new Map();
  const calls = { auth: [], membership: [], rpc: [], busy: [], deleted: [], access: 0, refresh: 0 };
  let props = {
    profiles: [owner, admin, target, other], ownerId: 'owner', protectedUserIds: ['owner', 'admin'], totalAccounts: 4,
    onBusyChange(value) { calls.busy.push(value); },
    async onDeleted(email) { calls.deleted.push(email); if (options.refreshReject) throw Error('Refresh failed'); },
    onAccessChanged() { calls.access++; }, onRefresh() { calls.refresh++; }, ...options.props,
  };
  const client = {
    auth: {
      async getUser() { calls.auth.push(true); const response = { data: { user: options.userId === null ? null : { id: options.userId ?? 'owner' } }, error: options.authError ? { message: 'Auth failed' } : null }; return options.authRequest?.promise ?? response; },
      onAuthStateChange(callback) { subscriptions.add(callback); return { data: { subscription: { unsubscribe() { subscriptions.delete(callback); } } } }; },
    },
    from(table) { assert.equal(table, 'admins'); const query = {
      select(columns) { assert.equal(columns, 'user_id'); return query; },
      eq(key, value) { calls.membership.push({ key, value }); return query; },
      async maybeSingle() { return options.adminRequest?.promise ?? { data: options.adminDenied ? null : { user_id: 'owner' }, error: options.adminError ? { message: 'Membership failed' } : null }; },
    }; return query; },
    async rpc(name, args) {
      calls.rpc.push({ name, args });
      if (options.rpcReject) throw Error('Response lost');
      if (options.rpcRequest) return options.rpcRequest.promise;
      return { data: options.result === undefined ? target.id : options.result, error: options.rpcError ?? null };
    },
  };
  const hooks = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(callback) { if (!mounted) effects.push(callback); },
    useLayoutEffect(callback) { layouts.push(callback); },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, setTimeout: (callback, delay) => setTimeout(callback, options.fastDeadline && delay === 15000 ? 1 : delay), clearTimeout, require(name) {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name === '../lib/supabase') return { getSupabaseBrowserClient: () => options.noClient ? null : client };
    throw Error(name);
  } });
  function render() {
    cursor = 0; tree = exports.default(props);
    for (const node of nodes(tree)) {
      const key = node.type === 'dialog' ? 'dialog' : node.props.id || node.props['aria-label'] || `${String(node.type)}:${text(node)}`;
      const element = elements.get(key) ?? { open: false, focus() { focused = text(element.node); } };
      element.node = node; elements.set(key, element);
      if (node.type === 'dialog') {
        element.showModal = () => { element.open = true; };
        element.close = () => { element.open = false; element.node.props.onClose(); };
      }
      if (node.props.ref) node.props.ref.current = element;
    }
    layouts.splice(0).forEach(effect => effect());
    if (!mounted) { mounted = true; effectSetups.push(...effects.splice(0)); effectSetups.forEach(effect => cleanups.push(effect())); }
    return tree;
  }
  const one = predicate => { const found = nodes(render()).filter(predicate); assert.equal(found.length, 1, 'one requested control'); return found[0]; };
  const button = label => one(node => node.type === 'button' && text(node) === label);
  render();
  return {
    calls, options, render, nodes: () => nodes(render()), text: () => text(render()).replace(/\s+/g, ' ').trim(), one, button, subscriptions,
    update(next) { props = { ...props, ...next }; render(); },
    open(profile = target) { const control = one(node => node.type === 'button' && node.props['aria-label'] === `Delete account ${profile.email}`); control.props.onClick({ currentTarget: { focus() { focused = 'delete trigger'; } } }); render(); },
    type(value) { one(node => node.type === 'input' && node.props.id === 'delete-account-email').props.onChange({ target: { value } }); render(); },
    search(value) { one(node => node.type === 'input' && node.props.id === 'account-email-search').props.onChange({ target: { value } }); render(); },
    submit() { return one(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); },
    cancel() { button('Cancel').props.onClick(); render(); },
    auth(userId, event = 'SIGNED_OUT') { options.userId = userId; subscriptions.forEach(callback => callback(event, userId === null ? null : { user: { id: userId } })); render(); },
    replayEffects() { cleanups.splice(0).forEach(cleanup => cleanup?.()); render(); effectSetups.forEach(effect => cleanups.push(effect())); render(); },
    unmount() { cleanups.forEach(cleanup => cleanup?.()); },
    focused: () => focused,
  };
}

test('opening, cancelling, protected accounts and a wrong confirmation never call the deletion RPC', async () => {
  const h = harness();
  assert.ok(h.text().includes('Owner account · protected')); assert.ok(h.text().includes('Administrator · protected'));
  assert.equal(h.nodes().some(node => node.props['aria-label'] === `Delete account ${owner.email}`), false);
  assert.equal(h.nodes().some(node => node.props['aria-label'] === `Delete account ${admin.email}`), false);
  h.open();
  assert.equal(h.focused(), 'Cancel');
  assert.ok(h.text().includes(target.email)); assert.match(h.text(), /cannot be undone/);
  assert.equal(h.button('Permanently delete account').props.disabled, true);
  h.type('wrong@example.test'); await h.submit();
  assert.equal(h.calls.auth.length, 0); assert.equal(h.calls.rpc.length, 0);
  h.cancel(); await h.submit();
  assert.equal(h.calls.rpc.length, 0); assert.equal(h.focused(), 'delete trigger');
});

test('Strict Mode effect replay keeps the verified owner able to open and cancel confirmation', async () => {
  const h = harness();
  const previousSubscription = [...h.subscriptions][0];
  h.replayEffects();
  assert.equal(h.subscriptions.size, 1);
  previousSubscription('SIGNED_OUT', null);
  assert.ok(!h.text().includes('Owner access changed'), 'an unsubscribed callback cannot invalidate the replayed session');
  h.open();
  assert.equal(h.one(node => node.type === 'dialog').props.ref.current.open, true);
  assert.equal(h.focused(), 'Cancel');
  h.cancel(); await h.submit();
  assert.equal(h.one(node => node.type === 'dialog').props.ref.current.open, false);
  assert.equal(h.focused(), 'delete trigger');
  assert.equal(h.calls.auth.length, 0); assert.equal(h.calls.rpc.length, 0);
});

test('effect replay cannot restore account access after a real auth change', async () => {
  const h = harness(); h.open(); h.type(target.email);
  const staleSubmit = h.one(node => node.type === 'form').props.onSubmit;
  h.auth(null); h.replayEffects(); h.auth('owner', 'SIGNED_IN');
  await staleSubmit({ preventDefault() {} });
  assert.match(h.text(), /Owner access changed/);
  assert.ok(!h.text().includes(target.email));
  assert.equal(h.calls.auth.length, 0); assert.equal(h.calls.rpc.length, 0);
});

for (const phase of ['preflight', 'RPC']) {
  test(`effect replay discards the previous lifecycle's delayed ${phase} result`, async () => {
    const request = deferred();
    const h = harness(phase === 'preflight' ? { authRequest: request } : { rpcRequest: request });
    h.open(); h.type(target.email);
    const pending = h.submit(); await flush(); h.replayEffects();
    request.resolve(phase === 'preflight' ? { data: { user: { id: 'owner' } }, error: null } : { data: target.id, error: null });
    await pending;
    assert.equal(h.calls.rpc.length, phase === 'preflight' ? 0 : 1);
    assert.equal(h.calls.deleted.length, 0);
    await h.submit();
    assert.equal(h.calls.rpc.length, phase === 'preflight' ? 0 : 1, 'the stale operation cannot be retried automatically');
  });
}

test('search reaches all loaded accounts while displaying a bounded list', () => {
  const profiles = Array.from({ length: 1000 }, (_, index) => ({ id: `profile-${index}`, email: `person-${index}@example.test`, created_at: '2026-10-01' }));
  const h = harness({ props: { profiles, totalAccounts: 1234 } });
  assert.equal(h.nodes().filter(node => node.props['aria-label']?.startsWith('Delete account ')).length, 50);
  h.search('PERSON-999@');
  assert.ok(h.text().includes('person-999@example.test'));
  assert.equal(h.nodes().filter(node => node.props['aria-label']?.startsWith('Delete account ')).length, 1);
  assert.match(h.text(), /1,000 loaded accounts from 1,234 registered accounts/);
});

test('confirmed deletion rechecks auth and admin access, requires the exact returned UUID and requests an authoritative refresh', async () => {
  const h = harness(); h.open(); h.type(target.email);
  await h.submit();
  assert.equal(h.calls.auth.length, 1); assert.deepEqual(h.calls.membership, [{ key: 'user_id', value: 'owner' }]);
  assert.equal(h.calls.rpc.length, 1); assert.equal(h.calls.rpc[0].name, 'delete_user_account');
  assert.equal(h.calls.rpc[0].args.target_user_id, target.id); assert.equal(h.calls.rpc[0].args.confirmation_email, target.email);
  assert.deepEqual(h.calls.deleted, [target.email]); assert.deepEqual(h.calls.busy, [true, false]);
  assert.equal(h.nodes().some(node => node.props['aria-label'] === `Delete account ${target.email}`), true, 'no optimistic row removal');
  assert.equal(h.button('Permanently delete account').props.disabled, true, 'wait for fresh parent data');
});

test('double submission is single-flight and the pending confirmation cannot be cancelled', async () => {
  const rpcRequest = deferred(), h = harness({ rpcRequest }); h.open(); h.type(target.email);
  const first = h.submit(), second = h.submit(); await flush(); h.render();
  assert.equal(h.calls.auth.length, 1); assert.equal(h.calls.rpc.length, 1);
  let cancelled = false;
  h.one(node => node.type === 'dialog').props.onCancel({ preventDefault() { cancelled = true; } });
  assert.equal(cancelled, true); assert.equal(h.button('Cancel').props.disabled, true);
  rpcRequest.resolve({ data: target.id, error: null }); await Promise.all([first, second]);
  assert.equal(h.calls.deleted.length, 1);
});

for (const options of [{ userId: null }, { userId: 'another-user' }, { authError: true }, { adminDenied: true }, { adminError: true }, { noClient: true }]) {
  test(`expired or unverified owner access blocks RPC and clears the private control: ${JSON.stringify(options)}`, async () => {
    const h = harness(options); h.open(); h.type(target.email); await h.submit();
    assert.equal(h.calls.rpc.length, 0); assert.equal(h.calls.access, 1);
    assert.match(h.text(), /Owner access changed/); assert.ok(!h.text().includes(target.email));
  });
}

for (const options of [{ rpcReject: true }, { result: true }, { result: other.id }, { rpcError: { code: '22023' } }, { rpcError: { code: 'P0002' } }]) {
  test(`an unconfirmed result preserves the list and locks retry pending refresh: ${JSON.stringify(options)}`, async () => {
    const h = harness(options); h.open(); h.type(target.email); await h.submit();
    assert.equal(h.calls.deleted.length, 0); assert.ok(h.text().includes('may have completed'));
    assert.ok(h.text().includes(target.email));
    await h.submit(); assert.equal(h.calls.rpc.length, 1);
    assert.equal(h.button('Permanently delete account').props.disabled, true);
  });
}

test('an RPC permission failure clears access instead of retaining private account rows', async () => {
  const h = harness({ rpcError: { code: '42501' } }); h.open(); h.type(target.email); await h.submit();
  assert.equal(h.calls.access, 1); assert.equal(h.calls.deleted.length, 0);
  assert.ok(!h.text().includes(target.email));
});

test('a timeout is ambiguous and cannot trigger an automatic retry or success', async () => {
  const rpcRequest = deferred(), h = harness({ rpcRequest, fastDeadline: true }); h.open(); h.type(target.email);
  await h.submit(); assert.match(h.text(), /may have completed/);
  await h.submit(); assert.equal(h.calls.rpc.length, 1); assert.equal(h.calls.deleted.length, 0);
  rpcRequest.resolve({ data: target.id, error: null }); await flush();
  assert.equal(h.calls.deleted.length, 0, 'a response after the deadline cannot retroactively report success');
});

test('confirmed deletion followed by refresh failure remains distinct from an ambiguous deletion', async () => {
  const h = harness({ refreshReject: true }); h.open(); h.type(target.email); await h.submit();
  assert.match(h.text(), /account was deleted, but the dashboard could not be refreshed/);
  await h.submit(); assert.equal(h.calls.rpc.length, 1);
});

for (const nextUser of [null, 'another-user']) {
  test(`an identity change to ${nextUser} blocks a delayed preflight from deleting`, async () => {
    const authRequest = deferred(), h = harness({ authRequest }); h.open(); h.type(target.email);
    const pending = h.submit(); h.auth(nextUser); authRequest.resolve({ data: { user: { id: 'owner' } }, error: null }); await pending;
    assert.equal(h.calls.rpc.length, 0); assert.equal(h.calls.deleted.length, 0);
    assert.ok(!h.text().includes(target.email));
  });
  test(`an identity change to ${nextUser} discards a late deletion response`, async () => {
    const rpcRequest = deferred(), h = harness({ rpcRequest }); h.open(); h.type(target.email);
    const pending = h.submit(); await flush(); assert.equal(h.calls.rpc.length, 1);
    h.auth(nextUser); rpcRequest.resolve({ data: target.id, error: null }); await pending;
    assert.equal(h.calls.deleted.length, 0); assert.ok(!h.text().includes(target.email));
  });
}

test('same-account token refresh preserves the in-flight operation', async () => {
  const rpcRequest = deferred(), h = harness({ rpcRequest }); h.open(); h.type(target.email);
  const pending = h.submit(); await flush(); h.auth('owner', 'TOKEN_REFRESHED');
  rpcRequest.resolve({ data: target.id, error: null }); await pending;
  assert.deepEqual(h.calls.deleted, [target.email]);
});

test('unmount unsubscribes and discards a late successful response', async () => {
  const rpcRequest = deferred(), h = harness({ rpcRequest }); h.open(); h.type(target.email);
  const pending = h.submit(); await flush(); h.unmount();
  assert.equal(h.subscriptions.size, 0);
  rpcRequest.resolve({ data: target.id, error: null }); await pending;
  assert.equal(h.calls.deleted.length, 0);
});

test('changed target email, newly protected target or parent save cannot reuse an old confirmation', async () => {
  for (const update of [{ profiles: [owner, admin, { ...target, email: 'changed@example.test' }] }, { protectedUserIds: ['owner', 'admin', target.id] }, { disabled: true }]) {
    const h = harness(); h.open(); h.type(target.email); h.update(update); await h.submit();
    assert.equal(h.calls.rpc.length, 0); assert.equal(h.calls.auth.length, 0);
  }
});
