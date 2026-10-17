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
function helper(path) {
  const exports = {};
  vm.runInNewContext(compile(path), { exports });
  return exports;
}
const options = helper('../app/lib/vehicle-options.ts');
const pickerOptions = helper('../app/lib/vehicle-picker-options.ts');
const VehiclePicker = () => null;
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
    picker: label => one(node => node.type === VehiclePicker && node.props.label === label),
    fields: () => nodes(render()).filter(node => node.type === 'input' && node.props.name),
    changeBudget(value) { this.budget().props.onChange({ target: { value } }); },
  };
}

test('homepage uses the progressively enhanced GET Form without overriding client navigation or native validation', () => {
  const app = homeSearch();
  assert.equal(app.form().props.action, '/cars');
  for (const prop of ['method', 'encType', 'target']) assert.equal(app.form().props[prop], undefined, `${prop} must not override Next Form navigation`);
  assert.equal(app.form().props.onSubmit, undefined, 'native validation runs before browser navigation');
  assert.deepEqual(Object.fromEntries(app.fields().map(node => [node.props.name, node.props.value])), {
    restore: '1', mode: 'cars', run: '1', sort: 'price_asc', hide_unwanted: '1', make: '', model: '', price: '',
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


test('homepage keeps budget inside a collapsed More filters control above its search action', () => {
  const app = homeSearch();
  const details = nodes(app.render()).find(node => node.type === 'details');
  assert.ok(details);
  assert.equal(details.props.open, undefined, 'native disclosure starts closed');
  assert.ok(nodes(details).some(node => node.type === 'input' && node.props.name === 'price'));
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

test('invalid homepage budget opens its filter disclosure for native validation feedback', () => {
  const app = homeSearch(), attributes = [];
  app.budget().props.onInvalid({ currentTarget: { closest(selector) { assert.equal(selector, 'details'); return { setAttribute: (...args) => attributes.push(args) }; } } });
  assert.deepEqual(attributes, [['open', '']]);
});
