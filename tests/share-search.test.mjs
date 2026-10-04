import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function load(path) {
  const exports = {};
  vm.runInNewContext(compile(path), { exports, URL, URLSearchParams });
  return exports;
}
const saved = load('../app/lib/saved-search.ts');
const search = load('../app/lib/search.ts');
const sharing = load('../app/lib/share-search.ts');
const car = changes => search.createCarSearch({ make: 'Ford', model: 'Fiesta', year: '2018', minPrice: '1500', price: '5000', postcode: 'SW1A 1AA', platform: 'all', sort: 'price_asc', hideUnwanted: true, ...changes }).saveItem;
const part = changes => search.createPartSearch({ make: 'Volkswagen', model: 'Golf', year: '2017', engine: '1.4L', fuel: 'Petrol', bodyStyle: 'Hatchback', part: 'Brake Pads', partCategory: 'Brakes', partNumber: '1K0 698 151 F', partMethod: 'search', ...changes }).saveItem;
const privateData = { postcode: 'SW1A 1AA', registration: 'AB12 CDE', registrationNumber: 'AB12 CDE', vin: 'WVWZZZ1KZAW123456', userId: 'private-account', itemId: 'private-listing', ownerEmail: 'owner@example.test', ownerToken: 'private-token', password: 'private-password', access_token: 'private-access', utm_source: 'meta', campid: 'private-campaign', customid: 'private-identifier', links: { ebay: 'https://www.ebay.co.uk/itm/private-id' } };

test('car sharing keeps only public criteria and the exact budget and filter choices', () => {
  const item = car();
  item.title = 'owner@example.test private-token';
  Object.assign(item.data, privateData, { engine: 'unrelated', partNumber: 'unrelated' });
  const before = JSON.stringify(item);
  const params = new URL(saved.getSharedSearchUrl(item), 'https://local.test').searchParams;
  assert.deepEqual([...params.keys()].sort(), ['restore', 'mode', 'make', 'model', 'year', 'price', 'min_price', 'sort', 'hide_unwanted', 'platform'].sort());
  const restored = saved.parseSavedSearchParams(params);
  assert.equal(restored.make, 'Ford'); assert.equal(restored.model, 'Fiesta'); assert.equal(restored.year, '2018');
  assert.equal(restored.price, '5000'); assert.equal(restored.minPrice, '1500'); assert.equal(restored.sort, 'price_asc');
  assert.equal(restored.hideUnwanted, true); assert.equal(restored.platform, 'all'); assert.equal(restored.postcode, '');
  assert.equal(JSON.stringify(item), before, 'sharing does not alter the account save or submitted search');
  assert.equal(new URL(saved.getSavedSearchUrl(item), 'https://local.test').searchParams.get('postcode'), 'SW1A 1AA', 'private account restoration still keeps its location');
  for (const value of Object.values(privateData).filter(value => typeof value === 'string')) assert.equal(saved.getSharedSearchUrl(item).includes(encodeURIComponent(value)), false, value);
});

test('vehicle-part sharing keeps exact catalogue context and OEM suffix without account or listing data', () => {
  const item = part(); Object.assign(item.data, privateData, { price: '5000', minPrice: '1500', platform: 'facebook' });
  const params = new URL(saved.getSharedSearchUrl(item), 'https://local.test').searchParams;
  assert.deepEqual([...params.keys()].sort(), ['restore', 'mode', 'make', 'model', 'year', 'engine', 'fuel', 'body_style', 'part', 'category', 'part_number', 'part_method', 'search_method'].sort());
  const restored = saved.parseSavedSearchParams(params);
  for (const key of ['make', 'model', 'year', 'engine', 'fuel', 'bodyStyle', 'part', 'partCategory', 'partNumber', 'partMethod']) assert.equal(restored[key], item.data[key], key);
  assert.equal(restored.searchMethod, 'vehicle'); assert.equal(restored.postcode, ''); assert.equal(restored.price, '');
});

test('direct part-number sharing clears stale vehicle details and retains the final suffix', () => {
  const item = part({ searchMethod: 'part_number' });
  item.data.searchMethod = 'part_number';
  const params = new URL(saved.getSharedSearchUrl(item), 'https://local.test').searchParams;
  assert.deepEqual([...params.keys()].sort(), ['restore', 'mode', 'part_number', 'part_method', 'search_method'].sort());
  const restored = saved.parseSavedSearchParams(params);
  assert.equal(restored.partNumber, '1K0 698 151 F'); assert.equal(restored.searchMethod, 'part_number');
  for (const key of ['make', 'model', 'year', 'engine', 'fuel', 'bodyStyle', 'part', 'partCategory']) assert.equal(restored[key], '', key);
});

test('share sanitization rejects private-looking free text, unsafe values and control characters', () => {
  for (const value of ['SW1A 1AA', 'AB12 CDE', 'WVWZZZ1KZAW123456', 'owner@example.test', 'https://example.test/?token=secret', 'Bearer private-token', 'password: private-password', 'sk-proj-private-token']) {
    const item = part({ model: value, partNumber: value });
    const restored = saved.parseSavedSearchParams(new URL(saved.getSharedSearchUrl(item), 'https://local.test').searchParams);
    assert.equal(restored.model, '', value); assert.equal(restored.partNumber, '', value);
  }
  const item = car({ make: '\u0000 Ford\n ', year: 'nonsense', minPrice: 'bad', sort: 'javascript:alert(1)', platform: 'javascript:alert(1)', hideUnwanted: false });
  item.data.model = { privateToken: 'secret' };
  const restored = saved.parseSavedSearchParams(new URL(saved.getSharedSearchUrl(item), 'https://local.test').searchParams);
  assert.equal(restored.make, 'Ford'); assert.equal(restored.model, ''); assert.equal(restored.year, '');
  assert.equal(restored.minPrice, undefined); assert.equal(restored.sort, undefined); assert.equal(restored.platform, 'all'); assert.equal(restored.hideUnwanted, false);
});

test('native sharing sends only the public link and generic brand title', async () => {
  const calls = [];
  assert.equal(await sharing.shareSearchLink('https://local.test/?restore=1', 'Mekivo car search', {
    async share(data) { calls.push(data); }, clipboard: { async writeText() { assert.fail('copy is not used after native success'); } },
  }), 'shared');
  assert.equal(calls.length, 1); assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { title: 'Mekivo car search', url: 'https://local.test/?restore=1' });
});

test('unsupported or denied native sharing falls back to copying the same link', async () => {
  for (const share of [undefined, async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); }]) {
    const copied = [];
    assert.equal(await sharing.shareSearchLink('https://local.test/?restore=1', 'Mekivo parts search', { share, clipboard: { async writeText(value) { copied.push(value); } } }), 'copied');
    assert.deepEqual(copied, ['https://local.test/?restore=1']);
  }
});

test('cancelling the native sheet neither copies nor reports a failure', async () => {
  assert.equal(await sharing.shareSearchLink('https://local.test/?restore=1', 'Mekivo car search', {
    async share() { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); },
    clipboard: { async writeText() { assert.fail('cancellation must not copy'); } },
  }), 'cancelled');
});

test('clipboard failures and missing support reject for a manual-copy fallback', async () => {
  for (const browser of [{}, { clipboard: { async writeText() { throw new Error('blocked'); } } }]) {
    await assert.rejects(sharing.shareSearchLink('https://local.test/?restore=1', 'Mekivo car search', browser));
  }
});

const nodes = (node, found = []) => {
  if (Array.isArray(node)) node.forEach(child => nodes(child, found));
  else if (node && typeof node === 'object') { found.push(node); nodes(node.props?.children, found); }
  return found;
};
const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
function buttonHarness(browser, item = car()) {
  const slots = []; let cursor = 0, currentItem = item;
  const exports = {};
  vm.runInNewContext(compile('../app/components/share-search-button.tsx'), {
    exports, URL, navigator: browser,
    window: { location: { origin: 'http://localhost:3000', search: '?analytics=off&utm_source=meta&ownerToken=private', hash: '#access_token=private' } },
    require(name) {
      if (name === 'react') return {
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
        useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
        useId() { return `share-status-${cursor++}`; },
      };
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === '../lib/saved-search') return saved;
      if (name === '../lib/share-search') return sharing;
      throw new Error(`Unexpected share dependency (including authentication, analytics or provider calls): ${name}`);
    },
  });
  const render = () => { cursor = 0; return exports.default({ item: currentItem }); };
  const one = predicate => nodes(render()).find(predicate);
  return { render, one, update(item) { currentItem = item; render(); }, button: () => one(node => node.type === 'button'), status: () => text(one(node => node.props?.role === 'status')) };
}

test('visible share control copies a clean local URL without sign-in, navigation or tracking', async () => {
  const copied = [], item = car(); Object.assign(item.data, privateData);
  const app = buttonHarness({ clipboard: { async writeText(value) { copied.push(value); } } }, item);
  assert.equal(text(app.button()), 'Share this search'); assert.equal(app.button().props.type, 'button');
  assert.match(app.button().props.className, /min-h-11/);
  assert.equal(app.button().props['aria-describedby'], app.one(node => node.props?.role === 'status').props.id);
  await app.button().props.onClick();
  assert.equal(app.status(), 'Search link copied.'); assert.equal(app.button().props.disabled, false);
  const url = new URL(copied[0]); assert.equal(url.origin, 'http://localhost:3000'); assert.equal(url.pathname, '/'); assert.equal(url.hash, '');
  for (const key of ['analytics', 'utm_source', 'ownerToken', 'postcode', 'registration', 'vin', 'userId', 'itemId']) assert.equal(url.searchParams.has(key), false, key);
});

test('rapid repeat activation opens only one share sheet, then allows another attempt after completion', async () => {
  let complete, calls = 0;
  const app = buttonHarness({ share() { calls++; return new Promise(resolve => { complete = resolve; }); } });
  const click = app.button().props.onClick;
  const pending = click();
  assert.equal(app.button().props.disabled, true); assert.equal(text(app.button()), 'Sharing…');
  await click(); assert.equal(calls, 1);
  complete(); await pending;
  assert.equal(app.status(), 'Search shared.'); assert.equal(app.button().props.disabled, false);
  const retry = app.button().props.onClick(); assert.equal(calls, 2); complete(); await retry;
});

test('a failed automatic copy reveals a selectable clean link and allows retry', async () => {
  let blocked = true, copies = 0;
  const app = buttonHarness({ clipboard: { async writeText() { copies++; if (blocked) throw new Error('blocked'); } } });
  await app.button().props.onClick();
  assert.match(app.status(), /Select and copy the link below/); assert.equal(app.button().props.disabled, false);
  const input = app.one(node => node.type === 'input'); assert.equal(input.props.readOnly, true);
  assert.equal(input.props['aria-label'], 'Search link to copy'); assert.equal(new URL(input.props.value).searchParams.has('postcode'), false);
  let selected = false; input.props.onFocus({ currentTarget: { select() { selected = true; } } }); assert.equal(selected, true);
  blocked = false; await app.button().props.onClick();
  assert.equal(copies, 2); assert.equal(app.status(), 'Search link copied.'); assert.equal(app.one(node => node.type === 'input'), undefined);
});

test('cancelled native sharing has clear feedback and remains ready for another attempt', async () => {
  const app = buttonHarness({ async share() { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); } });
  await app.button().props.onClick();
  assert.equal(app.status(), 'Sharing cancelled.'); assert.equal(app.button().props.disabled, false);
  assert.equal(app.one(node => node.type === 'input'), undefined);
});

test('changing criteria hides the previous manual link and feedback before sharing the new budget', async () => {
  const app = buttonHarness({});
  await app.button().props.onClick();
  const oldUrl = app.one(node => node.type === 'input').props.value;
  app.update(car({ price: '7500', sort: 'price_desc' }));
  assert.equal(app.one(node => node.type === 'input'), undefined);
  assert.equal(app.status(), 'Postcode and registration are excluded.');
  await app.button().props.onClick();
  const newUrl = app.one(node => node.type === 'input').props.value;
  assert.notEqual(newUrl, oldUrl); assert.equal(new URL(newUrl).searchParams.get('price'), '7500');
  assert.equal(new URL(newUrl).searchParams.get('sort'), 'price_desc');
});

test('an old in-flight failure cannot expose a stale link after criteria change or unlock a second native share', async () => {
  let fail, calls = 0;
  const app = buttonHarness({ share() { calls++; return new Promise((resolve, reject) => { fail = reject; }); } });
  const pending = app.button().props.onClick();
  app.update(car({ price: '7500', sort: 'price_desc' }));
  assert.equal(app.button().props.disabled, true);
  await app.button().props.onClick(); assert.equal(calls, 1);
  fail(new Error('denied')); await pending;
  assert.equal(app.one(node => node.type === 'input'), undefined);
  assert.equal(app.status(), 'Postcode and registration are excluded.'); assert.equal(app.button().props.disabled, false);
  const current = app.button().props.onClick(); assert.equal(calls, 2);
  fail(new Error('denied')); await current;
  assert.equal(new URL(app.one(node => node.type === 'input').props.value).searchParams.get('price'), '7500');
});

test('an old in-flight success does not claim that replacement search criteria were shared', async () => {
  let finish;
  const app = buttonHarness({ share() { return new Promise(resolve => { finish = resolve; }); } });
  const pending = app.button().props.onClick();
  app.update(car({ model: 'Focus' }));
  finish(); await pending;
  assert.equal(app.status(), 'Postcode and registration are excluded.'); assert.equal(app.button().props.disabled, false);
});
