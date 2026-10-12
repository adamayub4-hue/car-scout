import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
function harness(audience = 'included') {
  const modules = new Map(), events = [];
  const jsx = (type, props) => ({ type, props });
  const hooks = { useState: value => [value, () => {}], useRef: value => ({ current: value }), useEffect() {} };
  function load(relative) {
    let filename = resolve(root, relative);
    if (!existsSync(filename)) filename += existsSync(`${filename}.ts`) ? '.ts' : '.tsx';
    if (modules.has(filename)) return modules.get(filename);
    const exports = {}; modules.set(filename, exports);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, {
      exports, URL, URLSearchParams, Date, setTimeout, clearTimeout,
      window: { location: { search: '' }, sessionStorage: { getItem() { return null; }, setItem() {} }, va() {} },
      require(name) {
        if (name === 'react') return hooks;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (name === 'next/image' || name === 'next/link') return { default: name };
        if (name.endsWith('analytics-audience')) return { analyticsAudience: () => audience, initializeAnalyticsAudience() {} };
        if (name === '@vercel/analytics') return { track: (name, properties) => events.push(JSON.parse(JSON.stringify({ name, properties }))) };
        if (name.endsWith('/supabase')) return { getSupabaseBrowserClient: () => null };
        if (name === './save-listing-button') return { default: 'save-button' };
        if (name.startsWith('.')) return load(resolve(dirname(filename), name));
        throw new Error(`Unexpected isolated dependency: ${name}`);
      },
    }, { filename });
    return exports;
  }
  return { load, events };
}
const listing = (id, buyingOptions, title = 'Ford Fiesta 2018 car') => ({ id, title, url: `https://www.ebay.co.uk/itm/${id}`, image: null, price: '2000.00', currency: 'GBP', condition: 'Used', location: 'GB', buyingOptions });
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
const anchor = (tree, ending) => nodes(tree).find(node => node.type === 'a' && node.props.href?.split('?')[0].endsWith(ending));

test('buying format observes all primary offer formats without treating best-offer or unknown input as a purchase', () => {
  const { ebayBuyingFormat } = harness().load('app/lib/search.ts');
  for (const [options, expected] of [
    [['FIXED_PRICE'], 'fixed_price'], [['AUCTION'], 'auction'], [['CLASSIFIED_AD'], 'classified'],
    [['FIXED_PRICE', 'AUCTION'], 'mixed'], [['CLASSIFIED_AD', 'AUCTION'], 'mixed'],
    [['FIXED_PRICE', 'BEST_OFFER'], 'fixed_price'], [['FIXED_PRICE', 'FIXED_PRICE'], 'fixed_price'],
    [['BEST_OFFER'], 'unknown'], [[], 'unknown'], [null, 'unknown'], ['FIXED_PRICE', 'unknown'],
    [['fixed_price'], 'unknown'], [['PRIVATE'], 'unknown'], [['FIXED_PRICE', 'PRIVATE'], 'unknown'], [['FIXED_PRICE', 7], 'unknown'], [Array(17).fill('FIXED_PRICE'), 'unknown'],
  ]) assert.equal(ebayBuyingFormat(options), expected);
});

test('actual live, shortlist, parts and local saved click handlers emit only enum format and destination', () => {
  const h = harness();
  const classified = listing('123456789010', ['CLASSIFIED_AD']);
  const auction = listing('123456789011', ['AUCTION']);
  const mixed = listing('123456789012', ['AUCTION', 'FIXED_PRICE']);
  const EbayResults = h.load('app/components/ebay-results.tsx').default;
  const tree = EbayResults({ items: [classified, auction, mixed], loading: false, error: '', fallbackUrl: 'https://www.ebay.co.uk/sch/i.html', searchType: 'cars', onRetry() {} });
  anchor(tree, classified.id).props.onClick();
  anchor(tree, auction.id).props.onClick();
  anchor(tree, mixed.id).props.onClick();
  anchor(tree, '/sch/i.html').props.onClick();
  const carSearch = { mode: 'cars', platform: 'ebay', title: 'PRIVATE', carCriteria: { make: 'Ford', model: 'Fiesta', year: '2018' }, maxPrice: '3000', saveItem: { kind: 'car_search', title: 'Saved search', data: { make: 'Ford', model: 'Fiesta', year: '2018', platform: 'ebay' } } };
  const cars = h.load('app/components/car-recommendations.tsx').default({ search: carSearch, items: [classified], loading: false, error: '' });
  anchor(cars, classified.id).props.onClick();
  const part = listing('123456789013', ['FIXED_PRICE'], 'Ford Fiesta BRK123 brake disc');
  const partSearch = { mode: 'parts', platform: 'ebay', title: 'PRIVATE', partCriteria: { make: 'Ford', model: 'Fiesta', part: 'brake disc', partNumber: 'BRK123' }, saveItem: { kind: 'part_search', title: 'Saved search', data: { make: 'Ford', model: 'Fiesta', part: 'brake disc', partNumber: 'BRK123' } } };
  const parts = h.load('app/components/part-recommendations.tsx').default({ search: partSearch, items: [part], loading: false, error: '' });
  anchor(parts, part.id).props.onClick();
  const saved = h.load('app/lib/saved-listings.ts').createSavedListing(classified, 'cars');
  const card = h.load('app/components/saved-listing-card.tsx').default({ item: saved });
  anchor(card, classified.id).props.onClick();
  assert.deepEqual(h.events.map(event => event.properties.context), [
    'v2:cars:ebay:listing:classified', 'v2:cars:ebay:listing:auction', 'v2:cars:ebay:listing:mixed',
    'v2:cars:ebay:all_results:unknown', 'v2:cars:ebay:listing:classified', 'v2:parts:ebay:listing:fixed_price', 'v2:cars:ebay:listing:unknown',
  ]);
  assert.ok(h.events.every(event => Object.keys(event.properties).sort().join(',') === 'campaign,context'));
  for (const privateValue of ['PRIVATE', '123456789010', '123456789011', '123456789012', '123456789013', '2000', 'BRK123', 'ebay.co.uk']) assert.ok(!JSON.stringify(h.events).includes(privateValue), privateValue);
});

test('actual excluded listing click handler sends no growth events', () => {
  const h = harness('excluded'), item = listing('123456789014', ['CLASSIFIED_AD']);
  const tree = h.load('app/components/ebay-results.tsx').default({ items: [item], loading: false, error: '', fallbackUrl: 'https://www.ebay.co.uk/sch/i.html', searchType: 'cars', onRetry() {} });
  anchor(tree, item.id).props.onClick();
  assert.deepEqual(h.events, []);
});

test('server unknown format survives normalized search options and is not promoted by live click handlers', () => {
  const h = harness();
  const item = { ...listing('123456789015', ['FIXED_PRICE']), buyingFormat: 'unknown' };
  const tree = h.load('app/components/ebay-results.tsx').default({ items: [item], loading: false, error: '', fallbackUrl: 'https://www.ebay.co.uk/sch/i.html', searchType: 'cars', onRetry() {} });
  anchor(tree, item.id).props.onClick();
  assert.equal(h.events[0].properties.context, 'v2:cars:ebay:listing:unknown');
  assert.equal(h.load('app/lib/saved-listings.ts').createSavedListing(item, 'cars').data.buyingOptions, undefined);
});
