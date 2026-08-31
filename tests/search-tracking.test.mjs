import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(name, context) {
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) expression = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return vm.runInNewContext(`${code}\nrun`, context);
}

for (const name of ['handleCarSearch', 'handlePartsSearch', 'handlePartNumberSearch']) {
  test(`${name} starts eBay without waiting for stalled analytics`, async () => {
    const searches = [], events = [];
    const ctx = {
      make: 'Audi', model: 'A3', year: '2018', price: '', postcode: '', platform: 'all',
      vehicleReady: true, vehicleLabel: '2018 Audi A3', engine: '', fuel: '', bodyStyle: '',
      part: 'oil filter', partCategory: '', partNumber: '06J115403Q',
      setError() {}, setShowResults() {}, setPartNumber() {}, setPartMethod() {}, setPartCategory() {}, setPart() {},
      trackActivity: (...args) => { events.push(args); return new Promise(() => {}); },
      searchEbay: (...args) => searches.push(args),
    };
    // Side effects must happen in the click's synchronous turn, not after telemetry.
    const pending = handler(name, ctx)();
    assert.equal(events.length, 1);
    assert.equal(searches.length, 1);
    await pending;
  });
}
test('external marketplace opens in the click turn despite stalled analytics', async () => {
  const opened = [];
  const pending = handler('handleCarSearch', {
    make: 'Audi', model: 'A3', year: '', price: '', postcode: '', platform: 'autotrader',
    setError() {}, setShowResults() {}, trackActivity: () => new Promise(() => {}),
    carLinks: { autotrader: 'https://example.com/search' }, window: { open: (...args) => opened.push(args) },
  })();
  assert.equal(opened.length, 1);
  await pending;
});
for (const kind of ['session rejection', 'insert rejection', 'missing client', 'signed out']) {
  test(`optional tracking handles ${kind}`, async () => {
    let inserts = 0;
    const fn = handler('trackActivity', {
      getSupabaseBrowserClient: () => kind === 'missing client' ? null : {
        auth: { getSession: async () => { if (kind === 'session rejection') throw new Error('offline'); return { data: { session: kind === 'signed out' ? null : { user: { id: 'test' } } } }; } },
        from: () => ({ insert: async () => { inserts++; throw new Error('offline'); } }),
      },
    });
    await assert.doesNotReject(() => fn('car_search', {}));
    assert.equal(inserts, kind === 'insert rejection' ? 1 : 0);
  });
}

for (const telemetry of ['stalled', 'rejected']) {
  test(`confirmed save succeeds with ${telemetry} tracking`, async () => {
    const saveSource = readFileSync(new URL('../app/components/save-button.tsx', import.meta.url), 'utf8');
    const code = ts.transpileModule(saveSource, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const slots = []; let cursor = 0;
    const exports = {};
    const jsx = (type, props) => ({ type, props });
    vm.runInNewContext(code, { exports, require(name) {
      if (name === 'react') return { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => slots[i] = v]; } };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/navigation') return { useRouter: () => ({ push() { throw new Error('Unexpected redirect'); } }) };
      if (name === '../lib/supabase') return { getSupabaseBrowserClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'test' } } }) },
        from: table => ({ insert: () => table === 'saved_items' ? Promise.resolve({ error: null }) : telemetry === 'stalled' ? new Promise(() => {}) : Promise.reject(new Error('offline')) }),
      }) };
      throw new Error(name);
    } });
    const render = () => { cursor = 0; return exports.default({ item: { kind: 'car_search', title: 'Test', data: {} } }); };
    const button = render().props.children[0];
    await button.props.onClick();
    assert.equal(render().props.children[0].props.children, '✓ Saved');
  });
}
