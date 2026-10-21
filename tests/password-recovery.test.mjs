import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const helperSource = compile('../app/lib/account-recovery.ts');
const pageSource = compile('../app/reset-password/page.tsx');
const forgotSource = compile('../app/forgot-password/page.tsx');
const extras = {}, searchHelper = {};
vm.runInNewContext(compile('../app/lib/car-extras.ts'), { exports: extras });
vm.runInNewContext(compile('../app/lib/saved-search.ts'), { exports: searchHelper, URL, URLSearchParams, setTimeout, clearTimeout, require(name) { assert.equal(name, './car-extras'); return extras; } });
const SID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', SID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const session = (id, sid = SID_A) => ({ user: { id, email: id + '@example.test' }, access_token: 'test.' + Buffer.from(JSON.stringify({ sub: id, session_id: sid })).toString('base64url') + '.test', refresh_token: 'test-only-refresh-' + id });
const A = session('recovery'), B = session('owner', SID_B);
const callbackUrl = value => 'https://mekivo.uk/reset-password#type=recovery&access_token=' + value.access_token + '&refresh_token=' + value.refresh_token + '&expires_in=3600&token_type=bearer';
const settle = async () => { for (let n = 0; n < 16; n++) await Promise.resolve(); };

function helperHarness(options = {}) {
  const storage = options.storage || new Map(), callbacks = [], factories = [], updates = [], exports = {}, timers = new Map();
  let current = options.current ?? null, clock = 1_000_000, timerId = 0;
  const fakeStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const auth = { onAuthStateChange(callback) { callbacks.push(callback); return { data: { subscription: { unsubscribe() { callbacks.splice(callbacks.indexOf(callback), 1); } } } }; }, getSession: async () => ({ data: { session: current }, error: null }) };
  const emit = (event, value) => { current = value; for (const cb of [...callbacks]) cb(event, value); };
  const makeClient = (_url, _key, config) => {
    factories.push(config); let bound;
    return { auth: {
      async setSession(tokens) {
        bound = tokens.access_token === A.access_token ? A : B;
        if (options.duringSet) await options.duringSet({ emit, updates });
        return { data: { session: bound, user: bound.user }, error: null };
      },
      async updateUser(value) {
        if (options.duringUpdate) await options.duringUpdate({ emit, updates });
        updates.push({ userId: bound.user.id, ...value });
        if (options.updateError) return { data: { user: null }, error: options.updateError };
        return { data: { user: bound.user }, error: null };
      },
    } };
  };
  const timeout = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); if (delay === 0) queueMicrotask(() => { if (timers.has(id)) { timers.delete(id); fn(); } }); return id; };
  const win = { sessionStorage: fakeStorage, location: { href: options.href || callbackUrl(A) }, setTimeout: timeout, clearTimeout: id => timers.delete(id) };
  vm.runInNewContext(helperSource, { exports, window: win, Date: class extends Date { static now() { return clock; } }, atob, URL, URLSearchParams, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://project.example.test', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key' } }, require(name) { assert.equal(name, '@supabase/supabase-js'); return { createClient: makeClient }; } });
  exports.observePasswordRecovery(auth, exports.passwordRecoveryCallbackIdentity());
  return { helper: exports, auth, emit, updates, factories, storage, win, timers, timeout, setClock(value) { clock = value; }, client: { auth }, get current() { return current; } };
}
function pageHarness(h, source = pageSource) {
  const slots = [], effects = [], exports = {}; let cursor = 0, mounted = false;
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(callback) { if (!mounted) effects.push(callback); },
  };
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(source, { exports, URL, URLSearchParams, window: h.win, setTimeout: h.timeout, clearTimeout: id => h.timers.delete(id), Date, require(name) {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'next/link') return { default: 'a' };
    if (name === '../lib/supabase') return { getSupabaseBrowserClient: () => h.client };
    if (name === '../lib/saved-search') return { ...searchHelper, withRequestDeadline: value => Promise.resolve(value) };
    if (name === '../lib/account-recovery') return h.helper;
    throw Error(name);
  } });
  const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : [node?.props?.children].flat(Infinity).filter(Boolean).map(text).join(' ');
  const render = () => { cursor = 0; const tree = exports.default(); mounted = true; effects.splice(0).forEach(effect => effect()); return { nodes: nodes(tree), text: text(tree) }; };
  return { render, fill(value = 'new-test-password') { const inputs = render().nodes.filter(node => node.type === 'input'); assert.equal(inputs.length, 2); inputs.forEach(input => input.props.onChange({ target: { value } })); }, submit() { return render().nodes.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); } };
}

test('ordinary existing owner login never enables the recovery form or creates an update client', async () => {
  const h = helperHarness({ current: B, href: 'https://mekivo.uk/reset-password' }), page = pageHarness(h); page.render(); await settle();
  const result = page.render(); assert.equal(result.nodes.filter(n => n.type === 'input').length, 0); assert.match(result.text, /fresh recovery link/); assert.equal(h.factories.length, 0);
});

test('an actual expired-link error blocks an existing session without echoing URL details', async () => {
  const h = helperHarness({ current: B, href: 'https://mekivo.uk/reset-password#error=access_denied&error_code=otp_expired&error_description=private-example-text' });
  h.emit('PASSWORD_RECOVERY', B); const page = pageHarness(h); page.render(); await settle();
  const result = page.render(); assert.equal(result.nodes.filter(n => n.type === 'input').length, 0); assert.match(result.text, /invalid, expired or has already been used/); assert.doesNotMatch(result.text, /private-example-text/); assert.equal(h.storage.size, 0); assert.equal(h.factories.length, 0);
});

test('recovery event consumed before the page mounts still shows the exact account', async () => {
  const h = helperHarness(); h.emit('PASSWORD_RECOVERY', A);
  const page = pageHarness(h); page.render(); await settle();
  assert.equal(page.render().nodes.filter(n => n.type === 'input').length, 2); assert.match(page.render().text, /Resetting password for\s+recovery@example.test/);
  const saved = JSON.parse([...h.storage.values()][0]); assert.deepEqual(Object.keys(saved).sort(), ['expiresAt', 'sessionId', 'userId']); assert.doesNotMatch(JSON.stringify(saved), /refresh|test\.|@example/);
});

test('genuine recovery supports a reload in its own session but never another login of the same account', () => {
  const h = helperHarness(); h.emit('PASSWORD_RECOVERY', A);
  const reload = helperHarness({ storage: h.storage, current: A, href: 'https://mekivo.uk/reset-password' });
  assert.equal(reload.helper.passwordRecoveryTarget(A).userId, A.user.id);
  assert.equal(reload.helper.passwordRecoveryTarget(session(A.user.id, SID_B)), null);
  reload.emit('SIGNED_IN', session(A.user.id, SID_B)); assert.equal(reload.storage.size, 0);
});

test('recovery intent expires after fifteen minutes and signing out invalidates it', () => {
  const h = helperHarness(); h.emit('PASSWORD_RECOVERY', A);
  h.setClock(1_000_000 + h.helper.RECOVERY_WINDOW_MS); assert.equal(h.helper.passwordRecoveryTarget(A), null); assert.equal(h.storage.size, 0);
  h.emit('PASSWORD_RECOVERY', A); h.emit('SIGNED_OUT', null); assert.equal(h.helper.passwordRecoveryTarget(A), null);
});

test('cross-tab sign-in clears the target and entered passwords instead of reusing them for the owner', async () => {
  const h = helperHarness(); h.emit('PASSWORD_RECOVERY', A); const page = pageHarness(h); page.render(); await settle(); page.fill();
  h.emit('SIGNED_IN', B); await settle(); const result = page.render();
  assert.equal(result.nodes.filter(n => n.type === 'input').length, 0); assert.doesNotMatch(result.text, /owner@example.test|recovery@example.test/); assert.equal(h.updates.length, 0); assert.equal(h.storage.size, 0);
});

test('a successful reset uses an isolated nonpersistent client and clears intent and password fields', async () => {
  const h = helperHarness(); h.emit('PASSWORD_RECOVERY', A); const page = pageHarness(h); page.render(); await settle(); page.fill(); await page.submit();
  assert.equal(h.updates.length, 1); assert.equal(h.updates[0].userId, 'recovery'); assert.equal(h.updates[0].password, 'new-test-password');
  assert.deepEqual(JSON.parse(JSON.stringify(h.factories[0].auth)), { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
  assert.match(page.render().text, /Password updated for\s+recovery@example.test/); assert.equal(page.render().nodes.filter(n => n.type === 'input').length, 0); assert.equal(h.storage.size, 0);
});

test('an account switch during private session validation cancels before sending a password update', async () => {
  const h = helperHarness({ duringSet: ({ emit }) => emit('SIGNED_IN', B) }); h.emit('PASSWORD_RECOVERY', A);
  await assert.rejects(h.helper.updateRecoveryPassword(A, 'new-test-password'), /session changed/); assert.equal(h.updates.length, 0);
});

test('even a switch during the SDK update cannot retarget the bound request to the owner', async () => {
  const h = helperHarness({ duringUpdate: ({ emit }) => emit('SIGNED_IN', B) }); h.emit('PASSWORD_RECOVERY', A);
  const user = await h.helper.updateRecoveryPassword(A, 'new-test-password');
  assert.equal(user.id, 'recovery'); assert.equal(h.current.user.id, 'owner'); assert.deepEqual(h.updates.map(x => x.userId), ['recovery']);
});

test('malformed, non-recovery and expired callback shapes are rejected while plain reloads are allowed', () => {
  const h = helperHarness();
  for (const suffix of ['#type=recovery', '#access_token=private&refresh_token=private', '?error_code=otp_expired', '?token_hash=private&type=recovery', '?code=private']) assert.equal(h.helper.invalidPasswordRecoveryLink('https://mekivo.uk/reset-password' + suffix), true);
  assert.equal(h.helper.invalidPasswordRecoveryLink('https://mekivo.uk/reset-password#type=recovery&access_token=private&refresh_token=private&expires_in=3600&token_type=bearer'), false);
  assert.equal(h.helper.invalidPasswordRecoveryLink('https://mekivo.uk/reset-password'), false);
});

test('a recovery event arriving after startup wins over an older getSession response', async () => {
  let finish; const h = helperHarness({ current: B }); h.auth.getSession = () => new Promise(resolve => { finish = resolve; });
  const page = pageHarness(h); page.render(); h.emit('PASSWORD_RECOVERY', A); finish({ data: { session: B }, error: null }); await settle();
  assert.match(page.render().text, /recovery@example.test/); assert.doesNotMatch(page.render().text, /owner@example.test/); assert.equal(page.render().nodes.filter(n => n.type === 'input').length, 2);
});

test('known weak-password errors keep the selected recovery account available for correction', async () => {
  const h = helperHarness({ updateError: { code: 'weak_password' } }); h.emit('PASSWORD_RECOVERY', A); const page = pageHarness(h); page.render(); await settle(); page.fill(); await page.submit();
  assert.match(page.render().text, /stronger password/); assert.match(page.render().text, /recovery@example.test/); assert.equal(page.render().nodes.filter(n => n.type === 'input').length, 2);
});


test('a PASSWORD_RECOVERY broadcast without this document callback cannot create recovery intent', async () => {
  const h = helperHarness({ current: B, href: 'https://mekivo.uk/reset-password' });
  const page = pageHarness(h); page.render(); await settle();
  h.emit('PASSWORD_RECOVERY', A); await settle();
  assert.equal(h.helper.passwordRecoveryTarget(A), null); assert.equal(h.storage.size, 0);
  assert.equal(page.render().nodes.filter(n => n.type === 'input').length, 0);
});

test('a foreign recovery broadcast during local callback initialization cannot consume its expected identity', async () => {
  const h = helperHarness({ current: B, href: callbackUrl(A) });
  h.emit('PASSWORD_RECOVERY', B); assert.equal(h.helper.passwordRecoveryTarget(B), null); assert.equal(h.storage.size, 0);
  h.emit('PASSWORD_RECOVERY', A); assert.equal(h.helper.passwordRecoveryTarget(A).userId, 'recovery');
  const page = pageHarness(h); page.render(); await settle();
  assert.match(page.render().text, /recovery@example.test/); assert.doesNotMatch(page.render().text, /owner@example.test/);
});

test('the expiry callback does not replace an already completed password confirmation', async () => {
  const h = helperHarness(); h.emit('PASSWORD_RECOVERY', A); const page = pageHarness(h); page.render(); await settle(); page.fill(); await page.submit();
  for (const timer of [...h.timers.values()]) timer.fn();
  assert.match(page.render().text, /Password updated for/); assert.doesNotMatch(page.render().text, /session has expired/);
});


const safeCriteria = '/?restore=1&mode=cars&make=Ford&model=Fiesta&price=5000&platform=ebay';
const safeReturn = searchHelper.safeSearchReturnUrl(safeCriteria);
const withReturn = (path, value) => 'https://mekivo.uk' + path + '?' + new URLSearchParams({ returnTo: value });

test('fixed auth paths preserve canonical search criteria and reject foreign or non-search returns', () => {
  for (const route of ['https://evil.example/', '/admin', '//evil.example/']) assert.equal(searchHelper.accountRecoveryPath(route, safeCriteria), '/account');
  for (const route of ['/account', '/forgot-password', '/reset-password']) {
    const url = new URL(searchHelper.accountRecoveryPath(route, safeCriteria), 'https://mekivo.uk');
    assert.equal(url.pathname, route); assert.equal(url.searchParams.get('returnTo'), safeReturn);
    assert.deepEqual([...url.searchParams.keys()], ['returnTo']);
    for (const bad of ['https://evil.example/', '//evil.example/', 'javascript:alert(1)', '/admin', '/?next=https://evil.example/']) assert.equal(searchHelper.accountRecoveryPath(route, bad), route);
  }
});

test('forgot-password sends the safe return with its fixed production reset destination and preserves its back link', async () => {
  const calls = [], h = helperHarness({ href: withReturn('/forgot-password', safeCriteria) });
  h.auth.resetPasswordForEmail = async (email, options) => { calls.push({ email, options }); return { error: null }; };
  const page = pageHarness(h, forgotSource); page.render(); await settle();
  const emailInput = page.render().nodes.find(n => n.type === 'input'); emailInput.props.onChange({ target: { value: 'recovery@example.test' } });
  await page.submit();
  assert.equal(calls.length, 1); assert.equal(calls[0].email, 'recovery@example.test');
  const callback = new URL(calls[0].options.redirectTo); assert.equal(callback.origin, 'https://mekivo.uk'); assert.equal(callback.pathname, '/reset-password'); assert.equal(callback.searchParams.get('returnTo'), safeReturn);
  const back = page.render().nodes.find(n => n.type === 'a' && n.props.children === '← Back to sign in');
  assert.equal(new URL(back.props.href, 'https://mekivo.uk').searchParams.get('returnTo'), safeReturn);
});

test('expired-link guidance retains safe criteria in both account and fresh-link request paths', async () => {
  const h = helperHarness({ current: B, href: withReturn('/reset-password', safeCriteria) + '#error_code=otp_expired' });
  const page = pageHarness(h); page.render(); await settle();
  const result = page.render(); assert.match(result.text, /invalid, expired/); assert.equal(result.nodes.filter(n => n.type === 'input').length, 0);
  const links = result.nodes.filter(n => n.type === 'a');
  for (const label of ['← Account', 'Request a new recovery link']) {
    const url = new URL(links.find(n => n.props.children === label).props.href, 'https://mekivo.uk');
    assert.equal(url.pathname, label === '← Account' ? '/account' : '/forgot-password'); assert.equal(url.searchParams.get('returnTo'), safeReturn);
  }
});

test('successful recovery keeps its safe return-to-account path', async () => {
  const href = withReturn('/reset-password', safeCriteria) + new URL(callbackUrl(A)).hash;
  const h = helperHarness({ href }); h.emit('PASSWORD_RECOVERY', A); const page = pageHarness(h); page.render(); await settle(); page.fill(); await page.submit();
  const link = page.render().nodes.find(n => n.type === 'a' && n.props.children === 'Return to your account');
  const url = new URL(link.props.href, 'https://mekivo.uk'); assert.equal(url.pathname, '/account'); assert.equal(url.searchParams.get('returnTo'), safeReturn);
});

test('a foreign return is never copied into forgot-password email or recovery navigation', async () => {
  const calls = [], h = helperHarness({ href: withReturn('/forgot-password', 'https://evil.example/collect') });
  h.auth.resetPasswordForEmail = async (email, options) => { calls.push({ email, options }); return { error: null }; };
  const page = pageHarness(h, forgotSource); page.render(); await settle();
  page.render().nodes.find(n => n.type === 'input').props.onChange({ target: { value: 'recovery@example.test' } }); await page.submit();
  assert.equal(calls[0].options.redirectTo, 'https://mekivo.uk/reset-password');
  assert.equal(page.render().nodes.find(n => n.type === 'a').props.href, '/account');
});
