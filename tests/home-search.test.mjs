import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

function compile(path, jsx = false) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: {
    ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}), module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
}
function helper(path, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(compile(path), { exports, URLSearchParams, require(name) {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected helper dependency: ${name}`);
  } });
  return exports;
}
const options = helper('../app/lib/vehicle-options.ts');
const pickerOptions = helper('../app/lib/vehicle-picker-options.ts');
const carExtras = helper('../app/lib/car-extras.ts');
const savedSearch = helper('../app/lib/saved-search.ts', { './car-extras': carExtras });
const VehiclePicker = () => null;
const CarExtraFilters = () => null;
const NextForm = () => null;
function nodes(node, found = []) {
  if (Array.isArray(node)) node.forEach(child => nodes(child, found));
  else if (node?.props) { found.push(node); nodes(node.props.children, found); }
  return found;
}

function homeSearch() {
  const exports = {}, slots = [], landings = [];
  let cursor = 0, mounted = false;
  vm.runInNewContext(compile('../app/components/home-search.tsx', true), { exports,
    require(name) {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'react') return {
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
        useEffect(effect) { cursor++; if (!mounted) effect(); },
      };
      if (name === './vehicle-picker') return { default: VehiclePicker };
      if (name === './car-extra-filters') return { default: CarExtraFilters };
      if (name === 'next/form') return { default: NextForm };
      if (name === '../lib/vehicle-options') return options;
      if (name === '../lib/vehicle-picker-options') return pickerOptions;
      if (name === '../lib/campaign-landing') return { trackCampaignLanding: mode => landings.push(mode) };
      throw new Error(`Unexpected home form dependency: ${name}`);
    },
  });
  const render = () => { cursor = 0; const tree = exports.default(); mounted = true; return tree; };
  const one = predicate => { const matches = nodes(render()).filter(predicate); assert.equal(matches.length, 1); return matches[0]; };
  render();
  return {
    render, landings,
    form: () => one(node => node.type === NextForm),
    budget: () => one(node => node.type === 'input' && node.props.name === 'price'),
    input: name => one(node => ['input', 'select'].includes(node.type) && node.props.name === name),
    extras: () => one(node => node.type === CarExtraFilters),
    unwantedToggle: () => one(node => node.type === 'input' && node.props.type === 'checkbox'),
    picker: label => one(node => node.type === VehiclePicker && node.props.label === label),
    fields: () => nodes(render()).filter(node => ['input', 'select'].includes(node.type) && node.props.name),
    params() { return new URLSearchParams(this.fields().map(node => [node.props.name, node.props.value])); },
    changeBudget(value) { this.budget().props.onChange({ target: { value } }); },
  };
}

test('homepage uses the progressively enhanced GET Form without overriding client navigation or native validation', () => {
  const app = homeSearch();
  assert.equal(app.form().props.action, '/cars');
  for (const prop of ['method', 'encType', 'target']) assert.equal(app.form().props[prop], undefined, `${prop} must not override Next Form navigation`);
  assert.equal(app.form().props.onSubmit, undefined, 'native validation runs before browser navigation');
  assert.deepEqual(Object.fromEntries(app.fields().map(node => [node.props.name, node.props.value])), {
    restore: '1', mode: 'cars', run: '1', sort: 'price_asc', hide_unwanted: '1', extras: '', make: '', model: '', price: '', min_price: '', year: '', postcode: '',
  });
  assert.equal(app.budget().props.required, undefined, 'a blank budget allows browsing any price');
  assert.equal(app.picker('Make').props.optional, true);
  assert.equal(app.picker('Model').props.optional, true);
  assert.deepEqual(app.landings, ['cars']);
});

test('the native budget constraint rejects decimal, exponent and formatted currency without silently changing their amount', () => {
  const app = homeSearch();
  for (const value of ['500.50', '1e3', '£5,000.00', '1234567890']) {
    app.changeBudget(value);
    const budget = app.budget();
    assert.equal(budget.props.value, value, 'the entered amount is not concatenated or truncated into a different price');
    assert.equal(budget.props.type, 'text');
    assert.equal(budget.props.maxLength, undefined, 'length errors are rejected rather than silently truncated');
    assert.equal(new RegExp(`^(?:${budget.props.pattern})$`).test(value), false);
  }
  for (const value of ['500', '1000', '5000']) {
    app.changeBudget(value);
    assert.equal(new RegExp(`^(?:${app.budget().props.pattern})$`).test(app.budget().props.value), true);
  }
  app.changeBudget('');
  assert.equal(app.budget().props.value, '');
  assert.equal(app.budget().props.required, undefined, 'empty optional inputs do not fail the native pattern constraint');
});

test('changing make clears a stale model and resetting clears visible and submitted criteria together', () => {
  const app = homeSearch();
  assert.equal(app.picker('Model').props.disabled, true);
  app.picker('Make').props.onChange('Audi');
  assert.equal(app.picker('Model').props.disabled, false);
  assert.ok(app.picker('Model').props.options.includes('A5'));
  app.picker('Model').props.onChange('A5'); app.changeBudget('5000');
  let fields = Object.fromEntries(app.fields().map(node => [node.props.name, node.props.value]));
  assert.equal(fields.make, 'Audi'); assert.equal(fields.model, 'A5'); assert.equal(fields.price, '5000');
  app.picker('Make').props.onChange('BMW');
  assert.equal(app.picker('Model').props.value, '');
  assert.equal(app.fields().find(node => node.props.name === 'model').props.value, '');
  app.form().props.onReset();
  fields = Object.fromEntries(app.fields().map(node => [node.props.name, node.props.value]));
  assert.equal(fields.make, ''); assert.equal(fields.model, ''); assert.equal(fields.price, '');
  assert.equal(app.picker('Model').props.disabled, true);
  assert.equal(fields.run, '1', 'reset preserves the intentional quick-search route behavior');
});

test('all supported homepage filters survive the native GET into the live car search, and reset restores browsing defaults', () => {
  const app = homeSearch();
  app.picker('Make').props.onChange('Volkswagen');
  app.picker('Model').props.onChange('Golf');
  for (const [name, value] of Object.entries({ min_price: '1000', price: '5000', year: '2014', postcode: 'B1 1AA', sort: 'newest' })) {
    app.input(name).props.onChange({ target: { value } });
  }
  app.extras().props.onChange(['heated_seats', 'panoramic_roof']);
  app.unwantedToggle().props.onChange({ target: { checked: false } });
  const params = app.params();
  assert.equal(params.get('extras'), 'heated_seats,panoramic_roof');
  assert.equal(params.get('hide_unwanted'), '0', 'an unchecked control must explicitly override the default');
  const landing = savedSearch.searchLandingState(params, 'cars', 'cars');
  assert.equal(landing.autoRun, true, 'the existing one-click live search still runs');
  const restored = landing.saved;
  for (const [key, value] of Object.entries({ make: 'Volkswagen', model: 'Golf', minPrice: '1000', price: '5000', year: '2014', postcode: 'B1 1AA', sort: 'newest', hideUnwanted: false, platform: 'all' })) {
    assert.equal(restored[key], value, `${key} must reach the full search unchanged`);
  }
  assert.deepEqual(Array.from(restored.carExtras), ['heated_seats', 'panoramic_roof']);
  assert.equal(nodes(app.render()).find(node => node.type === 'summary').props.children[1], ' · 8 selected');
  app.form().props.onReset();
  const reset = savedSearch.searchLandingState(app.params(), 'cars', 'cars');
  assert.equal(reset.autoRun, true);
  for (const key of ['make', 'model', 'year', 'price', 'postcode', 'minPrice']) assert.equal(reset.saved[key], key === 'minPrice' ? undefined : '');
  assert.deepEqual(Array.from(reset.saved.carExtras), []);
  assert.equal(reset.saved.sort, 'price_asc');
  assert.equal(reset.saved.hideUnwanted, true);
  assert.equal(app.unwantedToggle().props.checked, true);
});


test('homepage exposes price, year, location and shared extras inside a collapsed More filters control above its search action', () => {
  const app = homeSearch();
  const details = nodes(app.render()).find(node => node.type === 'details');
  assert.ok(details);
  assert.equal(details.props.open, undefined, 'native disclosure starts closed');
  assert.ok(nodes(details).some(node => node.type === 'input' && node.props.name === 'price'));
  for (const name of ['min_price', 'price', 'year', 'postcode', 'sort']) assert.ok(nodes(details).some(node => node.props.name === name), `${name} must be available in More filters`);
  assert.ok(nodes(details).some(node => node.type === CarExtraFilters), 'the same supported extras selector used by the full car search is available');
  assert.ok(nodes(details).some(node => node.type === 'details' && nodes(node).some(child => child.type === 'summary' && child.props.children === 'Search options')));
  const summary = () => nodes(app.render()).find(node => node.type === 'summary');
  assert.deepEqual(Array.from(summary().props.children), ['More filters', '']);
  const order = nodes(app.render());
  assert.ok(order.indexOf(order.find(node => node.type === 'details')) < order.indexOf(order.find(node => node.type === 'button' && node.props.type === 'submit')));
  app.changeBudget('5000');
  assert.deepEqual(Array.from(summary().props.children), ['More filters', ' · 1 selected']);
  assert.equal(app.fields().find(node => node.props.name === 'price').props.value, '5000', 'a closed disclosure still submits the chosen budget');
  app.form().props.onReset();
  assert.deepEqual(Array.from(summary().props.children), ['More filters', '']);
});

test('invalid homepage criteria open every containing disclosure for native validation feedback', () => {
  const app = homeSearch(), attributes = [];
  const outer = { setAttribute: (...args) => attributes.push(['outer', ...args]), parentElement: null };
  const inner = { setAttribute: (...args) => attributes.push(['inner', ...args]), parentElement: { closest: () => outer } };
  app.form().props.onInvalid({ target: { closest(selector) { assert.equal(selector, 'details'); return inner; } } });
  assert.deepEqual(attributes, [['inner', 'open', ''], ['outer', 'open', '']]);
  const postcodePattern = new RegExp(`^(?:${app.input('postcode').props.pattern})$`);
  for (const value of ['B1 1AA', 'b11aa', 'SW1A 1AA']) assert.equal(postcodePattern.test(value), true);
  for (const value of ['Birmingham', '123', 'B1']) assert.equal(postcodePattern.test(value), false);
});
