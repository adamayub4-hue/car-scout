import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const helperCode = ts.transpileModule(readFileSync(new URL('../app/lib/saved-search.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const helper = {};
vm.runInNewContext(helperCode, { exports: helper, URL, URLSearchParams, setTimeout, clearTimeout });
const source = readFileSync(new URL('../app/account/page.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(name, context) {
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) {
      const initializer = node.initializer;
      expression = (ts.isCallExpression(initializer) && initializer.expression.getText(ast) === 'useCallback' ? initializer.arguments[0] : initializer).getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return vm.runInNewContext(`${code}\nrun`, { withRequestDeadline: request => Promise.resolve(request), ...context });
}

function accountHarness(reads, options = {}) {
  const component = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const slots = [], effects = [], exports = {};
  let cursor = 0, mounted = false, readCount = 0, authCallback;
  const queriedUsers = [], saved = [], cleared = [], signups = [];
  const initialUser = options.user === undefined ? { id: 'test', email: 'test@example.test' } : options.user;
  const client = {
    auth: { getUser: async () => ({ data: { user: initialUser }, error: null }), onAuthStateChange: callback => { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; }, signUp: async value => { signups.push(value); return { data: { user: null, session: null }, error: null }; } },
    from(table) {
      if (table === 'saved_items') return { select: () => ({ eq: (column, userId) => { assert.equal(column, 'user_id'); queriedUsers.push(userId); return { order: () => reads[readCount++]() }; } }) };
      assert.equal(table, 'admins');
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    },
  };
  const hooks = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useCallback: callback => callback,
    useEffect(callback) { if (!mounted) effects.push(callback); },
  };
  const jsx = (type, props) => typeof type === 'function' ? type(props) : ({ type, props });
  vm.runInNewContext(component, {
    exports, URLSearchParams,
    window: { location: { search: options.search || '' }, setTimeout(callback) { callback(); return 1; }, clearTimeout() {} },
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/link') return { default: 'a' };
      if (name === '../lib/saved-search') return { ...helper, withRequestDeadline: request => Promise.resolve(request) };
      if (name === '../lib/saved-listings') return { getPendingListingExpiresAt: () => null, getPendingListingSnapshotExpiresAt: () => null, getPendingListingToken: () => options.pendingToken || null, readPendingListing: token => token === options.pendingToken ? options.pendingItem : null, clearPendingListing: token => cleared.push(token), parseSavedListing: item => item.data?.id ? item : null, saveListingToAccount: async (_client, userId, item) => { saved.push({ userId, item }); return options.save ? options.save() : { id: 'saved-listing', alreadySaved: false }; } };
      if (name === '../components/saved-listing-card') return { default: props => jsx('article', { children: [props.item.title, props.action] }) };
      if (name === '../lib/supabase') return { getSupabaseBrowserClient: () => client, isSupabaseConfigured: () => true };
      throw Error(name);
    },
  });
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  }
  function text(node) {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    return [node?.props?.children].flat(Infinity).map(child => child ? text(child) : '').join(' ');
  }
  return {
    render() { cursor = 0; const tree = exports.default(); mounted = true; effects.splice(0).forEach(effect => effect()); return { text: text(tree), nodes: nodes(tree) }; },
    get readCount() { return readCount; },
    queriedUsers, saved, cleared, signups,
    switchUser(user) { authCallback('SIGNED_IN', user ? { user } : null); },
  };
}

const settle = async () => { for (let index = 0; index < 6; index++) await Promise.resolve(); };

test('saved car and part searches round-trip through safe local links', () => {
  const car = helper.getSavedSearchUrl({ kind: 'car_search', title: 'Car', data: { make: 'Ford', model: 'Fiesta', price: '5000', postcode: 'SW1A 1AA', platform: 'all', links: { unsafe: 'javascript:alert(1)' } } });
  const parsedCar = helper.parseSavedSearchParams(new URL(car, 'https://mekivo.uk').searchParams);
  assert.equal(parsedCar.make, 'Ford'); assert.equal(parsedCar.price, '5000'); assert.equal(parsedCar.postcode, 'SW1A 1AA');
  assert.ok(!car.includes('javascript'));
  const parts = helper.getSavedSearchUrl({ kind: 'part_search', title: 'Parts', data: { make: 'VW', model: 'Golf', year: '2019', part: 'Oil Filter', partCategory: 'Engine', partMethod: 'diagram' } });
  const parsedParts = helper.parseSavedSearchParams(new URL(parts, 'https://mekivo.uk').searchParams);
  assert.equal(parsedParts.mode, 'parts'); assert.equal(parsedParts.partCategory, 'Engine'); assert.equal(parsedParts.partMethod, 'diagram');
});

test('direct part-number resume strips stale vehicle data and rejects unsafe return URLs', () => {
  const link = helper.getSavedSearchUrl({ kind: 'part_search', title: 'OEM', data: { searchMethod: 'part_number', make: 'Ford', model: 'Fiesta', year: '2018', partNumber: '1K0 698 151 F' } });
  const restored = helper.parseSavedSearchParams(new URL(link, 'https://mekivo.uk').searchParams);
  assert.equal(restored.make, ''); assert.equal(restored.model, ''); assert.equal(restored.year, ''); assert.equal(restored.partNumber, '1K0 698 151 F');
  for (const unsafe of ['javascript:alert(1)', '//evil.test/', 'https://evil.test', '/admin', '/?next=https://evil.test']) assert.equal(helper.safeSearchReturnUrl(unsafe), null);
  assert.equal(helper.safeSearchReturnUrl(link), link);
});

test('saved-data query errors keep the existing list and expose a retryable error', async () => {
  let list = [{ id: 'existing' }], loading, error;
  const run = handler('loadItems', {
    getSupabaseBrowserClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: null, error: { message: 'offline' } }) }) }) }) }),
    activeUserId: { current: 'test' }, itemsRequest: { current: 0 }, setItems: value => { list = value; }, setItemsLoading: value => { loading = value; }, setItemsError: value => { error = value; },
  });
  await run('test');
  assert.equal(list[0].id, 'existing'); assert.equal(loading, false); assert.match(error, /not been removed/);
});

test('saved-list failures render an error instead of empty and Retry restores the list', async () => {
  for (const failedRead of [
    async () => ({ data: null, error: { message: 'offline' } }),
    async () => ({ data: null, error: null }),
    async () => { throw Error('Network failure'); },
  ]) {
    let finishRetry;
    const h = accountHarness([failedRead, () => new Promise(resolve => { finishRetry = resolve; })]);
    h.render(); await settle();
    const failed = h.render();
    assert.ok(failed.nodes.some(node => node.props?.role === 'alert'));
    assert.match(failed.text, /could not load your saved items/);
    assert.doesNotMatch(failed.text, /Nothing saved yet/);
    const retry = failed.nodes.find(node => node.type === 'button' && node.props.children === 'Retry saved items');
    assert.ok(retry, 'the error must offer a usable retry');
    retry.props.onClick();
    assert.match(h.render().text, /Loading your saved items/);
    assert.doesNotMatch(h.render().text, /Nothing saved yet/);
    finishRetry({ data: [{ id: 'saved', kind: 'car_search', title: 'My Fiesta search', data: { make: 'Ford', model: 'Fiesta' }, created_at: '2026-09-21T12:00:00Z' }], error: null });
    await settle();
    const restored = h.render();
    assert.match(restored.text, /My Fiesta search/);
    assert.doesNotMatch(restored.text, /could not load|Nothing saved yet|Loading your saved items/);
    assert.equal(h.readCount, 2);
  }
});

test('only a successful empty saved-list response renders Nothing saved yet', async () => {
  const h = accountHarness([async () => ({ data: [], error: null })]);
  h.render(); await settle();
  const empty = h.render();
  assert.match(empty.text, /Nothing saved yet/);
  assert.ok(!empty.nodes.some(node => node.props?.role === 'alert'));
});

test('a stale saved-list failure cannot replace a newer successful result', async () => {
  let rejectOlder, resolveNewer, list = [], error = '', loading = false, reads = 0;
  const responses = [new Promise((_resolve, reject) => { rejectOlder = reject; }), new Promise(resolve => { resolveNewer = resolve; })];
  const run = handler('loadItems', {
    getSupabaseBrowserClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ order: () => responses[reads++] }) }) }) }),
    activeUserId: { current: 'test' }, itemsRequest: { current: 0 }, setItems: value => { list = value; }, setItemsLoading: value => { loading = value; }, setItemsError: value => { error = value; },
  });
  const older = run('test'), newer = run('test');
  resolveNewer({ data: [{ id: 'newer' }], error: null }); await newer;
  rejectOlder(Error('Late network error')); await older;
  assert.equal(list[0].id, 'newer'); assert.equal(error, ''); assert.equal(loading, false);
});

test('data export never downloads an incomplete response and releases its action guard', async () => {
  let downloaded = false, message = '', busy = '';
  const guard = { current: false };
  const query = { select() { return this; }, eq() { return this; }, order() { return this; }, range: async () => ({ data: null, error: { message: 'offline' } }) };
  const run = handler('exportData', {
    getSupabaseBrowserClient: () => ({ from: () => query }), user: { id: 'test' }, accountVersion: { current: 0 }, actionRunning: guard,
    setBusyAction: value => { busy = value; }, setMessage: value => { message = value; },
    Blob, URL: { createObjectURL() { downloaded = true; return 'blob:test'; } },
  });
  await run();
  assert.equal(downloaded, false); assert.match(message, /no incomplete export/); assert.equal(guard.current, false); assert.equal(busy, '');
});

test('data export reads beyond the first database page before creating the download', async () => {
  const ranges = [], output = [];
  let downloads = 0;
  const run = handler('exportData', {
    getSupabaseBrowserClient: () => ({ from: table => ({ select() { return this; }, eq() { return this; }, order() { return this; }, async range(from, to) { ranges.push([table, from, to]); return { data: Array.from({ length: table === 'activity_events' && from === 0 ? 500 : 1 }, (_, i) => ({ id: from + i })), error: null }; } }) }),
    user: { id: 'test' }, accountVersion: { current: 0 }, actionRunning: { current: false }, setBusyAction() {}, setMessage() {},
    Blob: class { constructor(data) { output.push(JSON.parse(data[0])); } },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, document: { createElement: () => ({ click() { downloads++; } }) }, window: { setTimeout: fn => fn() },
  });
  await run();
  assert.equal(downloads, 1); assert.equal(output[0].activity.length, 501); assert.ok(ranges.some(([table, from]) => table === 'activity_events' && from === 500));
});

test('request deadlines release a stalled account action', async () => {
  await assert.rejects(helper.withRequestDeadline(new Promise(() => {}), 5), /timed out/);
});

const pendingCar = { kind: 'car_listing', title: 'Ford Fiesta listing', data: { id: '123456789012', version: 1, url: 'https://www.ebay.co.uk/itm/123456789012', searchUrl: '/?restore=1&mode=cars&make=Ford' } };
const row = (id, title = id) => ({ id, kind: 'car_search', title, data: { make: 'Ford' }, created_at: '2026-09-29T09:00:00Z' });
const button = (rendered, label) => rendered.nodes.find(node => node.type === 'button' && node.props.children === label);

test('account reads are explicitly scoped to the signed-in user and a switch immediately clears old items', async () => {
  let finishNewUser;
  const h = accountHarness([async () => ({ data: [row('old', 'Private previous account search')], error: null }), () => new Promise(resolve => { finishNewUser = resolve; })]);
  h.render(); await settle();
  assert.match(h.render().text, /Private previous account search/);
  h.switchUser({ id: 'second', email: 'second@example.test' });
  const switching = h.render();
  assert.doesNotMatch(switching.text, /Private previous account search/);
  assert.match(switching.text, /Loading your saved items/);
  finishNewUser({ data: [row('new', 'Second account search')], error: null }); await settle();
  assert.match(h.render().text, /Second account search/);
  assert.deepEqual(h.queriedUsers, ['test', 'second']);
});

test('a previous user response cannot replace the current account saved items', async () => {
  let finishOldUser;
  const h = accountHarness([() => new Promise(resolve => { finishOldUser = resolve; }), async () => ({ data: [row('new', 'Current account search')], error: null })]);
  h.render(); await settle();
  h.switchUser({ id: 'second', email: 'second@example.test' }); await settle();
  finishOldUser({ data: [row('old', 'Private previous account search')], error: null }); await settle();
  const current = h.render();
  assert.match(current.text, /Current account search/);
  assert.doesNotMatch(current.text, /Private previous account search/);
});

test('pending listing survives signup and email confirmation and needs an explicit signed-in save', async () => {
  const h = accountHarness([async () => ({ data: [], error: null })], { user: null, search: '?saveListing=pending-token', pendingToken: 'pending-token', pendingItem: pendingCar });
  h.render(); await settle();
  let current = h.render();
  assert.match(current.text, /Ford Fiesta listing/);
  assert.match(current.text, /confirm your email/);
  assert.equal(button(current, 'Save this car'), undefined);
  button(current, 'New to Mekivo? Create an account').props.onClick();
  current = h.render();
  await current.nodes.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(h.signups[0].options.emailRedirectTo, 'https://mekivo.uk/account?saveListing=pending-token');
  assert.equal(h.cleared.length, 0);
  h.switchUser({ id: 'created', email: 'created@example.test' }); await settle();
  current = h.render();
  assert.ok(button(current, 'Save this car'));
  assert.match(current.text, /created@example.test/);
  assert.equal(h.saved.length, 0, 'auth alone must never import a listing');
});

test('same-browser pending token recovery remains explicit and rejects a mismatched supplied token', async () => {
  const recovered = accountHarness([async () => ({ data: [], error: null })], { pendingToken: 'pending-token', pendingItem: pendingCar });
  recovered.render(); await settle();
  assert.ok(button(recovered.render(), 'Save this car'));
  assert.equal(recovered.saved.length, 0);
  const mismatch = accountHarness([async () => ({ data: [], error: null })], { search: '?saveListing=wrong-token', pendingToken: 'pending-token', pendingItem: pendingCar });
  mismatch.render(); await settle();
  assert.doesNotMatch(mismatch.render().text, /Ford Fiesta listing/);
  assert.match(mismatch.render().text, /no longer waiting/);
});

test('pending listing save failure keeps the selection and success clears it only after confirmation', async () => {
  let attempts = 0;
  const h = accountHarness([async () => ({ data: [], error: null }), async () => ({ data: [], error: null })], { pendingToken: 'pending-token', pendingItem: pendingCar, save: async () => { if (++attempts === 1) throw Error('offline'); return { id: 'saved', alreadySaved: true }; } });
  h.render(); await settle();
  await button(h.render(), 'Save this car').props.onClick();
  assert.match(h.render().text, /could not confirm this listing was saved/);
  assert.match(h.render().text, /Ford Fiesta listing/);
  assert.equal(h.cleared.length, 0);
  await button(h.render(), 'Save this car').props.onClick(); await settle();
  assert.match(h.render().text, /already saved to your account/);
  assert.doesNotMatch(h.render().text, /Ford Fiesta listing/);
  assert.deepEqual(h.cleared, ['pending-token']);
});

test('a save finishing after an account switch does not clear another user pending selection or show success', async () => {
  let finishSave;
  const h = accountHarness([async () => ({ data: [], error: null }), async () => ({ data: [], error: null })], { pendingToken: 'pending-token', pendingItem: pendingCar, save: () => new Promise(resolve => { finishSave = resolve; }) });
  h.render(); await settle();
  const saving = button(h.render(), 'Save this car').props.onClick();
  h.switchUser({ id: 'second', email: 'second@example.test' }); await settle();
  finishSave({ id: 'saved', alreadySaved: false }); await saving;
  assert.equal(h.cleared.length, 0);
  assert.match(h.render().text, /Ford Fiesta listing/);
  assert.doesNotMatch(h.render().text, /Listing saved to your account/);
  assert.equal(h.saved[0].userId, 'test');
});

test('removal scopes both the saved row and user and waits for a confirmed deleted row', async () => {
  const filters = [];
  let items = [row('saved')], message = '';
  const run = handler('remove', {
    getSupabaseBrowserClient: () => ({ from: () => ({ delete() { return this; }, eq(column, value) { filters.push([column, value]); return this; }, select: async () => ({ data: [], error: null }) }) }),
    user: { id: 'test' }, activeUserId: { current: 'test' }, accountVersion: { current: 0 }, actionRunning: { current: false }, setBusyAction() {}, setMessage: value => { message = value; }, setItems: updater => { items = updater(items); },
  });
  await run('saved');
  assert.deepEqual(filters, [['id', 'saved'], ['user_id', 'test']]);
  assert.equal(items.length, 1);
  assert.match(message, /could not confirm removal/);
});

test('saved items are paged so no more than twelve listing cards mount at once', async () => {
  const h = accountHarness([async () => ({ data: Array.from({ length: 13 }, (_, i) => ({ ...pendingCar, id: `row-${i}`, title: `Saved car number ${i}`, created_at: '2026-09-29T09:00:00Z' })), error: null })]);
  h.render(); await settle();
  assert.doesNotMatch(h.render().text, /Saved car number 12/);
  button(h.render(), 'Next →').props.onClick();
  assert.match(h.render().text, /Saved car number 12/);
  assert.doesNotMatch(h.render().text, /Saved car number 0/);
});

test('an expired or replaced browser selection cannot be saved from a stale open account page', async () => {
  const options = { pendingToken: 'pending-token', pendingItem: pendingCar };
  const h = accountHarness([async () => ({ data: [], error: null })], options);
  h.render(); await settle();
  const save = button(h.render(), 'Save this car');
  options.pendingItem = null;
  await save.props.onClick();
  assert.equal(h.saved.length, 0);
  assert.match(h.render().text, /selection has expired or changed/);
  assert.doesNotMatch(h.render().text, /Ford Fiesta listing/);
});

test('a late sign-in response cannot restore a previous account or release another account action', async () => {
  let finish;
  const version = { current: 0 }, activeUser = { current: null }, guard = { current: false };
  const updates = [], messages = [];
  const run = handler('submit', {
    getSupabaseBrowserClient: () => ({ auth: { signInWithPassword: () => new Promise(resolve => { finish = resolve; }) } }),
    accountVersion: version, activeUserId: activeUser, actionRunning: guard, returnUrl: null, pendingListing: null,
    email: 'first@example.test', password: 'test-only-password', isSignUp: false, URLSearchParams,
    setLoading() {}, setMessage: value => messages.push(value), updateAccount: user => updates.push(user),
  });
  const signingIn = run({ preventDefault() {} });
  version.current = 1; activeUser.current = 'second'; guard.current = true;
  finish({ data: { user: { id: 'first' }, session: {} }, error: null }); await signingIn;
  assert.deepEqual(updates, []);
  assert.deepEqual(messages, ['']);
  assert.equal(guard.current, true);
});
