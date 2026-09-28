import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const helperCode = ts.transpileModule(readFileSync(new URL('../app/lib/saved-search.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const helper = {};
vm.runInNewContext(helperCode, { exports: helper, URL, URLSearchParams, setTimeout, clearTimeout });
const source = readFileSync(new URL('../app/account/page.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(name, context) {
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) {
      const initializer = node.initializer;
      expression = (ts.isCallExpression(initializer) && initializer.expression.getText(ast) === 'useCallback' ? initializer.arguments[0] : initializer).getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return vm.runInNewContext(`${code}\nrun`, { withRequestDeadline: request => Promise.resolve(request), ...context });
}

function accountHarness(reads) {
  const component = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const slots = [], effects = [], exports = {};
  let cursor = 0, mounted = false, readCount = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'test', email: 'test@example.test' } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    from(table) {
      if (table === 'saved_items') return { select: () => ({ order: () => reads[readCount++]() }) };
      assert.equal(table, 'admins');
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    },
  };
  const hooks = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useCallback: callback => callback,
    useEffect(callback) { if (!mounted) effects.push(callback); },
  };
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(component, {
    exports, URLSearchParams,
    window: { location: { search: '' }, setTimeout(callback) { callback(); return 1; }, clearTimeout() {} },
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/link') return { default: 'a' };
      if (name === '../lib/saved-search') return { ...helper, withRequestDeadline: request => Promise.resolve(request) };
      if (name === '../lib/supabase') return { getSupabaseBrowserClient: () => client, isSupabaseConfigured: () => true };
      throw Error(name);
    },
  });
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  }
  function text(node) {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    return [node?.props?.children].flat(Infinity).map(child => child ? text(child) : '').join(' ');
  }
  return {
    render() { cursor = 0; const tree = exports.default(); mounted = true; effects.splice(0).forEach(effect => effect()); return { text: text(tree), nodes: nodes(tree) }; },
    get readCount() { return readCount; },
  };
}

const settle = async () => { for (let index = 0; index < 6; index++) await Promise.resolve(); };

test('saved car and part searches round-trip through safe local links', () => {
  const car = helper.getSavedSearchUrl({ kind: 'car_search', title: 'Car', data: { make: 'Ford', model: 'Fiesta', price: '5000', postcode: 'SW1A 1AA', platform: 'all', links: { unsafe: 'javascript:alert(1)' } } });
  const parsedCar = helper.parseSavedSearchParams(new URL(car, 'https://mekivo.uk').searchParams);
  assert.equal(parsedCar.make, 'Ford'); assert.equal(parsedCar.price, '5000'); assert.equal(parsedCar.postcode, 'SW1A 1AA');
  assert.ok(!car.includes('javascript'));
  const parts = helper.getSavedSearchUrl({ kind: 'part_search', title: 'Parts', data: { make: 'VW', model: 'Golf', year: '2019', part: 'Oil Filter', partCategory: 'Engine', partMethod: 'diagram' } });
  const parsedParts = helper.parseSavedSearchParams(new URL(parts, 'https://mekivo.uk').searchParams);
  assert.equal(parsedParts.mode, 'parts'); assert.equal(parsedParts.partCategory, 'Engine'); assert.equal(parsedParts.partMethod, 'diagram');
});

test('direct part-number resume strips stale vehicle data and rejects unsafe return URLs', () => {
  const link = helper.getSavedSearchUrl({ kind: 'part_search', title: 'OEM', data: { searchMethod: 'part_number', make: 'Ford', model: 'Fiesta', year: '2018', partNumber: '1K0 698 151 F' } });
  const restored = helper.parseSavedSearchParams(new URL(link, 'https://mekivo.uk').searchParams);
  assert.equal(restored.make, ''); assert.equal(restored.model, ''); assert.equal(restored.year, ''); assert.equal(restored.partNumber, '1K0 698 151 F');
  for (const unsafe of ['javascript:alert(1)', '//evil.test/', 'https://evil.test', '/admin', '/?next=https://evil.test']) assert.equal(helper.safeSearchReturnUrl(unsafe), null);
  assert.equal(helper.safeSearchReturnUrl(link), link);
});

test('saved-data query errors keep the existing list and expose a retryable error', async () => {
  let list = [{ id: 'existing' }], loading, error;
  const run = handler('loadItems', {
    getSupabaseBrowserClient: () => ({ from: () => ({ select: () => ({ order: async () => ({ data: null, error: { message: 'offline' } }) }) }) }),
    itemsRequest: { current: 0 }, setItems: value => { list = value; }, setItemsLoading: value => { loading = value; }, setItemsError: value => { error = value; },
  });
  await run();
  assert.equal(list[0].id, 'existing'); assert.equal(loading, false); assert.match(error, /not been removed/);
});

test('saved-list failures render an error instead of empty and Retry restores the list', async () => {
  for (const failedRead of [
    async () => ({ data: null, error: { message: 'offline' } }),
    async () => ({ data: null, error: null }),
    async () => { throw Error('Network failure'); },
  ]) {
    let finishRetry;
    const h = accountHarness([failedRead, () => new Promise(resolve => { finishRetry = resolve; })]);
    h.render(); await settle();
    const failed = h.render();
    assert.ok(failed.nodes.some(node => node.props?.role === 'alert'));
    assert.match(failed.text, /could not load your saved searches/);
    assert.doesNotMatch(failed.text, /Nothing saved yet/);
    const retry = failed.nodes.find(node => node.type === 'button' && node.props.children === 'Retry saved searches');
    assert.ok(retry, 'the error must offer a usable retry');
    retry.props.onClick();
    assert.match(h.render().text, /Loading your saved searches/);
    assert.doesNotMatch(h.render().text, /Nothing saved yet/);
    finishRetry({ data: [{ id: 'saved', kind: 'car_search', title: 'My Fiesta search', data: { make: 'Ford', model: 'Fiesta' }, created_at: '2026-09-21T12:00:00Z' }], error: null });
    await settle();
    const restored = h.render();
    assert.match(restored.text, /My Fiesta search/);
    assert.doesNotMatch(restored.text, /could not load|Nothing saved yet|Loading your saved searches/);
    assert.equal(h.readCount, 2);
  }
});

test('only a successful empty saved-list response renders Nothing saved yet', async () => {
  const h = accountHarness([async () => ({ data: [], error: null })]);
  h.render(); await settle();
  const empty = h.render();
  assert.match(empty.text, /Nothing saved yet/);
  assert.ok(!empty.nodes.some(node => node.props?.role === 'alert'));
});

test('a stale saved-list failure cannot replace a newer successful result', async () => {
  let rejectOlder, resolveNewer, list = [], error = '', loading = false, reads = 0;
  const responses = [new Promise((_resolve, reject) => { rejectOlder = reject; }), new Promise(resolve => { resolveNewer = resolve; })];
  const run = handler('loadItems', {
    getSupabaseBrowserClient: () => ({ from: () => ({ select: () => ({ order: () => responses[reads++] }) }) }),
    itemsRequest: { current: 0 }, setItems: value => { list = value; }, setItemsLoading: value => { loading = value; }, setItemsError: value => { error = value; },
  });
  const older = run(), newer = run();
  resolveNewer({ data: [{ id: 'newer' }], error: null }); await newer;
  rejectOlder(Error('Late network error')); await older;
  assert.equal(list[0].id, 'newer'); assert.equal(error, ''); assert.equal(loading, false);
});

test('data export never downloads an incomplete response and releases its action guard', async () => {
  let downloaded = false, message = '', busy = '';
  const guard = { current: false };
  const query = { select() { return this; }, eq() { return this; }, order() { return this; }, range: async () => ({ data: null, error: { message: 'offline' } }) };
  const run = handler('exportData', {
    getSupabaseBrowserClient: () => ({ from: () => query }), user: { id: 'test' }, actionRunning: guard,
    setBusyAction: value => { busy = value; }, setMessage: value => { message = value; },
    Blob, URL: { createObjectURL() { downloaded = true; return 'blob:test'; } },
  });
  await run();
  assert.equal(downloaded, false); assert.match(message, /no incomplete export/); assert.equal(guard.current, false); assert.equal(busy, '');
});

test('data export reads beyond the first database page before creating the download', async () => {
  const ranges = [], output = [];
  let downloads = 0;
  const run = handler('exportData', {
    getSupabaseBrowserClient: () => ({ from: table => ({ select() { return this; }, eq() { return this; }, order() { return this; }, async range(from, to) { ranges.push([table, from, to]); return { data: Array.from({ length: table === 'activity_events' && from === 0 ? 500 : 1 }, (_, i) => ({ id: from + i })), error: null }; } }) }),
    user: { id: 'test' }, actionRunning: { current: false }, setBusyAction() {}, setMessage() {},
    Blob: class { constructor(data) { output.push(JSON.parse(data[0])); } },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, document: { createElement: () => ({ click() { downloads++; } }) }, window: { setTimeout: fn => fn() },
  });
  await run();
  assert.equal(downloads, 1); assert.equal(output[0].activity.length, 501); assert.ok(ranges.some(([table, from]) => table === 'activity_events' && from === 500));
});

test('request deadlines release a stalled account action', async () => {
  await assert.rejects(helper.withRequestDeadline(new Promise(() => {}), 5), /timed out/);
});
