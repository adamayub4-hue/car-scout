import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const searchHelpers = {};
vm.runInNewContext(compile('../app/lib/search.ts'), { exports: searchHelpers, URL, URLSearchParams });
const savedSearchHelpers = {};
vm.runInNewContext(compile('../app/lib/saved-search.ts'), { exports: savedSearchHelpers, URL, URLSearchParams });
const Save = () => null;
const Share = () => null;
const LiveListings = () => null;
const PricePicks = () => null;
const PartPricePicks = () => null;

function nodes(node, found = []) {
  if (Array.isArray(node)) node.forEach(child => nodes(child, found));
  else if (node && typeof node === 'object') {
    found.push(node);
    nodes(node.props?.children, found);
  }
  return found;
}
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';

// Execute actual event handlers and hook transitions, committing host refs before
// effects. Native key dispatch, CSS layout and scrolling remain browser QA work.
function component(path, initialProps) {
  let cursor = 0, dirty = true, tree, props = initialProps;
  const slots = [], effects = new Map(), pendingEffects = [], events = [], focus = [], scrolls = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value;
        if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useId() { return `test-id-${cursor++}`; },
    useEffect(callback, dependencies) {
      const index = cursor++, previous = effects.get(index);
      if (!previous || !dependencies || dependencies.some((value, i) => !Object.is(value, previous.dependencies?.[i]))) {
        effects.set(index, { dependencies, cleanup: undefined });
        pendingEffects.push(() => {
          previous?.cleanup?.();
          effects.get(index).cleanup = callback();
        });
      }
    },
  };
  const exports = {};
  vm.runInNewContext(compile(path), {
    exports, URL, URLSearchParams,
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'next/image') return { default: 'img' };
      if (name === '../lib/search') return searchHelpers;
      if (name === '../lib/saved-search') return savedSearchHelpers;
      if (name === '../lib/growth-events') return { trackGrowthEvent: (...args) => events.push(args) };
      if (name === './save-button') return { default: Save };
      if (name === './share-search-button') return { default: Share };
      if (name === './ebay-results') return { default: LiveListings };
      if (name === './save-listing-button') return { default: () => null };
      if (name === './car-recommendations') return { default: PricePicks };
      if (name === './part-recommendations') return { default: PartPricePicks };
      if (name === '../lib/part-recommendations') return { partPostageLabel: () => 'Postage: check on eBay' };
      throw Error(`Unexpected result-view dependency: ${name}`);
    },
  });
  function host(node) {
    return {
      focus(options) { focus.push({ label: text(node), id: node.props.id, options }); },
      scrollIntoView(options) { scrolls.push({ label: text(node), options }); },
      querySelectorAll() { return nodes(tree).filter(child => child.props?.role === 'tab').map(host); },
    };
  }
  function render() {
    for (let attempt = 0; dirty; attempt++) {
      assert.ok(attempt < 12, 'result view settles after state changes');
      cursor = 0; dirty = false; tree = exports.default(props);
      for (const node of nodes(tree)) if (typeof node.type === 'string' && node.props.ref) {
        if (typeof node.props.ref === 'function') node.props.ref(host(node));
        else node.props.ref.current = host(node);
      }
      pendingEffects.splice(0).forEach(effect => effect());
    }
    return tree;
  }
  function one(predicate) {
    const found = nodes(render()).filter(predicate);
    assert.equal(found.length, 1, 'expected one matching result control');
    return found[0];
  }
  render();
  return {
    events, focus, scrolls, render, one,
    nodes: () => nodes(render()), text: () => text(render()),
    update(next) { props = { ...props, ...next }; dirty = true; render(); },
    click(node) { assert.notEqual(node.props.disabled, true, 'cannot click a disabled control'); node.props.onClick(); render(); },
    key(node, key) {
      let prevented = false;
      node.props.onKeyDown({ key, preventDefault() { prevented = true; }, currentTarget: { ...host(node), parentElement: host(node) } });
      render();
      return prevented;
    },
    button(label) { return one(node => node.type === 'button' && text(node) === label); },
  };
}

const carSearch = changes => searchHelpers.createCarSearch({
  make: 'Ford', model: 'Fiesta', year: '2018', price: '5000', postcode: 'SW1A 1AA', platform: 'all', ...changes,
});
const car = index => ({
  id: `v1|${123456789000 + index}|0`, title: `2018 Ford Fiesta listing ${index}`,
  url: `https://www.ebay.co.uk/itm/${123456789000 + index}`, image: null,
  price: String(3000 + index), currency: 'GBP', condition: 'Used', location: 'GB',
  buyingOptions: ['FIXED_PRICE'], itemEndDate: null,
});
const cars = count => Array.from({ length: count }, (_, index) => car(index + 1));

function results(overrides = {}) {
  const calls = { edit: 0, retry: 0 };
  const props = { search: carSearch(), items: cars(12), loading: false, error: '',
    onEdit() { calls.edit++; }, onRetry() { calls.retry++; }, ...overrides };
  return { ...component('../app/components/car-search-results.tsx', props), calls, props };
}
const tabs = app => app.nodes().filter(node => node.props?.role === 'tab');
const selectedTab = app => app.one(node => node.props?.role === 'tab' && node.props['aria-selected']);
const activePanel = app => app.one(node => node.props?.role === 'tabpanel' && !node.props.hidden);

function assertTabWiring(app, label) {
  const selected = selectedTab(app), panel = activePanel(app);
  assert.equal(text(selected), label);
  assert.equal(selected.props.tabIndex, 0);
  assert.equal(panel.props.id, selected.props['aria-controls']);
  assert.equal(panel.props['aria-labelledby'], selected.props.id);
  assert.equal(panel.props.tabIndex, 0);
  for (const tab of tabs(app)) {
    assert.equal(tab.type, 'button');
    assert.equal(tab.props.type, 'button');
    assert.equal(tab.props.tabIndex, tab === selected ? 0 : -1);
    assert.ok(app.nodes().some(node => node.props?.id === tab.props['aria-controls']), 'each tab owns an existing panel');
  }
}

test('clicking views exposes exactly one panel and preserves the live and price components', () => {
  const app = results();
  assert.deepEqual(tabs(app).map(text), ['Live cars', 'Price picks', 'Other sites']);
  assertTabWiring(app, 'Live cars');
  assert.ok(nodes(activePanel(app)).some(node => node.type === LiveListings));
  app.click(app.button('Price picks'));
  assertTabWiring(app, 'Price picks');
  const shortlist = nodes(activePanel(app)).find(node => node.type === PricePicks);
  assert.equal(shortlist.props.search, app.props.search);
  assert.equal(shortlist.props.items, app.props.items);
  app.click(app.button('Other sites'));
  assertTabWiring(app, 'Other sites');
  assert.equal(nodes(activePanel(app)).filter(node => node.type === 'a').length, 8);
  app.click(app.button('Live cars'));
  assertTabWiring(app, 'Live cars');
  assert.deepEqual(app.events, [], 'view navigation is neither a search nor an outbound click');
});

test('car and part result toolbars expose sharing of the submitted snapshot without activity events', () => {
  const carApp = results();
  assert.equal(carApp.one(node => node.type === Share).props.item, carApp.props.search.saveItem);
  carApp.click(carApp.button('Other sites'));
  assert.equal(carApp.one(node => node.type === Share).props.item, carApp.props.search.saveItem);
  const partSearch = searchHelpers.createPartSearch({ make: '', model: '', year: '', engine: '', fuel: '', bodyStyle: '', part: '', partCategory: '', partNumber: '1K0 698 151 F', partMethod: 'search' }, true);
  const partApp = component('../app/components/part-search-results.tsx', { search: partSearch, items: [], loading: false, error: '', onRetry() {}, onEdit() {} });
  assert.equal(partApp.one(node => node.type === Share).props.item, partSearch.saveItem);
  assert.deepEqual(carApp.events, []); assert.deepEqual(partApp.events, []);
});

test('arrow, Home and End keys move selection and focus with wrapping and one tab stop', () => {
  const app = results();
  for (const [key, expected] of [
    ['ArrowRight', 'Price picks'], ['ArrowRight', 'Other sites'], ['ArrowRight', 'Live cars'],
    ['ArrowLeft', 'Other sites'], ['Home', 'Live cars'], ['End', 'Other sites'],
  ]) {
    assert.equal(app.key(selectedTab(app), key), true, `${key} prevents browser scrolling`);
    assertTabWiring(app, expected);
    assert.equal(app.focus.at(-1).label, expected);
  }
  const focusCount = app.focus.length;
  assert.equal(app.key(selectedTab(app), 'Tab'), false, 'native Tab navigation is not trapped');
  assert.equal(app.focus.length, focusCount);
  assertTabWiring(app, 'Other sites');
  assert.deepEqual(app.events, []);
});

test('summary, saved item and outbound URLs retain the submitted criteria while navigating and retrying', () => {
  const fields = { make: 'Ford', model: 'Fiesta', year: '2018', price: '5000', postcode: 'SW1A 1AA', platform: 'all' };
  const submitted = searchHelpers.createCarSearch(fields), before = JSON.stringify(submitted);
  const app = results({ search: submitted });
  fields.make = 'Audi'; fields.price = '20000'; fields.postcode = 'B1 1AA';
  for (const label of ['Price picks', 'Other sites', 'Live cars']) app.click(app.button(label));
  assert.ok(app.text().includes('2018 Ford Fiesta'));
  assert.ok(app.text().includes('Up to £5,000'));
  assert.ok(app.text().includes('SW1A 1AA'));
  assert.ok(!app.text().includes('Audi'));
  assert.equal(app.one(node => node.type === Save).props.item, submitted.saveItem);
  const live = app.one(node => node.type === LiveListings);
  assert.equal(live.props.fallbackUrl, submitted.fallbackUrl);
  live.props.onRetry();
  assert.equal(app.calls.retry, 1);
  app.click(app.button('Other sites'));
  const trader = app.one(node => node.type === 'a' && node.props.href === submitted.carLinks.autotrader);
  const url = new URL(trader.props.href);
  assert.equal(url.searchParams.get('make'), 'Ford');
  assert.equal(url.searchParams.get('price-to'), '5000');
  assert.equal(url.searchParams.get('postcode'), 'SW1A 1AA');
  app.click(app.button('Edit search'));
  assert.equal(app.calls.edit, 1);
  assert.equal(JSON.stringify(submitted), before, 'browsing does not mutate the submitted search');
  assert.deepEqual(app.events, []);
});

test('result sorting is reachable in the live view and reflects the submitted budget without tracking a click-out', () => {
  const changes = [];
  const submitted = carSearch({ minPrice: '1500', price: '5000', sort: 'price_asc', hideUnwanted: true });
  const app = results({ search: submitted, onSortChange: value => changes.push(value) });
  assert.match(app.text(), /£1,500–£5,000/);
  const select = app.one(node => node.type === 'select');
  assert.equal(select.props.value, 'price_asc');
  assert.deepEqual(nodes(select).filter(node => node.type === 'option').map(node => node.props.value), ['price_asc', 'price_desc', 'newest', 'best_match']);
  select.props.onChange({ target: { value: 'newest' } });
  assert.deepEqual(changes, ['newest']);
  assert.equal(app.props.search, submitted, 'the parent commits the requested refinement');
  assert.deepEqual(app.events, []);
  app.click(app.button('Other sites'));
  assert.equal(nodes(activePanel(app)).some(node => node.type === 'select'), false, 'live-only sort is not presented as a filter for other providers');
});

test('checked-listing metadata discloses the actual batch count and possible remaining listings', () => {
  const app = results({ searchInfo: { checkedCount: 144, pagesChecked: 3, hasMore: true, partial: false } });
  assert.match(text(activePanel(app)), /144 eBay listings checked across 3 batches/);
  assert.match(text(activePanel(app)), /More listings may be available on eBay/);
  assert.doesNotMatch(text(activePanel(app)), /Up to 192/);
  app.update({ searchInfo: { checkedCount: 17, pagesChecked: 1, hasMore: false, partial: false } });
  assert.match(text(activePanel(app)), /17 eBay listings checked across 1 batch\./);
  assert.doesNotMatch(text(activePanel(app)), /More listings may be available/);
  app.update({ searchInfo: null });
  assert.match(text(activePanel(app)), /Up to 192 eBay listings located in the UK checked per search, returning up to 48 matches/);
  assert.doesNotMatch(text(activePanel(app)), /17 eBay listings checked/);
});

test('partial searches retain the successfully returned cars with an accessible notice and retry', () => {
  const items = cars(8);
  const app = results({ items, searchInfo: { checkedCount: 96, pagesChecked: 2, hasMore: true, partial: true } });
  const notice = app.one(node => node.props?.role === 'status');
  assert.match(text(notice), /eBay stopped responding before this search finished/);
  assert.match(text(notice), /These cars were returned successfully/);
  assert.equal(app.one(node => node.type === LiveListings).props.items, items);
  assert.equal(app.one(node => node.type === LiveListings).props.error, '');
  app.click(app.button('Try again for more'));
  assert.equal(app.calls.retry, 1);
  assert.deepEqual(app.events, [], 'retry is not an outbound marketplace click');
});

test('partial searches without matches provide retry without claiming that cars were found', () => {
  const app = results({ items: [], searchInfo: { checkedCount: 96, pagesChecked: 2, hasMore: true, partial: true } });
  const notice = app.one(node => node.props?.role === 'status');
  assert.match(text(notice), /eBay stopped responding/);
  assert.doesNotMatch(text(notice), /These cars were returned successfully/);
  assert.match(text(activePanel(app)), /No cars remain in the checked results/);
  app.click(app.button('Try again for more'));
  assert.equal(app.calls.retry, 1);
});

test('visible car counts use singular wording and explain Next only when another page exists', () => {
  for (const count of [1, 3, 4, 12]) {
    const app = results({ items: cars(count) });
    const panel = text(activePanel(app));
    assert.match(panel, new RegExp(`${count} matching ${count === 1 ? 'car' : 'cars'} returned`));
    if (count > 3) assert.match(panel, /Use Next below to browse more/);
    else assert.doesNotMatch(panel, /Use Next below/);
  }
});

test('loading and failed replacement searches do not expose stale counts or partial retry notices', () => {
  const app = results({ searchInfo: { checkedCount: 144, pagesChecked: 3, hasMore: true, partial: true } });
  for (const replacement of [{ loading: true, error: '' }, { loading: false, error: 'Provider unavailable' }]) {
    app.update(replacement);
    const panel = text(activePanel(app));
    assert.doesNotMatch(panel, /144 eBay listings checked|12 matching cars returned|Use Next below|eBay stopped responding|Try again for more/);
    const live = app.one(node => node.type === LiveListings);
    assert.equal(live.props.loading, replacement.loading);
    assert.equal(live.props.error, replacement.error);
  }
});

test('platform selection determines available views and only exposes its prepared marketplaces', () => {
  const destinations = ['autotrader', 'facebook', 'motors', 'gumtree', 'cargurus', 'pistonheads', 'aacars', 'carandclassic'];
  for (const platform of ['all', 'ebay', 'more', ...destinations]) {
    const submitted = carSearch({ platform }), app = results({ search: submitted });
    const expected = platform === 'all' ? destinations : platform === 'ebay' ? []
      : platform === 'more' ? ['gumtree', 'cargurus', 'pistonheads', 'aacars', 'carandclassic'] : [platform];
    const live = platform === 'all' || platform === 'ebay';
    assert.deepEqual(tabs(app).map(text), [...(live ? ['Live cars', 'Price picks'] : []), ...(platform !== 'ebay' ? ['Other sites'] : [])], platform);
    assertTabWiring(app, live ? 'Live cars' : 'Other sites');
    assert.deepEqual(app.nodes().filter(node => node.type === 'a').map(node => node.props.href), expected.map(id => submitted.carLinks[id]), platform);
    assert.equal(app.nodes().some(node => node.type === LiveListings), live);
    if (!live) {
      assert.equal(app.key(selectedTab(app), 'ArrowRight'), true);
      assertTabWiring(app, 'Other sites');
    }
    assert.deepEqual(app.events, []);
  }
});

test('other-site cards disclose filter limitations and emit one event only on actual outbound activation', () => {
  const app = results();
  app.click(app.button('Other sites'));
  assert.match(text(activePanel(app)), /live listings inside Mekivo currently come from eBay/);
  const details = nodes(activePanel(app)).filter(node => node.type === 'details');
  assert.equal(details.length, 8);
  assert.ok(details.every(node => !node.props.open), 'filter explanations start collapsed');
  const link = app.one(node => node.type === 'a' && node.props.href === app.props.search.carLinks.motors);
  assert.equal(link.props.target, '_blank');
  assert.match(link.props.rel, /noreferrer/);
  assert.deepEqual(app.events, []);
  app.click(link);
  assert.equal(app.events.length, 1);
  assert.equal(app.events[0][0], 'marketplace_outbound');
  assert.equal(app.events[0][1].marketplace, 'motors');
  assert.equal(app.events[0][1].destination, 'search_results');
});

function listings(overrides = {}) {
  const calls = { retry: 0 };
  const props = { items: cars(12), loading: false, error: '', fallbackUrl: carSearch().fallbackUrl,
    searchType: 'cars', onRetry() { calls.retry++; }, ...overrides };
  return { ...component('../app/components/ebay-results.tsx', props), calls, props };
}
const listingLinks = app => app.nodes().filter(node => node.type === 'a' && /\/itm\//.test(node.props.href));
const shownTitles = app => app.nodes().filter(node => node.type === 'h4').map(text);

test('car pagination reaches every returned listing once, with bounded controls and no navigation events', () => {
  const app = listings(), seen = [];
  assert.equal(app.button('← Previous').props.disabled, true);
  for (let page = 0; page < 4; page++) {
    const expected = app.props.items.slice(page * 3, page * 3 + 3).map(item => item.title);
    assert.deepEqual(shownTitles(app), expected);
    seen.push(...shownTitles(app));
    assert.equal(listingLinks(app).length, 3);
    assert.equal(text(app.one(node => node.props?.['aria-live'] === 'polite')), `${page * 3 + 1}–${page * 3 + 3} of 12 returned`);
    assert.equal(app.button('← Previous').props.disabled, page === 0);
    assert.equal(app.button('Next →').props.disabled, page === 3);
    if (page < 3) app.click(app.button('Next →'));
  }
  assert.deepEqual(seen, app.props.items.map(item => item.title));
  assert.equal(new Set(seen).size, 12);
  assert.equal(app.focus.length, 3);
  assert.ok(app.focus.every(entry => entry.label === 'Live eBay listings'));
  assert.equal(app.scrolls.length, 3);
  app.click(app.button('← Previous'));
  assert.deepEqual(shownTitles(app), app.props.items.slice(6, 9).map(item => item.title));
  assert.deepEqual(app.events, []);
});

test('motorbike result views retain price picks, budget, sorting and sharing without car marketplace links', () => {
  const submitted = carSearch({ vehicleType: 'motorbikes', make: 'Honda', model: 'CBR600F', platform: 'all', minPrice: '1000', price: '3000', sort: 'price_asc' });
  const changes = [], app = results({ search: submitted, items: cars(4), onSortChange: value => changes.push(value) });
  assert.deepEqual(tabs(app).map(text), ['Live motorbikes', 'Price picks']);
  assertTabWiring(app, 'Live motorbikes');
  assert.equal(app.one(node => node.props?.role === 'tablist').props['aria-label'], 'Motorbike results views');
  assert.match(text(activePanel(app)), /4 matching motorbikes returned/);
  assert.match(app.text(), /£1,000–£3,000/);
  assert.equal(app.one(node => node.type === LiveListings).props.searchType, 'motorbikes');
  assert.equal(app.one(node => node.type === Share).props.item, submitted.saveItem);
  assert.equal(app.nodes().filter(node => node.type === 'a').length, 0, 'no prepared car marketplace links');
  app.one(node => node.type === 'select').props.onChange({ target: { value: 'newest' } });
  assert.deepEqual(changes, ['newest']);
  app.key(selectedTab(app), 'ArrowRight');
  assertTabWiring(app, 'Price picks');
  assert.equal(nodes(activePanel(app)).find(node => node.type === PricePicks).props.search, submitted);
  app.key(selectedTab(app), 'ArrowRight');
  assertTabWiring(app, 'Live motorbikes');
  assert.deepEqual(app.events, []);
});

test('motorbike pagination and outgoing clicks preserve bike attribution and vehicle copy', () => {
  const app = listings({ searchType: 'motorbikes', items: cars(4) });
  assert.equal(app.one(node => node.type === 'nav').props['aria-label'], 'Motorbike listings pages');
  assert.match(app.text(), /vehicle details on eBay/);
  assert.doesNotMatch(app.text(), /compatibility|Item price|Postage:/);
  assert.deepEqual(shownTitles(app), app.props.items.slice(0, 3).map(item => item.title));
  app.click(app.button('Next →'));
  assert.deepEqual(shownTitles(app), [app.props.items[3].title]);
  assert.equal(app.button('Next →').props.disabled, true);
  const link = listingLinks(app)[0];
  assert.equal(new URL(link.props.href).searchParams.get('customid'), 'mekivo-motorbikes-live');
  assert.deepEqual(app.events, [], 'pagination sends no outbound event');
  app.click(link);
  assert.equal(app.events[0][1].search_type, 'motorbikes');
  assert.equal(app.events[0][1].marketplace, 'ebay');
});

test('short and partial pages never show empty pages or allow navigation beyond the response', () => {
  for (const count of [1, 2, 3, 4, 8]) {
    const app = listings({ items: cars(count) });
    while (!app.button('Next →').props.disabled) app.click(app.button('Next →'));
    const first = Math.floor((count - 1) / 3) * 3;
    assert.deepEqual(shownTitles(app), app.props.items.slice(first).map(item => item.title));
    assert.equal(text(app.one(node => node.props?.['aria-live'] === 'polite')), `${first + 1}–${count} of ${count} returned`);
    // Disabled native buttons prevent activation; the handler also clamps a
    // stale/programmatic invocation so bounds cannot produce a blank page.
    app.button('Next →').props.onClick(); app.render();
    assert.deepEqual(shownTitles(app), app.props.items.slice(first).map(item => item.title));
    while (!app.button('← Previous').props.disabled) app.click(app.button('← Previous'));
    app.button('← Previous').props.onClick(); app.render();
    assert.deepEqual(shownTitles(app), app.props.items.slice(0, 3).map(item => item.title));
    assert.deepEqual(app.events, []);
  }
});

test('new response identity resets the pager even when its length and listing IDs are unchanged', () => {
  const app = listings();
  app.click(app.button('Next →')); app.click(app.button('Next →'));
  const replacement = app.props.items.map(item => ({ ...item }));
  app.update({ items: replacement });
  assert.deepEqual(shownTitles(app), replacement.slice(0, 3).map(item => item.title));
  assert.equal(app.button('← Previous').props.disabled, true);
  app.click(app.button('Next →'));
  app.update({ items: [car(90)] });
  assert.deepEqual(shownTitles(app), [car(90).title]);
  assert.equal(app.button('Next →').props.disabled, true);
  assert.deepEqual(app.events, []);
});

test('loading, failure and empty responses hide old cards and paging but retain the direct fallback', () => {
  const app = listings();
  app.click(app.button('Next →'));
  app.update({ loading: true });
  assert.match(app.text(), /Loading live eBay listings/);
  assert.equal(listingLinks(app).length, 0);
  assert.equal(app.nodes().filter(node => node.type === 'nav').length, 0);
  app.update({ loading: false, error: 'Provider timed out' });
  assert.match(app.text(), /Provider timed out/);
  assert.equal(listingLinks(app).length, 0);
  assert.equal(app.nodes().filter(node => node.type === 'nav').length, 0);
  const fallback = app.one(node => node.type === 'a');
  assert.equal(fallback.props.href, app.props.fallbackUrl);
  app.click(app.button('Try again'));
  assert.equal(app.calls.retry, 1);
  app.update({ error: '', items: [] });
  assert.match(app.text(), /No live eBay listings matched/);
  assert.equal(app.nodes().filter(node => node.type === 'button').length, 0);
  app.update({ items: cars(4) });
  assert.deepEqual(shownTitles(app), cars(3).map(item => item.title));
  assert.equal(app.button('← Previous').props.disabled, true);
  assert.deepEqual(app.events, []);
});

test('parts pagination reaches all returned listings and keeps parts affiliate attribution', () => {
  const app = listings({ searchType: 'parts' }), seen = [];
  for (let page = 0; page < 4; page++) {
    seen.push(...shownTitles(app));
    assert.equal(listingLinks(app).length, 3);
    assert.equal(app.one(node => node.type === 'nav').props['aria-label'], 'Parts listings pages');
    assert.equal(app.button('Next →').props.disabled, page === 3);
    if (page < 3) app.click(app.button('Next →'));
  }
  assert.deepEqual(seen, app.props.items.map(item => item.title));
  assert.match(app.text(), /compatibility on eBay/);
  assert.match(app.text(), /Postage: check on eBay/);
  assert.deepEqual(app.events, []);
  const link = listingLinks(app)[0];
  assert.equal(new URL(link.props.href).searchParams.get('customid'), 'mekivo-parts-live');
  app.click(link);
  assert.equal(app.events[0][1].search_type, 'parts');
});

test('parts view tabs work by keyboard, keep submitted criteria, and preserve retry/save/edit', () => {
  const search = searchHelpers.createPartSearch({ make: 'Ford', model: 'Fiesta', year: '2018', engine: '', fuel: '', bodyStyle: '', part: 'Brake Disc', partNumber: '', partCategory: 'Brakes', partMethod: 'diagram' });
  let edits = 0, retries = 0;
  const app = component('../app/components/part-search-results.tsx', { search, items: cars(4), loading: false, error: '', onEdit() { edits++; }, onRetry() { retries++; } });
  assert.deepEqual(tabs(app).map(text), ['Live parts', 'Price picks']);
  assertTabWiring(app, 'Live parts');
  assert.equal(app.key(selectedTab(app), 'ArrowRight'), true);
  assertTabWiring(app, 'Price picks');
  assert.equal(app.focus.at(-1).label, 'Price picks');
  assert.equal(nodes(activePanel(app)).find(node => node.type === PartPricePicks).props.search, search);
  app.key(selectedTab(app), 'ArrowRight');
  assertTabWiring(app, 'Live parts');
  app.key(selectedTab(app), 'End');
  assertTabWiring(app, 'Price picks');
  app.key(selectedTab(app), 'Home');
  assertTabWiring(app, 'Live parts');
  assert.equal(app.key(selectedTab(app), 'Tab'), false);
  app.one(node => node.type === LiveListings).props.onRetry();
  app.click(app.button('Edit search'));
  assert.equal(edits, 1); assert.equal(retries, 1);
  assert.equal(app.one(node => node.type === Save).props.item, search.saveItem);
  assert.deepEqual(app.events, []);
});

test('eBay outbound links retain affiliate attribution and emit only their actual destination event', () => {
  const app = listings();
  app.click(app.button('Next →'));
  assert.deepEqual(app.events, []);
  const listing = listingLinks(app)[0], url = new URL(listing.props.href);
  assert.equal(url.pathname, new URL(app.props.items[3].url).pathname);
  assert.equal(url.searchParams.get('customid'), 'mekivo-cars-live');
  assert.equal(url.searchParams.get('campid'), '5339201924');
  assert.match(listing.props.rel, /sponsored/);
  app.click(listing);
  const all = app.one(node => node.type === 'a' && text(node) === 'See all →');
  assert.equal(all.props.href, app.props.fallbackUrl);
  app.click(all);
  assert.deepEqual(app.events.map(([name, properties]) => [name, properties.marketplace, properties.search_type, properties.destination]), [
    ['marketplace_outbound', 'ebay', 'cars', 'listing'],
    ['marketplace_outbound', 'ebay', 'cars', 'all_results'],
  ]);
});

test('new creative labels are attributed while unknown labels and excluded traffic remain restricted', () => {
  for (const content of ['live_cars_v2', 'car_sites_v2', 'unapproved_car_ad']) {
    for (const audience of ['included', 'excluded']) {
      const exports = {}, sent = [], storage = new Map();
      vm.runInNewContext(compile('../app/lib/growth-events.ts'), {
        exports, URLSearchParams,
        window: { location: { search: `?utm_source=facebook&utm_medium=organic_social&utm_campaign=september_validation&utm_content=${content}&registration=AB12CDE` },
          va() {}, sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } },
        require(name) {
          if (name === '@vercel/analytics') return { track: (...args) => sent.push(args) };
          if (name === './analytics-audience') return { analyticsAudience: () => audience, initializeAnalyticsAudience() {} };
          throw Error(`Unexpected analytics dependency: ${name}`);
        },
      });
      exports.trackGrowthEvent('campaign_landing', { landing_mode: 'cars' });
      assert.equal(sent.length, audience === 'included' ? 1 : 0);
      if (audience === 'included') {
        assert.equal(sent[0][1].campaign, `facebook|organic_social|september_validation|${content === 'unapproved_car_ad' ? 'unknown' : content}`);
        assert.equal(sent[0][1].context, 'cars');
      }
      assert.ok(!JSON.stringify([...sent, ...storage.values()]).includes('AB12CDE'));
    }
  }
});
