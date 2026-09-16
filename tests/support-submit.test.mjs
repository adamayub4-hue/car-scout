import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../app/support/page.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText;
function harness(insert) {
  let cursor = 0;
  const slots = [{ id: 'user' }, 'suggestion', 'A title', 'Message contents', '', { current: false }, false, false];
  const hooks = {
    useState() { const i = cursor++; return [slots[i], value => { slots[i] = value; }]; },
    useRef() { return slots[cursor++]; },
    useEffect() {},
  };
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'next/link') return { default: 'a' };
    if (name === '../lib/saved-search') return { withRequestDeadline: request => Promise.resolve(request) };
    if (name === '../lib/supabase') return { isSupabaseConfigured: () => true, getSupabaseBrowserClient: () => ({ from: () => ({ insert }) }) };
    throw Error(name);
  } });
  function find(node, type) {
    if (!node || typeof node !== 'object') return;
    if (node.type === type) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, type); if (found) return found; }
  }
  return { slots, form() { cursor = 0; return find(exports.default(), 'form'); } };
}
const event = { preventDefault() {} };
test('blocks duplicate submissions while pending and clears fields after success', async () => {
  let finish, calls = 0;
  const h = harness(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const submit = h.form().props.onSubmit;
  const pending = submit(event);
  await submit(event);
  assert.equal(calls, 1);
  assert.equal(h.slots[6], true);
  finish({ error: null });
  await pending;
  assert.equal(h.slots[2], '');
  assert.equal(h.slots[3], '');
  assert.equal(h.slots[6], false);
});
test('rejected request preserves text and permits another attempt', async () => {
  let calls = 0;
  const h = harness(async () => { calls++; throw Error('Network failure'); });
  await h.form().props.onSubmit(event);
  assert.match(h.slots[4], /could not confirm/);
  assert.equal(h.slots[2], 'A title');
  assert.equal(h.slots[3], 'Message contents');
  assert.equal(h.slots[6], false);
  await h.form().props.onSubmit(event);
  assert.equal(calls, 2);
});
test('returned rate-limit error preserves text and releases submission guard', async () => {
  const h = harness(async () => ({ error: { message: 'limit reached' } }));
  await h.form().props.onSubmit(event);
  assert.match(h.slots[4], /hour/);
  assert.equal(h.slots[3], 'Message contents');
  assert.equal(h.slots[5].current, false);
  assert.equal(h.slots[6], false);
});

test('support enforces the stored title limit including its category prefix', async () => {
  const inserted = [];
  const h = harness(async row => { inserted.push(row); return { error: null }; });
  h.slots[2] = 'x'.repeat(108);
  await h.form().props.onSubmit(event);
  assert.equal(inserted.length, 0);
  assert.match(h.slots[4], /3–107/);
  assert.equal(h.slots[2].length, 108);
  h.slots[2] = 'x'.repeat(107);
  await h.form().props.onSubmit(event);
  assert.equal(inserted[0].subject.length, 120);
  h.slots[1] = 'problem'; h.slots[2] = 'x'.repeat(110); h.slots[3] = 'Problem details';
  await h.form().props.onSubmit(event);
  assert.equal(inserted[1].subject.length, 120);
});
