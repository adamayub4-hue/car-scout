import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

const repo = fileURLToPath(new URL('../', import.meta.url));
const compile = path => ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const listing = { id: 'v1|123456789012|0', title: 'Ford Fiesta Brake Disc', url: 'https://www.ebay.co.uk/itm/123456789012', image: null, price: '25.99', currency: 'GBP', condition: 'New', location: 'GB', buyingOptions: ['FIXED_PRICE'] };
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
function walk(node, result = []) {
  if (Array.isArray(node)) node.forEach(child => walk(child, result));
  else if (node?.props) { result.push(node); walk(node.props.children, result); }
  return result;
}

function buttonHarness(options = {}) {
  let props = { item: listing, searchType: 'parts', searchUrl: '/?restore=1&mode=parts&part_number=W712%2F95' }, cursor = 0, slots = [], identity;
  const calls = { save: [], stage: [], navigate: [], normalize: [], auth: 0 };
  let user = options.signedOut ? null : { id: 'customer-one' };
  const listeners = new Set();
  const snapshot = { kind: 'part_listing', title: listing.title, data: { ...listing, version: 1 } };
  const client = { auth: {
    async getUser() { calls.auth++; return options.getUser ? options.getUser() : options.authResult ?? { data: { user }, error: null }; },
    onAuthStateChange(callback) {
      listeners.add(callback);
      if (options.initialAuth !== false) callback('INITIAL_SESSION', user ? { user } : null);
      return { data: { subscription: { unsubscribe() { listeners.delete(callback); } } } };
    },
  } };
  const hooks = {
    useState(initial) { const index = cursor++, currentSlots = slots; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { currentSlots[index] = value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(callback) { const index = cursor++; if (!(index in slots)) slots[index] = { effectCleanup: callback() }; },
  };
  const exports = {};
  vm.runInNewContext(compile(resolve(repo, 'app/components/save-listing-button.tsx')), {
    exports, encodeURIComponent,
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'next/link') return { default: 'a' };
      if (name === 'next/navigation') return { useRouter: () => ({ push: url => calls.navigate.push(url) }) };
      if (name === '../lib/supabase') return { getSupabaseBrowserClient: () => options.unconfigured ? null : client };
      if (name === '../lib/saved-search') return { withRequestDeadline: request => request };
      if (name === '../lib/saved-listings') return {
        createSavedListing(...args) { calls.normalize.push(args); return options.invalid ? null : snapshot; },
        stagePendingListing(item) { calls.stage.push(item); return options.storageBlocked ? null : 'safe-token'; },
        async saveListingToAccount(...args) { calls.save.push(args); return options.save ? options.save(...args) : { id: 'stored-id', alreadySaved: false }; },
      };
      throw new Error(`Unexpected save dependency ${name}`);
    },
  });
  function render() {
    const keyed = exports.default(props);
    if (keyed.key !== identity) { slots.forEach(slot => slot?.effectCleanup?.()); slots = []; identity = keyed.key; }
    cursor = 0;
    return keyed.type(keyed.props);
  }
  return {
    calls, client, snapshot, render,
    nodes: () => walk(render()),
    button: () => walk(render()).find(node => node.type === 'button'),
    text: () => text(render()),
    click() { this.button().props.onClick(); },
    update(next) { props = { ...props, ...next }; render(); },
    auth(userId, event = userId ? 'SIGNED_IN' : 'SIGNED_OUT') {
      user = userId ? { id: userId } : null;
      listeners.forEach(callback => callback(event, user ? { user } : null));
      render();
    },
  };
}

test('a listing save waits for persistence, prevents double submit, then links to saved items', async () => {
  const pending = deferred(), app = buttonHarness({ save: () => pending.promise });
  assert.equal(text(app.button()), 'Save part');
  const originalHandler = app.button().props.onClick;
  originalHandler(); originalHandler();
  await flush();
  assert.equal(app.calls.auth, 1);
  assert.equal(app.calls.save.length, 1);
  assert.equal(app.button().props.disabled, true);
  assert.match(app.text(), /Saving…/);
  assert.doesNotMatch(app.text(), /Saved to your account/);
  assert.equal(app.calls.save[0][0], app.client);
  assert.equal(app.calls.save[0][1], 'customer-one');
  assert.equal(app.calls.save[0][2], app.snapshot);
  pending.resolve({ id: 'confirmed', alreadySaved: false }); await flush();
  assert.match(app.text(), /✓ Saved part/);
  assert.equal(app.button().props.disabled, true);
  assert.equal(app.nodes().find(node => node.type === 'a').props.href, '/account');
  app.click(); await flush();
  assert.equal(app.calls.save.length, 1);
});

test('failed or timed-out persistence shows retry without claiming success', async () => {
  let attempts = 0;
  const app = buttonHarness({ save: async () => { if (++attempts === 1) throw new Error('Request timed out'); return { id: 'existing', alreadySaved: true }; } });
  app.click(); await flush();
  assert.equal(text(app.button()), 'Retry saving');
  assert.match(app.nodes().find(node => node.props.role === 'alert').props.children, /could not confirm/);
  assert.doesNotMatch(app.text(), /Saved to your account/);
  app.click(); await flush();
  assert.match(app.text(), /Saved to your account/);
  assert.equal(attempts, 2);
});

test('signed-out customers keep the selected snapshot before routing to sign-in', async () => {
  const app = buttonHarness({ signedOut: true });
  app.click(); await flush();
  assert.equal(app.calls.save.length, 0);
  assert.equal(app.calls.stage[0], app.snapshot);
  assert.deepEqual(app.calls.navigate, ['/account?saveListing=safe-token']);
  assert.equal(app.calls.normalize[0][0], listing);
  assert.equal(app.calls.normalize[0][1], 'parts');
  assert.equal(app.calls.normalize[0][2], '/?restore=1&mode=parts&part_number=W712%2F95');
  assert.doesNotMatch(app.text(), /Saved to your account/);
});

test('blocked storage and failed authentication keep a visible retry and do not navigate or save', async () => {
  for (const options of [
    { signedOut: true, storageBlocked: true },
    { authResult: { data: { user: null }, error: { name: 'NetworkError' } } },
    { invalid: true },
    { unconfigured: true },
  ]) {
    const app = buttonHarness(options); app.click(); await flush();
    assert.equal(app.calls.save.length, 0);
    assert.equal(app.calls.navigate.length, 0);
    assert.equal(text(app.button()), 'Retry saving');
    assert.equal(app.nodes().filter(node => node.props.role === 'alert').length, 1);
    assert.doesNotMatch(app.text(), /Saved to your account/);
  }
});

test('a late save cannot mark a replacement listing or search type as saved', async () => {
  const pending = deferred(), app = buttonHarness({ save: () => pending.promise });
  app.click(); await flush();
  app.update({ item: { ...listing, id: 'replacement', url: 'https://www.ebay.co.uk/itm/123456789099' } });
  assert.equal(text(app.button()), 'Save part');
  pending.resolve({ id: 'old', alreadySaved: false }); await flush();
  assert.equal(text(app.button()), 'Save part');
  assert.equal(app.button().props.disabled, false);
  app.update({ searchType: 'cars' });
  assert.equal(text(app.button()), 'Save car');
});

test('same-account auth events preserve confirmed saves while sign-out or account switches reset them', async () => {
  const app = buttonHarness();
  app.click(); await flush();
  assert.equal(text(app.button()), '✓ Saved part');
  app.auth('customer-one', 'TOKEN_REFRESHED');
  app.auth('customer-one', 'SIGNED_IN');
  assert.equal(text(app.button()), '✓ Saved part');
  assert.equal(app.button().props.disabled, true);
  app.auth(null);
  assert.equal(text(app.button()), 'Save part');
  assert.equal(app.button().props.disabled, false);
  assert.doesNotMatch(app.text(), /Saved to your account/);
  app.auth('customer-two');
  app.click(); await flush();
  assert.equal(app.calls.save.at(-1)[1], 'customer-two');
  assert.equal(text(app.button()), '✓ Saved part');
  app.auth('customer-one');
  assert.equal(text(app.button()), 'Save part');
});

test('a late prior-account save cannot overwrite or unlock a new account save', async () => {
  const first = deferred(), second = deferred();
  const app = buttonHarness({ save: (_client, userId) => userId === 'customer-one' ? first.promise : second.promise });
  app.click(); await flush();
  app.auth('customer-two');
  assert.equal(text(app.button()), 'Save part');
  app.click(); await flush();
  assert.equal(app.calls.save.length, 2);
  first.resolve({ id: 'first-account-row', alreadySaved: false }); await flush();
  assert.equal(text(app.button()), 'Saving…');
  assert.equal(app.button().props.disabled, true);
  app.click(); await flush();
  assert.equal(app.calls.save.length, 2, 'stale completion cannot release the new request guard');
  second.resolve({ id: 'second-account-row', alreadySaved: false }); await flush();
  assert.equal(text(app.button()), '✓ Saved part');
});

test('late prior-account authentication and save failures cannot mutate the switched account', async () => {
  const authLookup = deferred(), authApp = buttonHarness({ getUser: () => authLookup.promise });
  authApp.click(); await flush(); authApp.auth('customer-two');
  authLookup.resolve({ data: { user: { id: 'customer-one' } }, error: null }); await flush();
  assert.equal(authApp.calls.save.length, 0);
  assert.equal(text(authApp.button()), 'Save part');
  const save = deferred(), app = buttonHarness({ save: () => save.promise });
  app.click(); await flush(); app.auth(null);
  save.reject(new Error('Previous account request failed')); await flush();
  assert.equal(text(app.button()), 'Save part');
  assert.equal(app.nodes().filter(node => node.props.role === 'alert').length, 0);
});

test('late initial-session discovery agrees with the verified save account without clearing success', async () => {
  const app = buttonHarness({ initialAuth: false });
  app.click(); await flush();
  assert.equal(text(app.button()), '✓ Saved part');
  app.auth('customer-one', 'INITIAL_SESSION');
  assert.equal(text(app.button()), '✓ Saved part');
  const pendingAuth = deferred(), switched = buttonHarness({ initialAuth: false, getUser: () => pendingAuth.promise });
  switched.click(); await flush();
  switched.auth('customer-two', 'INITIAL_SESSION');
  pendingAuth.resolve({ data: { user: { id: 'customer-one' } }, error: null }); await flush();
  assert.equal(switched.calls.save.length, 0);
  assert.equal(text(switched.button()), 'Save part');
});

test('save controls are siblings of affiliate links on live and shortlisted car/part cards', () => {
  const modules = new Map(), Save = () => null;
  function load(file) {
    let path = resolve(repo, file);
    if (!existsSync(path)) path += existsSync(`${path}.ts`) ? '.ts' : '.tsx';
    if (modules.has(path)) return modules.get(path);
    const exports = {}; modules.set(path, exports);
    vm.runInNewContext(compile(path), { exports, URL, URLSearchParams, Date,
      require(name) {
        if (name === 'react') return { useState: initial => [initial, () => {}], useRef: initial => ({ current: initial }) };
        if (name === 'react/jsx-runtime') return jsxRuntime;
        if (name === 'next/image') return { default: 'img' };
        if (name === './save-listing-button') return { default: Save };
        if (name.endsWith('/growth-events')) return { trackGrowthEvent() {} };
        if (name.startsWith('.')) return load(resolve(dirname(path), name));
        throw new Error(`Unexpected card dependency ${name}`);
      },
    });
    return exports;
  }
  const { createCarSearch, createPartSearch } = load('app/lib/search.ts');
  const carSearch = createCarSearch({ make: 'Ford', model: 'Fiesta', year: '2018', price: '5000', postcode: '', platform: 'all' });
  const partSearch = createPartSearch({ make: 'Ford', model: 'Fiesta', year: '2018', engine: '', fuel: '', bodyStyle: '', part: 'Brake Disc', partNumber: '', partCategory: '', partMethod: 'search' });
  const car = { ...listing, title: '2018 Ford Fiesta 1.0 car', price: '4000', condition: 'Used' };
  const candidates = [
    ['ebay-results', { items: [car], loading: false, error: '', fallbackUrl: carSearch.fallbackUrl, searchType: 'cars', onRetry() {} }, 'cars', 'mekivo-cars-live'],
    ['ebay-results', { items: [listing], loading: false, error: '', fallbackUrl: partSearch.fallbackUrl, searchType: 'parts', onRetry() {} }, 'parts', 'mekivo-parts-live'],
    ['car-recommendations', { items: [car], search: carSearch, loading: false, error: '', compact: true }, 'cars', 'mekivo-cars-shortlist'],
    ['part-recommendations', { items: [listing], search: partSearch, loading: false, error: '' }, 'parts', 'mekivo-parts-shortlist'],
  ];
  for (const [name, props, mode, customid] of candidates) {
    const tree = load(`app/components/${name}.tsx`).default(props);
    const cards = walk(tree).filter(node => node.type === 'article');
    assert.equal(cards.length, 1, name);
    const children = cards[0].props.children;
    assert.equal(children[0].type, 'a', name);
    assert.equal(children[1].type, Save, name);
    assert.equal(children[1].props.searchType, mode);
    assert.equal(children[1].props.item.id, listing.id);
    assert.equal(walk(children[0]).filter(node => node.type === Save).length, 0);
    const url = new URL(children[0].props.href);
    assert.equal(url.searchParams.get('campid'), '5339201924');
    assert.equal(url.searchParams.get('customid'), customid);
    assert.equal(children[0].props.rel, 'sponsored noreferrer');
  }
});
