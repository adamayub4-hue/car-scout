import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/components/search-experience.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('search-experience.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(predicate) {
  const matches = [];
  function visit(node) {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(matches.length, 1, 'use exactly one actual component handler');
  return matches[0];
}
const named = name => find(node => ts.isVariableDeclaration(node) && node.name.getText(ast) === name).initializer.getText(ast);
const attribute = (node, name) => (ts.isJsxElement(node) ? node.openingElement : node).attributes.properties.find(item => item.name?.getText(ast) === name);
function jsxHandler(tag, event, predicate) {
  const node = find(item => (ts.isJsxElement(item) || ts.isJsxSelfClosingElement(item))
    && (ts.isJsxElement(item) ? item.openingElement : item).tagName.getText(ast) === tag
    && attribute(item, event)?.initializer?.expression && predicate(item));
  return attribute(node, event).initializer.expression.getText(ast);
}
const makeChange = jsxHandler('VehiclePicker', 'onChange', node => attribute(node, 'id')?.initializer?.text === 'parts-make');
const modelChange = jsxHandler('VehiclePicker', 'onChange', node => attribute(node, 'id')?.initializer?.text === 'parts-model');
const yearChange = jsxHandler('select', 'onChange', node => /setYear\(event\.target\.value\)/.test(attribute(node, 'onChange').initializer.expression.getText(ast))
  && attribute(node, 'onChange').initializer.expression.getText(ast).includes('resetPartsBelowVehicle'));
const fuelChange = jsxHandler('select', 'onChange', node => attribute(node, 'onChange').initializer.expression.getText(ast).includes('setFuel'));
const partEdit = jsxHandler('input', 'onChange', node => attribute(node, 'value')?.initializer?.expression?.getText(ast) === 'part');
const methodChoice = jsxHandler('button', 'onClick', node => attribute(node, 'onClick').initializer.expression.getText(ast).includes('setPartMethod(id)'));
const quickGuide = jsxHandler('button', 'onClick', node => attribute(node, 'aria-label')?.initializer?.text === 'Browse the parts picture guide');

function harness(initial = {}) {
  const state = {
    make: '', model: '', year: '', engine: '', fuel: '', bodyStyle: '', registration: 'AB12 CDE',
    partMethod: '', part: '', lensPartName: '', partNumber: 'stale-part-number', partCategory: 'stale-category',
    showResults: true, error: 'stale-error', vehicleDetailsOpen: false, vehicleLookup: null, vehicleLookupLoading: false,
    ...initial,
  };
  const calls = [], events = [], scrolls = [], focus = [];
  const context = {
    AbortController, Error, requestAnimationFrame: callback => callback(),
    vehicleFieldsRef: { current: { scrollIntoView: options => scrolls.push(options) } },
    partNameRef: { current: state.make && state.model && state.year ? {
      scrollIntoView: options => scrolls.push(options), focus: options => focus.push(options),
    } : null }, guideRef: { current: null }, vehicleLookupRequest: { current: { id: 0, controller: null } },
    makes: { Audi: ['A3'], Ford: ['Fiesta'] },
    trackGrowthEvent: (...args) => events.push(args), trackActivity: (...args) => events.push(args),
    createPartSearch() { assert.fail('Accepting a Lens name or adding a vehicle must not construct a search'); },
    searchEbay() { assert.fail('Accepting a Lens name or adding a vehicle must not send a listing search'); },
    fetch: async (url, options) => {
      assert.equal(url, '/api/vehicle'); calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ vehicle: {
        registrationNumber: 'AB12CDE', make: 'AUDI', model: 'A3', yearOfManufacture: 2018,
        fuelType: 'DIESEL', engineCapacity: 1968,
      } }) };
    },
  };
  for (const key of Object.keys(state)) {
    Object.defineProperty(context, key, { get: () => state[key], configurable: true });
    context[`set${key[0].toUpperCase()}${key.slice(1)}`] = value => { state[key] = value; };
  }
  function run(expression) {
    const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
    return vm.runInNewContext(`(() => { ${code}\nreturn run; })()`, context);
  }
  context.resetPartsBelowVehicle = run(named('resetPartsBelowVehicle'));
  return {
    state, calls, events, scrolls, focus, choose: run(named('chooseLensPart')), lookup: run(named('handleVehicleLookup')),
    make: run(makeChange), model: run(modelChange), year: run(yearChange), fuel: run(fuelChange), edit: run(partEdit),
    reset: context.resetPartsBelowVehicle, quickGuide: run(quickGuide),
    method(id) { context.id = id; run(methodChoice)(); },
  };
}
const event = value => ({ target: { value } });
function preserved(app, name = 'Brake caliper') {
  assert.equal(app.state.part, name);
  assert.equal(app.state.lensPartName, name);
  assert.equal(app.state.partMethod, 'search');
  assert.equal(app.state.partNumber, ''); assert.equal(app.state.partCategory, '');
  assert.equal(app.state.showResults, false); assert.equal(app.state.error, '');
  assert.equal(app.events.some(([name]) => name === 'search_submitted' || name === 'part_search'), false);
}

test('accepting a Lens name survives manual make, model and year entry without submitting a search', () => {
  const app = harness();
  app.choose('Brake caliper');
  preserved(app); assert.equal(app.state.vehicleDetailsOpen, true); assert.equal(app.scrolls.length, 1);
  app.make('Audi'); preserved(app);
  app.model('A3'); preserved(app);
  app.year(event('2018')); preserved(app);
  assert.deepEqual([app.state.make, app.state.model, app.state.year], ['Audi', 'A3', '2018']);
  assert.equal(app.calls.length, 0); assert.equal(app.events.length, 0);
});

test('accepting a Lens name survives successful registration lookup without submitting a listing search', async () => {
  const app = harness(); app.choose('Brake caliper');
  await app.lookup();
  preserved(app);
  assert.deepEqual([app.state.make, app.state.model, app.state.year, app.state.fuel], ['Audi', 'A3', '2018', 'Diesel']);
  assert.equal(app.state.vehicleLookupLoading, false);
  assert.equal(app.calls.length, 1);
  assert.deepEqual(JSON.parse(app.calls[0].options.body), { registrationNumber: 'AB12CDE' });
  assert.deepEqual(app.events.map(([name]) => name), ['vehicle_lookup_success', 'vehicle_lookup']);
});

test('an already selected vehicle hands the Lens name to the editable part field without another lookup', () => {
  const app = harness({ make: 'Audi', model: 'A3', year: '2018' });
  app.choose('Brake caliper');
  preserved(app);
  assert.equal(app.state.vehicleDetailsOpen, true);
  assert.equal(app.scrolls.length, 1);
  assert.equal(app.focus.length, 1);
  assert.equal(app.focus[0].preventScroll, true);
  assert.equal(app.calls.length, 0); assert.equal(app.events.length, 0);
});

test('optional fuel edits preserve an accepted general Lens name while removing stale category and part number', () => {
  const app = harness(); app.choose('Brake caliper');
  app.fuel(event('Diesel'));
  preserved(app); assert.equal(app.state.fuel, 'Diesel');
  assert.equal(app.calls.length, 0); assert.equal(app.events.length, 0);
});

test('manual part-name editing clears Lens provenance even when the customer retypes the same name', () => {
  for (const edited of ['Oil filter', 'Brake caliper']) {
    const app = harness(); app.choose('Brake caliper'); app.edit(event(edited));
    assert.equal(app.state.lensPartName, ''); assert.equal(app.state.part, edited);
    app.reset();
    assert.equal(app.state.part, ''); assert.equal(app.state.partMethod, '');
    assert.equal(app.calls.length, 0); assert.equal(app.events.length, 0);
  }
});

test('unrelated direct entries and mismatched stale markers retain the previous vehicle-reset behavior', () => {
  for (const marker of ['', 'Brake caliper']) {
    const app = harness();
    Object.assign(app.state, { partMethod: 'search', part: 'Oil filter', lensPartName: marker, partNumber: '06J115403Q', partCategory: 'Engine' });
    app.reset();
    assert.equal(app.state.part, ''); assert.equal(app.state.partMethod, '');
    assert.equal(app.state.partNumber, ''); assert.equal(app.state.partCategory, '');
    assert.equal(app.calls.length, 0); assert.equal(app.events.length, 0);
  }
});

test('method cards clear the Lens marker before a different search method can reuse a stale name', () => {
  for (const method of ['diagram', 'catalogue', 'search']) {
    const app = harness(); app.choose('Brake caliper'); app.method(method);
    assert.equal(app.state.lensPartName, ''); assert.equal(app.state.partMethod, method);
    assert.equal(app.state.part, ''); assert.equal(app.state.partNumber, ''); assert.equal(app.state.partCategory, '');
    if (method === 'search') {
      app.edit(event('Brake caliper')); app.reset();
      assert.equal(app.state.part, '', 'an old accepted name is ordinary manual input after changing method');
    }
    assert.equal(app.calls.length, 0); assert.equal(app.events.length, 0);
  }
});

test('the standalone picture-guide action clears Lens provenance too', () => {
  const app = harness(); app.choose('Brake caliper'); app.quickGuide();
  assert.equal(app.state.lensPartName, ''); assert.equal(app.state.partMethod, 'diagram');
  assert.equal(app.calls.length, 0); assert.equal(app.events.length, 0);
});
