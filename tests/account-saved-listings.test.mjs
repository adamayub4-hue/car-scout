import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/components/saved-listing-card.tsx', import.meta.url), 'utf8');
const component = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const url = 'https://www.ebay.co.uk/itm/123456789012';
const bookmark = { kind: 'part_listing', title: 'My Ford brake search', data: { version: 1, id: '123456789012', url, searchUrl: '/?restore=1&mode=parts&part=Brake' } };
const fresh = { id: '123456789012', title: 'Current eBay brake listing', url, price: '29.00', currency: 'GBP', image: 'https://i.ebayimg.com/images/test.jpg', condition: 'New', location: 'London', postage: { price: '3.00', currency: 'GBP' } };
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const response = (body, ok = true) => ({ ok, json: async () => body });

function harness(reads, props = {}) {
  const slots = [], effectSlots = [], queue = [], exports = {}, requests = [], events = [], timers = new Map();
  let cursor = 0, timerId = 0, readIndex = 0;
  let currentProps = { item: bookmark, savedAt: '2026-09-29T09:00:00Z', userId: 'first', ...props };
  const jsx = (type, props) => ({ type, props });
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useEffect(callback, deps) { const i = cursor++; const previous = effectSlots[i]; if (!previous || deps.some((value, index) => value !== previous.deps[index])) { queue.push(() => { previous?.cleanup?.(); effectSlots[i] = { deps, cleanup: callback() }; }); } },
  };
  vm.runInNewContext(component, {
    exports, AbortController, Date, encodeURIComponent,
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; }, clearTimeout(id) { timers.delete(id); },
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    fetch: (path, options) => { requests.push({ path, options }); return reads[readIndex++](); },
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/link') return { default: 'link' };
      if (name === 'next/image') return { default: 'image' };
      if (name === '../lib/search') return { formatListingPrice: (price, currency) => price ? `${currency} ${price}` : 'Price unavailable', withEbayAffiliateTracking: value => value };
      if (name === '../lib/saved-search') return { withRequestDeadline: value => Promise.resolve(value) };
      if (name === '../lib/supabase') return { getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'session-token', user: { id: currentProps.userId } } }, error: null }) } }) };
      if (name === '../lib/saved-listings') return { createSavedListing: (item, mode, searchUrl) => item?.url && item?.id ? ({ kind: mode === 'cars' ? 'car_listing' : 'part_listing', title: item.title, data: { ...item, searchUrl } }) : null };
      if (name === '../lib/part-recommendations') return { partPostageLabel: item => item.postage ? `Postage ${item.postage.currency} ${item.postage.price}` : 'Check postage on eBay' };
      if (name === '../lib/growth-events') return { trackGrowthEvent: (...args) => events.push(args) };
      throw Error(name);
    },
  });
  const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : [node?.props?.children].flat(Infinity).map(child => child ? text(child) : '').join(' ');
  return {
    render(next = {}) { currentProps = { ...currentProps, ...next }; cursor = 0; const tree = exports.default(currentProps); queue.splice(0).forEach(run => run()); return { text: text(tree), nodes: nodes(tree) }; },
    requests, events, timers,
    unmount() { effectSlots.forEach(effect => effect?.cleanup?.()); },
  };
}

test('saved bookmark shows fresh authenticated price, condition, photo and check time without recording a visit event', async () => {
  const h = harness([async () => response({ item: fresh, checkedAt: new Date().toISOString() })]);
  assert.doesNotMatch(h.render().text, /29.00/);
  await settle();
  const ready = h.render();
  assert.match(ready.text, /Current eBay brake listing/);
  assert.match(ready.text, /GBP 29.00/);
  assert.match(ready.text, /Latest checked price/);
  assert.match(ready.text, /Checked/);
  assert.match(ready.text, /Postage GBP 3.00/);
  assert.match(ready.text, /New · London/);
  assert.match(ready.text, /Prices and availability can change/);
  assert.equal(ready.nodes.find(node => node.type === 'image').props.src, fresh.image);
  assert.equal(h.requests[0].options.headers.Authorization, 'Bearer session-token');
  assert.equal(h.requests[0].options.cache, 'no-store');
  assert.equal(h.events.length, 0);
  ready.nodes.find(node => node.type === 'a').props.onClick();
  assert.equal(h.events[0][0], 'marketplace_outbound');
  assert.equal(h.events[0][1].destination, 'listing');
  h.unmount();
});

test('unavailable or failed checks keep the saved link and fallback search without displaying old stored provider details', async () => {
  for (const result of [response({ item: null, unavailable: true, checkedAt: new Date().toISOString() }), response({}, false)]) {
    const oldSnapshot = { ...bookmark, data: { ...bookmark.data, price: '9999.00', image: fresh.image, condition: 'Old provider condition' } };
    const h = harness([async () => result], { item: oldSnapshot });
    h.render(); await settle();
    const current = h.render();
    assert.doesNotMatch(current.text, /9999|Old provider condition/);
    assert.equal(current.nodes.some(node => node.type === 'image'), false);
    assert.equal(current.nodes.find(node => node.type === 'a').props.href, url);
    assert.equal(current.nodes.find(node => node.type === 'link').props.href, bookmark.data.searchUrl);
    assert.ok(current.nodes.find(node => node.type === 'button' && node.props.children === 'Check listing again'));
    h.unmount();
  }
});

test('retry replaces a failed details check with a verified current listing', async () => {
  const h = harness([async () => response({}, false), async () => response({ item: fresh, checkedAt: new Date().toISOString() })]);
  h.render(); await settle();
  const failed = h.render();
  failed.nodes.find(node => node.type === 'button').props.onClick();
  assert.match(h.render().text, /Checking the latest listing details/);
  await settle();
  assert.match(h.render().text, /GBP 29.00/);
  assert.equal(h.requests.length, 2);
  h.unmount();
});

test('details from an old account never appear after props switch users or complete late', async () => {
  let finishOld;
  const h = harness([() => new Promise(resolve => { finishOld = resolve; }), async () => response({ item: null, unavailable: true })]);
  h.render(); await settle();
  h.render({ userId: 'second' }); await settle();
  finishOld(response({ item: fresh, checkedAt: new Date().toISOString() })); await settle();
  const current = h.render();
  assert.doesNotMatch(current.text, /GBP 29.00|Current eBay brake listing/);
  assert.match(current.text, /no longer available/);
  h.unmount();
});

test('six-hour expiry hides provider details before retrying and rejects stale API responses', async () => {
  const staleTime = new Date(Date.now() - 6 * 60 * 60 * 1000 - 1).toISOString();
  const stale = harness([async () => response({ item: fresh, checkedAt: staleTime })]);
  stale.render(); await settle();
  assert.doesNotMatch(stale.render().text, /GBP 29.00/);
  assert.match(stale.render().text, /could not check/);
  stale.unmount();
  const h = harness([async () => response({ item: fresh, checkedAt: new Date().toISOString() }), () => new Promise(() => {})]);
  h.render(); await settle(); h.render();
  const timer = [...h.timers.values()][0];
  assert.ok(timer.delay <= 6 * 60 * 60 * 1000);
  timer.callback();
  assert.doesNotMatch(h.render().text, /GBP 29.00/);
  await settle();
  assert.equal(h.requests.length, 2);
  h.unmount();
});

test('an unsigned pending card does not fetch protected details or save on its own', async () => {
  const item = { ...bookmark, title: fresh.title, data: { ...bookmark.data, ...fresh } };
  const h = harness([], { item, savedAt: undefined, userId: undefined });
  assert.match(h.render().text, /GBP 29.00/);
  await settle();
  assert.equal(h.requests.length, 0);
  assert.equal(h.events.length, 0);
  h.unmount();
});
