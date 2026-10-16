import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function helpers(path) {
  const exports = {};
  vm.runInNewContext(compile(path), { exports, URL, URLSearchParams, require(name) {
    if (name === './car-extras') return helpers('../app/lib/car-extras.ts');
    throw Error(`Unexpected helper dependency: ${name}`);
  } });
  return exports;
}
const search = helpers('../app/lib/search.ts');
const saved = helpers('../app/lib/saved-search.ts');
const guide = helpers('../app/lib/parts-guide-data.ts');
const filters = helpers('../app/lib/car-filters.ts');
const pickerHelpers = helpers('../app/lib/vehicle-picker-options.ts');
const vehicleOptions = helpers('../app/lib/vehicle-options.ts');
const NextLink = () => null;
const VehiclePicker = () => null;
const PageResults = () => null;
const ExtraControls = () => null;
const Placeholder = () => null;
// Expand the real pure shell and shared category navigation so their children,
// after content, and native section ref take part in these behavior checks.
const layoutModules = new Map();
function layoutModule(name) {
  if (layoutModules.has(name)) return layoutModules.get(name);
  const exports = {};
  layoutModules.set(name, exports);
  vm.runInNewContext(compile(`../app/components/${name}.tsx`), { exports, require(dependency) {
    if (dependency === 'react/jsx-runtime') return jsxRuntime;
    if (dependency === 'next/link') return { default: NextLink };
    if (dependency === './search-categories') return layoutModule('search-categories');
    if (dependency === './site-header' || dependency === './site-footer') return { default: Placeholder };
    throw Error(`Unexpected layout dependency: ${dependency}`);
  } });
  return exports;
}
const SearchPageShell = layoutModule('search-page-shell').default;
const SearchCategories = layoutModule('search-categories').default;
function expandLayout(node) {
  if (Array.isArray(node)) return node.map(expandLayout);
  if (!node?.props) return node;
  if (node.type === SearchPageShell || node.type === SearchCategories) return expandLayout(node.type(node.props));
  return { ...node, props: { ...node.props, children: expandLayout(node.props.children) } };
}

const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
function nodes(node, found = []) {
  if (Array.isArray(node)) node.forEach(child => nodes(child, found));
  else if (node?.props) { found.push(node); nodes(node.props.children, found); }
  return found;
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const bike = (id = 1) => ({ id: String(id), title: `2018 Honda CBR600F motorbike ${id}`, price: '2000', currency: 'GBP', condition: 'Used', location: 'GB', buyingOptions: ['FIXED_PRICE'], image: null, url: `https://www.ebay.co.uk/itm/12345678900${id}` });

// Render the actual page and invoke its controls, including delayed fetches that
// ignore cancellation. No browser, network or production analytics are involved.
function page(query = '', initialProps = {}) {
  let cursor = 0, dirty = true, tree, timer = 0;
  const params = new URLSearchParams(query);
  let props = { initialMode: params.get('mode') === 'parts' ? 'parts' : 'cars', initialVehicleType: params.get('vehicle_type') === 'motorbikes' ? 'motorbikes' : 'cars', ...initialProps };
  let route = props.initialMode === 'parts' ? 'parts' : props.initialVehicleType;
  const location = { search: query };
  const slots = [], effects = new Map(), pending = [], requests = [], events = [], timers = new Map();
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { const next = typeof value === 'function' ? value(slots[index]) : value; if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; } }];
    },
    useEffectEvent(callback) {
      const index = cursor++;
      const record = slots[index] ??= { callback };
      record.callback = callback;
      return record.run ??= (...args) => record.callback(...args);
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(callback, dependencies) {
      const index = cursor++, before = effects.get(index);
      if (!before || dependencies.some((value, i) => !Object.is(value, before.dependencies[i]))) {
        before?.cleanup?.();
        const record = { dependencies, cleanup: null };
        effects.set(index, record);
        pending.push(() => { record.cleanup = callback(); });
      }
    },
  };
  const frame = callback => { callback(); return 1; };
  const exports = {}, campaign = {};
  vm.runInNewContext(compile('../app/lib/campaign-landing.ts'), { exports: campaign, URLSearchParams, window: { location }, require(name) {
    if (name === './growth-events') return { trackGrowthEvent: (...args) => events.push(args) };
    throw Error(name);
  } });
  vm.runInNewContext(compile('../app/components/search-experience.tsx'), {
    exports, URLSearchParams, AbortController, requestAnimationFrame: frame,
    setTimeout(callback) { const id = ++timer; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id),
    window: { location, requestAnimationFrame: frame, cancelAnimationFrame() {}, open() { throw Error('Motorbike search must never open a car marketplace'); } },
    fetch(url, options) { return new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })); },
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'next/link') return { default: NextLink };
      if (name === './search-page-shell') return { default: SearchPageShell };
      if (name === 'next/dynamic') return { default: () => Placeholder };
      if (name === '../lib/search') return search;
      if (name === '../lib/saved-search') return saved;
      if (name === '../lib/parts-guide-data') return guide;
      if (name === '../lib/car-filters') return filters;
      if (name === '../lib/vehicle-picker-options') return pickerHelpers;
      if (name === '../lib/vehicle-options') return vehicleOptions;
      if (name === '../lib/campaign-landing') return campaign;
      if (name === './vehicle-picker') return { default: VehiclePicker };
      if (name === '../lib/growth-events') return { trackGrowthEvent: (...args) => events.push(args) };
      if (name === '../lib/analytics-audience') return { analyticsAudience: () => 'excluded' };
      if (name === '../lib/supabase') return { getSupabaseBrowserClient: () => null };
      if (name === './car-search-results') return { default: PageResults };
      if (name === './car-extra-filters') return { default: ExtraControls };
      return { default: Placeholder };
    },
  });
  const render = () => {
    for (let attempt = 0; dirty; attempt++) {
      assert.ok(attempt < 12, 'page settles after its control changes');
      cursor = 0; dirty = false; tree = expandLayout(exports.default(props));
      for (const node of nodes(tree)) if (typeof node.type === 'string' && node.props.ref) node.props.ref.current = { focus() {}, scrollIntoView() {} };
      pending.splice(0).forEach(effect => effect());
    }
    return tree;
  };
  const one = predicate => { const matches = nodes(render()).filter(predicate); assert.equal(matches.length, 1, 'one requested control'); return matches[0]; };
  render();
  return {
    requests, events, render, one, nodes: () => nodes(render()), text: () => text(render()),
    button: label => one(node => node.type === 'button' && text(node) === label),
    field: label => {
      const picker = nodes(render()).find(node => node.type === VehiclePicker && node.props.label === label);
      if (picker) return picker;
      const fieldLabel = one(node => node.type === 'label' && text(node).startsWith(label));
      return fieldLabel.props.htmlFor
        ? one(node => ['input', 'select'].includes(node.type) && node.props.id === fieldLabel.props.htmlFor)
        : nodes(fieldLabel).find(node => ['input', 'select'].includes(node.type));
    },
    navigate(nextRoute) {
      if (route === nextRoute) return render();
      for (const effect of effects.values()) effect.cleanup?.();
      effects.clear(); pending.length = 0; slots.length = 0;
      location.search = '';
      route = nextRoute;
      props = { initialMode: nextRoute === 'parts' ? 'parts' : 'cars', initialVehicleType: nextRoute === 'motorbikes' ? 'motorbikes' : 'cars' };
      dirty = true; return render();
    },
    click(node) { node.props.onClick(); render(); },
    change(node, value) { node.props.onChange(node.type === VehiclePicker ? value : { target: { value } }); render(); },
    results: () => nodes(render()).find(node => node.type === PageResults),
    async respond(index, payload) { requests[index].resolve({ ok: true, json: async () => payload }); await flush(); render(); },
  };
}

test('car extras restore, survive budget presets and clear when switching search types', () => {
  const app = page('?restore=1&mode=cars&platform=ebay&price=5000&extras=panoramic_roof,heated_seats');
  const extras = () => app.one(node => node.type === ExtraControls);
  assert.deepEqual(Array.from(extras().props.value), ['heated_seats', 'panoramic_roof']);
  app.click(app.button('Up to £1,000'));
  assert.deepEqual(Array.from(extras().props.value), ['heated_seats', 'panoramic_roof']);
  app.click(app.button('Search eBay'));
  const params = new URL(app.requests[0].url, 'https://local.test').searchParams;
  assert.equal(params.get('extras'), 'heated_seats,panoramic_roof');
  assert.equal(params.get('maxPrice'), '1000');
  assert.deepEqual(Array.from(app.results().props.search.carExtras), ['heated_seats', 'panoramic_roof']);
  app.navigate('motorbikes');
  assert.ok(!app.nodes().some(node => node.type === ExtraControls));
  app.click(app.button('Search eBay motorbikes'));
  assert.equal(new URL(app.requests[1].url, 'https://local.test').searchParams.has('extras'), false);
  app.navigate('cars');
  assert.deepEqual(Array.from(extras().props.value), []);
  extras().props.onChange(['heated_seats']); app.render();
  app.navigate('parts');
  app.navigate('cars');
  assert.deepEqual(Array.from(extras().props.value), []);
});

test('motorbike route starts with bike suggestions and unrestricted model while retaining its budget controls', () => {
  const app = page();
  assert.deepEqual(app.nodes().filter(node => node.type === NextLink && /^(Cars|Motorbikes|Parts)$/.test(text(node))).map(node => [text(node), node.props.href]), [['Cars', '/cars'], ['Motorbikes', '/motorbikes'], ['Parts', '/parts']]);
  app.change(app.field('Maximum budget'), '3000');
  app.change(app.field('Make'), 'Ford'); app.change(app.field('Model'), 'Fiesta'); app.change(app.field('Year'), '2018');
  app.navigate('motorbikes');
  assert.equal(app.field('Maximum budget').props.value, '', 'a different route gets a fresh draft');
  app.change(app.field('Maximum budget'), '3000');
  for (const label of ['Make', 'Model', 'Year']) assert.equal(app.field(label).props.value, '');
  assert.equal(app.field('Make').type, VehiclePicker);
  assert.deepEqual(Array.from(app.field('Make').props.options), ['Honda', 'Yamaha', 'Suzuki', 'Kawasaki', 'Triumph', 'BMW', 'Ducati', 'KTM', 'Aprilia', 'Lexmoto', 'Vespa']);
  assert.equal(app.field('Model').type, VehiclePicker);
  assert.deepEqual(Array.from(app.field('Model').props.options), [], 'bike models are not restricted to a car model list');
  app.change(app.field('Model'), 'Monkey 125');
  assert.equal(app.field('Model').props.value, 'Monkey 125');
  app.navigate('motorbikes');
  assert.equal(app.field('Model').props.value, 'Monkey 125', 'reselecting the current kind preserves the draft');
  assert.ok(app.nodes().some(node => node.props?.['aria-label'] === 'Quick motorbike budgets'));
  assert.ok(!app.nodes().some(node => node.type === 'summary' && /^Search:/.test(text(node))), 'marketplace chooser is hidden');
  app.click(app.button('Use any make and year within this budget'));
  assert.equal(app.field('Maximum budget').props.value, '3000');
  app.click(app.button('Search eBay motorbikes'));
  assert.equal(app.requests.length, 1);
  assert.equal(new URL(app.requests[0].url, 'https://local.test').searchParams.get('vehicleType'), 'motorbikes');
  assert.equal(app.results().props.search.platform, 'ebay');
  assert.equal(app.results().props.search.vehicleType, 'motorbikes');
  assert.equal(app.results().props.search.title, 'All motorbikes');
});

test('bike submission, successful live results and sort refinements keep subtype, filters and attribution', async () => {
  const app = page('?vehicle_type=motorbikes');
  app.change(app.field('Make'), 'Honda'); app.change(app.field('Model'), 'CBR600F'); app.change(app.field('Year'), '2018');
  app.change(app.field('Minimum price'), '1000'); app.change(app.field('Maximum budget'), '3000');
  app.click(app.button('Search eBay motorbikes'));
  const submitted = app.results().props.search;
  const params = new URL(app.requests[0].url, 'https://local.test').searchParams;
  assert.equal(params.get('type'), 'cars'); assert.equal(params.get('vehicleType'), 'motorbikes');
  assert.equal(params.get('make'), 'Honda'); assert.equal(params.get('model'), 'CBR600F');
  assert.equal(params.get('minPrice'), '1000'); assert.equal(params.get('maxPrice'), '3000');
  assert.equal(params.get('sort'), 'price_asc'); assert.equal(params.get('hideUnwanted'), '1');
  assert.equal(app.events[0][1].search_type, 'motorbikes'); assert.equal(app.events[0][1].marketplace, 'ebay');
  await app.respond(0, { items: [bike()], searchInfo: { checkedCount: 3, pagesChecked: 1, partial: false, hasMore: false } });
  assert.equal(app.results().props.items.length, 1);
  assert.equal(app.events.at(-1)[0], 'results_shown'); assert.equal(app.events.at(-1)[1].search_type, 'motorbikes');
  const refine = app.results().props.onSortChange;
  app.change(app.field('Model'), 'A different draft');
  refine('newest'); app.render();
  const refined = new URL(app.requests[1].url, 'https://local.test').searchParams;
  assert.equal(refined.get('vehicleType'), 'motorbikes'); assert.equal(refined.get('model'), 'CBR600F'); assert.equal(refined.get('sort'), 'newest');
  assert.equal(refined.get('maxPrice'), '3000'); assert.equal(submitted.carSort, 'price_asc');
});

test('switching between bikes, cars and parts aborts live requests and rejects late listings', async () => {
  const app = page('?vehicle_type=motorbikes');
  app.change(app.field('Make'), 'Honda'); app.change(app.field('Model'), 'CBR600F'); app.change(app.field('Year'), '2018');
  app.click(app.button('Search eBay motorbikes'));
  app.navigate('cars');
  assert.equal(app.requests[0].options.signal.aborted, true); assert.equal(app.results(), undefined);
  for (const label of ['Make', 'Model', 'Year']) assert.equal(app.field(label).props.value, '');
  await app.respond(0, { items: [bike()] });
  assert.equal(app.results(), undefined); assert.deepEqual(app.events.map(([name]) => name), ['search_submitted']);
  app.click(app.button('Search all marketplaces'));
  assert.equal(new URL(app.requests[1].url, 'https://local.test').searchParams.has('vehicleType'), false);
  app.navigate('parts');
  assert.equal(app.requests[1].options.signal.aborted, true); assert.equal(app.results(), undefined);
  await app.respond(1, { items: [bike()] });
  assert.equal(app.results(), undefined); assert.equal(app.events.length, 2);
});

test('switching to motorbikes aborts a pending car registration lookup and rejects its late vehicle details', async () => {
  const app = page('?mode=parts');
  const registration = app.one(node => node.type === 'input' && node.props.placeholder === 'e.g. AB12 CDE');
  app.change(registration, 'AB12CDE');
  app.click(app.button('Find vehicle'));
  assert.equal(app.requests[0].url, '/api/vehicle');
  app.navigate('motorbikes');
  assert.equal(app.requests[0].options.signal.aborted, true);
  await app.respond(0, { vehicle: { make: 'Ford', model: 'Fiesta', yearOfManufacture: 2018 } });
  for (const label of ['Make', 'Model', 'Year']) assert.equal(app.field(label).props.value, '');
  assert.deepEqual(app.events, []);
});

test('saved and shared bike links restore the bike form and exact budget without submitting', () => {
  const submitted = search.createCarSearch({ vehicleType: 'motorbikes', make: 'Yamaha', model: 'MT-07', year: '2020', minPrice: '2000', price: '5000', sort: 'newest', hideUnwanted: true, postcode: '', platform: 'all' });
  for (const url of [saved.getSavedSearchUrl(submitted.saveItem), saved.getSharedSearchUrl(submitted.saveItem)]) {
    const app = page(new URL(url, 'https://local.test').search);
    assert.ok(app.button('Search eBay motorbikes'));
    assert.equal(app.field('Make').props.value, 'Yamaha'); assert.equal(app.field('Model').props.value, 'MT-07'); assert.equal(app.field('Year').props.value, '2020');
    assert.equal(app.field('Minimum price').props.value, '2000'); assert.equal(app.field('Maximum budget').props.value, '5000'); assert.equal(app.field('Sort live motorbikes').props.value, 'newest');
    assert.equal(app.requests.length, 0); assert.deepEqual(app.events, []); assert.equal(app.results(), undefined);
  }
  const campaign = page('?vehicle_type=motorbikes&utm_source=facebook&utm_medium=organic_social&utm_campaign=september_validation&utm_content=budget_car');
  assert.equal(campaign.events.length, 1); assert.equal(campaign.events[0][1].landing_mode, 'motorbikes');
});

test('homepage quick search runs the restored budget once and cannot auto-open an external marketplace', () => {
  const app = page('?restore=1&mode=cars&platform=all&price=1000&make=Volkswagen&model=Golf&run=1');
  assert.equal(app.requests.length, 1);
  const params = new URL(app.requests[0].url, 'https://local.test').searchParams;
  assert.equal(params.get('maxPrice'), '1000');
  assert.equal(params.get('make'), 'Volkswagen'); assert.equal(params.get('model'), 'Golf');
  assert.equal(app.events.filter(([name]) => name === 'search_submitted').length, 1);
  app.render();
  assert.equal(app.requests.length, 1, 'a later render does not run the quick search again');
  app.navigate('motorbikes');
  assert.equal(app.requests[0].options.signal.aborted, true);
  assert.equal(app.requests.length, 1, 'the next route does not inherit the quick-run flag');
  assert.equal(app.field('Make').props.value, '');
  const external = page('?restore=1&mode=cars&platform=autotrader&make=Ford&run=1');
  assert.equal(external.requests.length, 0);
  assert.equal(external.results(), undefined);
});

test('bike failed and empty searches emit bike result events and retain the retry snapshot', async () => {
  const app = page('', { initialMode: 'cars', initialVehicleType: 'motorbikes' });
  app.click(app.button('Search eBay motorbikes'));
  const submitted = app.results().props.search;
  app.requests[0].reject(Error('Provider unavailable')); await flush(); app.render();
  assert.equal(app.events.at(-1)[0], 'results_error'); assert.equal(app.events.at(-1)[1].search_type, 'motorbikes');
  assert.equal(app.results().props.search, submitted);
  app.results().props.onRetry(); app.render();
  await app.respond(1, { items: [] });
  assert.equal(app.events.at(-1)[0], 'results_empty'); assert.equal(app.events.at(-1)[1].search_type, 'motorbikes');
});

test('motorbike price picks retain seller links, saving, affiliate attribution and bike-specific states', () => {
  const exports = {}, events = [], ranked = [];
  const SaveListing = () => null;
  vm.runInNewContext(compile('../app/components/car-recommendations.tsx'), {
    exports,
    require(name) {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === '../lib/search') return search;
      if (name === '../lib/saved-search') return saved;
      if (name === '../lib/growth-events') return { trackGrowthEvent: (...args) => events.push(args) };
      if (name === './save-listing-button') return { default: SaveListing };
      if (name === './ebay-results') return { ListingPhoto: Placeholder };
      if (name === '../lib/car-recommendations') return { getCarRecommendations(items, snapshot) {
        ranked.push(snapshot);
        return items.map(item => ({ item, url: item.url, pricePence: Number(item.price) * 100, belowBudgetPence: 100000, purchaseFormat: 'Buy it now' }));
      } };
      throw Error(`Unexpected price picks dependency: ${name}`);
    },
  });
  const snapshot = search.createCarSearch({ vehicleType: 'motorbikes', make: 'Honda', model: 'CBR600F', year: '2018', minPrice: '1000', price: '3000', postcode: '', platform: 'all' });
  const props = { search: snapshot, items: [bike()], loading: false, error: '', compact: true };
  const tree = expandLayout(exports.default(props));
  assert.equal(ranked[0], snapshot);
  assert.match(text(tree), /Lowest-priced matches/); assert.match(text(tree), /£2,000\.00/); assert.match(text(tree), /£1,000\.00 below your maximum/);
  const save = nodes(tree).find(node => node.type === SaveListing);
  assert.equal(save.props.searchType, 'motorbikes'); assert.match(save.props.searchUrl, /vehicle_type=motorbikes/);
  const link = nodes(tree).find(node => node.type === 'a');
  assert.equal(new URL(link.props.href).searchParams.get('customid'), 'mekivo-motorbikes-shortlist');
  link.props.onClick();
  assert.equal(events[0][1].search_type, 'motorbikes'); assert.equal(events[0][1].marketplace, 'ebay');
  const loading = exports.default({ ...props, loading: true });
  assert.match(text(loading), /matching motorbikes/);
  const error = exports.default({ ...props, error: 'Unavailable' });
  assert.match(text(error), /Choose Live motorbikes to retry/); assert.doesNotMatch(text(error), /Live cars/);
  const empty = exports.default({ ...props, items: [] });
  assert.match(text(empty), /matching complete motorbike listing/); assert.doesNotMatch(text(empty), /full-car|Live cars/);
});
