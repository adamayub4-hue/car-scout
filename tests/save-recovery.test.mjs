import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync(new URL('../app/components/save-button.tsx', import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function harness(client, audience = 'included') {
  let cursor = 0;
  const slots = [], redirects = [], exports = {};
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react') return { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; }, useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; } };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'next/navigation') return { useRouter: () => ({ push: value => redirects.push(value) }) };
    if (name === '../lib/supabase') return { getSupabaseBrowserClient: () => client };
    if (name === '../lib/analytics-audience') return { analyticsAudience: () => audience };
    if (name === '../lib/saved-search') return { withRequestDeadline: request => Promise.resolve(request), getSavedSearchUrl: () => '/?restore=1&mode=cars&make=Ford' };
    throw Error(name);
  } });
  const render = () => { cursor = 0; return exports.default({ item: { kind: 'car_search', title: 'Ford', data: { make: 'Ford' } } }); };
  return { slots, redirects, button: () => render().props.children[0] };
}

test('rejected saves are retryable and never remain Saving', async () => {
  let calls = 0;
  const h = harness({ auth: { getUser: async () => ({ data: { user: { id: 'test' } } }) }, from: () => ({ insert: async () => { calls++; throw Error('offline'); } }) });
  await h.button().props.onClick();
  assert.equal(h.button().props.disabled, false); assert.match(h.slots[1], /could not confirm/);
  await h.button().props.onClick(); assert.equal(calls, 2);
});

test('signed-out saves retain the original search in the sign-in return URL', async () => {
  const h = harness({ auth: { getUser: async () => ({ data: { user: null } }) } });
  await h.button().props.onClick();
  assert.equal(new URL(h.redirects[0], 'https://mekivo.uk').searchParams.get('returnTo'), '/?restore=1&mode=cars&make=Ford');
});

test('the in-flight save guard blocks duplicate inserts before React rerenders', async () => {
  let finish, calls = 0;
  const h = harness({ auth: { getUser: async () => ({ data: { user: { id: 'test' } } }) }, from: table => ({ insert: () => table === 'activity_events' ? Promise.resolve({ error: null }) : new Promise(resolve => { calls++; finish = resolve; }) }) });
  const submit = h.button().props.onClick;
  const pending = submit(); await Promise.resolve(); await Promise.resolve();
  await submit(); assert.equal(calls, 1);
  finish({ error: null }); await pending; assert.equal(h.button().props.children, '✓ Saved');
});

test('a synchronous optional tracking failure cannot undo a confirmed save', async () => {
  const h = harness({ auth: { getUser: async () => ({ data: { user: { id: 'test' } } }) }, from: table => {
    if (table === 'activity_events') throw Error('tracking unavailable');
    return { insert: async () => ({ error: null }) };
  } });
  await h.button().props.onClick(); await Promise.resolve();
  assert.equal(h.button().props.children, '✓ Saved');
});

test('an excluded owner can still save without adding an activity event', async () => {
  const tables = [];
  const h = harness({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from: table => {
    tables.push(table);
    return { insert: async () => ({ error: null }) };
  } }, 'excluded');
  await h.button().props.onClick(); await Promise.resolve();
  assert.equal(h.button().props.children, '✓ Saved');
  assert.deepEqual(tables, ['saved_items']);
});
