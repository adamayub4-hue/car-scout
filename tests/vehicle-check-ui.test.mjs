import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

const source = readFileSync(new URL('../app/components/vehicle-check.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
function nodes(node, found = []) {
  if (Array.isArray(node)) node.forEach(child => nodes(child, found));
  else if (node?.props) { found.push(node); nodes(node.props.children, found); }
  return found;
}
const flush = () => new Promise(resolve => setImmediate(resolve));

// Exercise the real component with delayed mock responses and no browser,
// analytics, storage or provider access.
function checker() {
  let cursor = 0, mounted = false;
  const slots = [], requests = [], cleanups = [];
  const exports = {};
  vm.runInNewContext(compiled, { exports, AbortController, Date, Intl, Error,
    fetch(url, options) { return new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })); },
    require(name) {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'react') return {
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
        useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
        useEffect(effect) { cursor++; if (!mounted) cleanups.push(effect()); },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const render = () => { cursor = 0; const tree = exports.default(); mounted = true; return tree; };
  const one = predicate => { const matches = nodes(render()).filter(predicate); assert.equal(matches.length, 1); return matches[0]; };
  render();
  return {
    requests, text: () => text(render()), nodes: () => nodes(render()),
    input: () => one(node => node.type === 'input'),
    button: () => one(node => node.type === 'button'),
    change(value) { this.input().props.onChange({ target: { value } }); },
    submit() { return one(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); },
    async respond(index, body, status = 200) { requests[index].resolve({ ok: status >= 200 && status < 300, status, json: async () => body }); await flush(); },
    unmount() { cleanups.forEach(cleanup => cleanup?.()); },
  };
}

test('standalone check normalises the plate and shows supplied tax/MOT dates and vehicle details', async () => {
  const app = checker();
  app.change('ab12 cde'); const pending = app.submit();
  assert.equal(app.requests[0].url, '/api/vehicle');
  assert.equal(app.requests[0].options.method, 'POST');
  assert.equal(app.requests[0].options.cache, 'no-store');
  assert.deepEqual(JSON.parse(app.requests[0].options.body), { registrationNumber: 'AB12CDE' });
  assert.equal(app.button().props.disabled, true);
  await app.respond(0, { vehicle: { make: 'FORD', model: 'FOCUS', yearOfManufacture: 2014, colour: 'BLUE', fuelType: 'DIESEL', engineCapacity: 1560,
    taxStatus: 'Taxed', taxDueDate: '2027-02-01', motStatus: 'Valid', motExpiryDate: '2027-06-18' } });
  await pending;
  assert.match(app.text(), /2014 · FORD · FOCUS/);
  assert.match(app.text(), /TaxedTax due: 1 February 2027/);
  assert.match(app.text(), /ValidMOT expires: 18 June 2027/);
  assert.match(app.text(), /1,560cc/);
  assert.equal(app.input().props.value, 'AB12CDE');
  assert.equal(app.button().props.disabled, false);
});

test('absent statuses, model and dates remain unknown, and invalid dates are not silently corrected', async () => {
  for (const date of [undefined, '2027-02-30', 'not-a-date']) {
    const app = checker(); app.change('AB12CDE'); const pending = app.submit();
    await app.respond(0, { vehicle: { make: 'FORD', motExpiryDate: date, taxDueDate: date } }); await pending;
    assert.match(app.text(), /Vehicle taxNot providedTax due: Not provided/);
    assert.match(app.text(), /MOTNot providedMOT expires: Not provided/);
    assert.match(app.text(), /ModelNot provided/);
    assert.doesNotMatch(app.text(), /Valid|Taxed|March 2027/);
  }
});

test('changing registration immediately clears the old result and rejects a cancelled request arriving late', async () => {
  const app = checker(); app.change('AB12CDE'); const first = app.submit();
  app.change('XY14ZZZ');
  assert.equal(app.requests[0].options.signal.aborted, true);
  assert.equal(app.button().props.disabled, false);
  const second = app.submit();
  await app.respond(1, { vehicle: { make: 'AUDI', taxStatus: 'Untaxed', motStatus: 'Not valid' } }); await second;
  await app.respond(0, { vehicle: { make: 'FORD', taxStatus: 'Taxed', motStatus: 'Valid' } }); await first;
  assert.match(app.text(), /AUDI/); assert.doesNotMatch(app.text(), /FORD/);
  app.change('CD16AAA');
  assert.doesNotMatch(app.text(), /AUDI|Vehicle taxUntaxed/);
});

test('validation, unknown vehicles, rate limits and service failures offer useful errors without redirecting to a parts form', async () => {
  const invalid = checker(); invalid.change('X'); await invalid.submit();
  assert.equal(invalid.requests.length, 0); assert.match(invalid.text(), /Enter a valid UK registration/);
  for (const [status, expected] of [[404, /Check the registration/], [429, /wait a minute/], [503, /temporarily unavailable/]]) {
    const app = checker(); app.change('AB12CDE'); const pending = app.submit();
    await app.respond(0, { error: 'Please use Make & model for now.' }, status); await pending;
    assert.match(app.text(), expected); assert.doesNotMatch(app.text(), /Make & model/);
    assert.equal(app.button().props.disabled, false);
    assert.equal(app.input().props['aria-invalid'], true);
    assert.ok(app.nodes().some(node => node.props?.role === 'alert'));
  }
});

test('leaving the check aborts the in-flight request and suppresses a late result', async () => {
  const app = checker(); app.change('AB12CDE'); const pending = app.submit();
  app.unmount(); assert.equal(app.requests[0].options.signal.aborted, true);
  await app.respond(0, { vehicle: { make: 'FORD' } }); await pending;
  assert.doesNotMatch(app.text(), /FORD/);
});
