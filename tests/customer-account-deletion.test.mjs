import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/account/page.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const customer = { id: 'customer', email: 'customer@example.test' };
const second = { id: 'second', email: 'second@example.test' };
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : node?.props ? text(node.props.children) : '';
function nodes(node, found = []) { if (Array.isArray(node)) node.forEach(child => nodes(child, found)); else if (node?.props) { found.push(node); nodes(node.props.children, found); } return found; }
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

// Controlled component/DOM doubles exercise real handlers with no browser,
// network, database, native confirm prompt or actual accounts.
async function harness(options = {}) {
  let cursor = 0, mounted = false, tree, focused, callback, currentUser = customer, authReads = 0, membershipReads = 0;
  const slots = [], effects = [], timers = [], elements = new Map();
  const calls = { rpc: [], signOut: 0, authPreflight: 0, membership: [] };
  const client = {
    auth: {
      getUser() {
        if (authReads++ === 0) return Promise.resolve({ data: { user: currentUser }, error: null });
        calls.authPreflight++;
        return options.authRequest?.promise || Promise.resolve({ data: { user: options.authUser === undefined ? currentUser : options.authUser }, error: options.authError ? { message: 'Unavailable' } : null });
      },
      getSession: () => options.sessionRequest?.promise || Promise.resolve({ data: { session: { user: options.sessionUser || currentUser, access_token: 'selected-test-token' } }, error: options.sessionError ? { message: 'Unavailable' } : null }),
      onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() {} } } }; },
      async signOut() { calls.signOut++; return { error: null }; },
    },
    from(table) {
      if (table === 'saved_items') return { select() { return this; }, eq() { return this; }, async order() { return { data: [], error: null }; } };
      assert.equal(table, 'admins');
      return { select() { return this; }, eq(key, value) { calls.membership.push([key, value]); return this; }, async maybeSingle() {
        const preflight = membershipReads++ > 0;
        return { data: options.admin || (preflight && options.protectedAtConfirm) ? { user_id: currentUser.id } : null, error: preflight && options.membershipError ? { message: 'Unavailable' } : null };
      } };
    },
    rpc(name) {
      const headers = {};
      return { setHeader(key, value) { headers[key] = value; return this; }, then(resolve, reject) {
        calls.rpc.push({ name, headers });
        return (options.rpcRequest?.promise || Promise.resolve({ error: options.rpcError || null })).then(resolve, reject);
      } };
    },
  };
  const hooks = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback: fn => fn,
    useEffect(fn) { if (!mounted) effects.push(fn); },
  };
  const jsx = (type, props) => typeof type === 'function' ? type(props) : ({ type, props });
  const exports = {};
  vm.runInNewContext(code, { exports, URLSearchParams, window: { location: { search: '' }, setTimeout(fn) { timers.push(fn); return 1; }, clearTimeout() {} }, require(name) {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'next/link') return { default: 'a' };
    if (name === '../lib/supabase') return { getSupabaseBrowserClient: () => client, isSupabaseConfigured: () => true };
    if (name === '../lib/saved-search') return { safeSearchReturnUrl: () => null, accountRecoveryPath: path => path, withRequestDeadline: request => Promise.resolve(request) };
    if (name === '../lib/saved-listings') return { getPendingListingToken: () => null };
    if (name === '../components/saved-listing-card') return { default: () => null };
    throw Error(`Unexpected import: ${name}`);
  } });
  function render() {
    cursor = 0; tree = exports.default();
    for (const node of nodes(tree)) if (node.props.ref) {
      const element = elements.get(node.props.ref) || { open: false, focus() { focused = text(element.node); } };
      element.node = node; elements.set(node.props.ref, element);
      if (node.type === 'dialog') {
        element.showModal = () => { element.open = true; };
        element.close = () => { if (element.open) { element.open = false; element.node.props.onClose(); } };
      }
      node.props.ref.current = element;
    }
    if (!mounted) { mounted = true; effects.splice(0).forEach(fn => fn()); }
    return tree;
  }
  const runTimers = () => timers.splice(0).forEach(fn => fn());
  const one = predicate => { const found = nodes(render()).filter(predicate); assert.equal(found.length, 1, 'Exactly one requested control'); return found[0]; };
  const button = label => one(node => node.type === 'button' && text(node) === label);
  const dialog = () => one(node => node.type === 'dialog');
  render(); runTimers(); await flush(); render();
  return {
    calls, render, nodes: () => nodes(render()), text: () => text(render()), button, dialog, focused: () => focused,
    open() { button('Delete my account').props.onClick(); render(); },
    cancel() { button('Cancel').props.onClick(); render(); },
    confirm() { return button('Permanently delete my account').props.onClick(); },
    escape() { let prevented = false; dialog().props.onCancel({ preventDefault() { prevented = true; } }); render(); return prevented; },
    backdrop() { const element = { getBoundingClientRect: () => ({ left: 10, right: 300, top: 10, bottom: 200 }) }; dialog().props.onClick({ target: element, currentTarget: element, clientX: 0, clientY: 0 }); render(); },
    async switchUser(user, defer = false) { currentUser = user; callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', user ? { user } : null); if (!defer) { runTimers(); await flush(); } render(); },
  };
}

test('opening deletion only shows a named dialog with Cancel focused; it never calls RPC', async () => {
  const h = await harness(); h.open();
  assert.equal(h.dialog().props.ref.current.open, true); assert.equal(h.focused(), 'Cancel');
  assert.equal(h.dialog().props['aria-labelledby'], 'delete-own-account-title');
  assert.equal(h.dialog().props['aria-describedby'], 'delete-own-account-description');
  assert.match(text(h.dialog()), /customer@example.test/);
  assert.equal(h.button('Permanently delete my account').props.type, 'button');
  assert.equal(nodes(h.dialog()).some(node => node.type === 'form'), false, 'Enter on unrelated content cannot implicitly submit deletion');
  assert.equal(h.calls.rpc.length, 0); assert.equal(h.calls.authPreflight, 0);
});

for (const action of ['cancel', 'escape', 'backdrop']) test(`${action} closes confirmation and returns focus without any destructive request`, async () => {
  const h = await harness(); h.open(); h[action](); await h.confirm();
  assert.equal(h.dialog().props.ref.current.open, false); assert.equal(h.focused(), 'Delete my account');
  assert.equal(h.calls.rpc.length, 0); assert.equal(h.calls.authPreflight, 0);
});

test('confirmation without opening the dialog is inert', async () => {
  const h = await harness(); await h.confirm(); assert.equal(h.calls.rpc.length, 0);
});

test('explicit confirmation revalidates the customer and pins the RPC to that selected session', async () => {
  const h = await harness(); h.open(); await h.confirm(); await flush();
  assert.equal(h.calls.rpc.length, 1); assert.equal(h.calls.rpc[0].name, 'delete_my_account');
  assert.equal(h.calls.rpc[0].headers.Authorization, 'Bearer selected-test-token');
  assert.deepEqual(h.calls.membership.at(-1), ['user_id', 'customer']);
  assert.equal(h.calls.signOut, 1); assert.match(h.text(), /account and stored data were deleted/);
  assert.equal(h.dialog().props.ref.current.open, false);
});

test('owner/admin accounts have no deletion trigger and cannot call the RPC', async () => {
  const h = await harness({ admin: true });
  assert.equal(h.nodes().some(node => node.type === 'button' && text(node) === 'Delete my account'), false);
  await h.confirm(); assert.equal(h.calls.rpc.length, 0);
});

for (const options of [{ protectedAtConfirm: true }, { membershipError: true }, { authUser: second }, { authError: true }, { sessionUser: second }, { sessionError: true }]) test(`unverified or protected current account blocks deletion: ${JSON.stringify(options)}`, async () => {
  const h = await harness(options); h.open(); await h.confirm();
  assert.equal(h.calls.rpc.length, 0); assert.equal(h.calls.signOut, 0); assert.match(h.text(), /could not be verified for deletion/);
});

for (const phase of ['auth', 'session']) test(`an account switch during ${phase} preflight cannot delete either account`, async () => {
  const request = deferred(); const h = await harness({ [phase === 'auth' ? 'authRequest' : 'sessionRequest']: request });
  h.open(); const pending = h.confirm(); await flush(); await h.switchUser(second);
  request.resolve(phase === 'auth' ? { data: { user: customer }, error: null } : { data: { session: { user: customer, access_token: 'selected-test-token' } }, error: null });
  await pending; assert.equal(h.calls.rpc.length, 0); assert.equal(h.calls.signOut, 0);
  assert.match(h.text(), /second@example.test/); assert.equal(h.dialog().props.ref.current.open, false);
});

test('auth changes invalidate a stale confirmation before its deferred UI update', async () => {
  const h = await harness(); h.open(); const staleConfirm = h.button('Permanently delete my account').props.onClick;
  await h.switchUser(second, true); await staleConfirm();
  assert.equal(h.calls.rpc.length, 0); assert.equal(h.dialog().props.ref.current.open, false);
});

test('signing out and returning to the same identity cannot restore a pending confirmation or leave deletion stuck', async () => {
  const request = deferred(); const h = await harness({ authRequest: request }); h.open(); const pending = h.confirm();
  await h.switchUser(null, true); await h.switchUser(customer);
  request.resolve({ data: { user: customer }, error: null }); await pending;
  assert.equal(h.calls.rpc.length, 0); assert.equal(h.dialog().props.ref.current.open, false);
  h.open(); assert.equal(h.dialog().props.ref.current.open, true); assert.equal(h.focused(), 'Cancel');
});

test('pending deletion is single-flight and cannot be cancelled by button, Escape or backdrop', async () => {
  const request = deferred(); const h = await harness({ rpcRequest: request }); h.open();
  const first = h.confirm(); await flush(); const secondClick = h.confirm();
  assert.equal(h.calls.rpc.length, 1); assert.equal(h.button('Cancel').props.disabled, true);
  assert.equal(h.escape(), true); h.cancel(); h.backdrop();
  assert.equal(h.dialog().props.ref.current.open, true);
  h.dialog().props.ref.current.close();
  assert.equal(h.dialog().props.ref.current.open, true, 'a pending selected request also blocks an unexpected dialog close');
  request.resolve({ error: null }); await Promise.all([first, secondClick]);
  assert.equal(h.calls.rpc.length, 1); assert.equal(h.calls.signOut, 1);
});

test('a late RPC response after an account switch cannot sign out or clear the new account', async () => {
  const request = deferred(); const h = await harness({ rpcRequest: request }); h.open(); const pending = h.confirm(); await flush();
  assert.equal(h.calls.rpc.length, 1); await h.switchUser(second);
  request.resolve({ error: null }); await pending;
  assert.equal(h.calls.signOut, 0); assert.match(h.text(), /second@example.test/); assert.doesNotMatch(h.text(), /were deleted/);
});

test('an ambiguous deletion result disables retry and never reports success', async () => {
  const h = await harness({ rpcError: { message: 'Response unavailable' } }); h.open(); await h.confirm();
  assert.match(h.text(), /may have completed/); assert.equal(h.button('Permanently delete my account').props.disabled, true);
  await h.confirm(); assert.equal(h.calls.rpc.length, 1); assert.equal(h.calls.signOut, 0);
  h.cancel(); h.open(); assert.equal(h.dialog().props.ref.current.open, false);
});
