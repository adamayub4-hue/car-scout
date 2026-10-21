import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../app/support/page.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText;
const helpers = {}, extras = {}, catalogue = {}, pickerHelpers = {};
const compileHelper = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(compileHelper('../app/lib/car-extras.ts'), { exports: extras });
vm.runInNewContext(compileHelper('../app/lib/vehicle-options.ts'), { exports: catalogue });
vm.runInNewContext(compileHelper('../app/lib/vehicle-picker-options.ts'), { exports: pickerHelpers });
vm.runInNewContext(compileHelper('../app/lib/search-recovery.ts'), { exports: helpers, URLSearchParams, require(name) {
  if (name === './car-extras') return extras;
  if (name === './vehicle-options') return catalogue;
  if (name === './vehicle-picker-options') return pickerHelpers;
  throw Error(name);
} });
function harness(insert) {
  let cursor = 0;
  const slots = [{ id: 'user' }, 'suggestion', 'A title', 'Message contents', '', { current: false }, false, false, null];
  const effects = [], frames = [], location = { search: '' };
  const hooks = {
    useState() { const i = cursor++; return [slots[i], value => { slots[i] = value; }]; },
    useRef() { return slots[cursor++]; },
    useEffect(effect) { effects.push(effect); },
  };
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(code, { exports, URLSearchParams, encodeURIComponent, window: { location, requestAnimationFrame(callback) { frames.push(callback); return frames.length; }, cancelAnimationFrame() {} }, require(name) {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'next/link') return { default: 'a' };
    if (name === '../lib/saved-search') return { withRequestDeadline: request => Promise.resolve(request) };
    if (name === '../lib/search-recovery') return helpers;
    if (name === '../lib/supabase') return { isSupabaseConfigured: () => true, getSupabaseBrowserClient: () => ({ from: () => ({ insert }) }) };
    throw Error(name);
  } });
  function find(node, type) {
    if (!node || typeof node !== 'object') return;
    if (node.type === type) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, type); if (found) return found; }
  }
  const view = () => { cursor = 0; return exports.default(); };
  return { slots, find, view, form() { return find(view(), 'form'); }, prefill(search) { location.search = search; effects[0](); frames.splice(0).forEach(frame => frame()); } };
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

test('search report prefill is editable and never submits until the customer asks', async () => {
  const inserted = [];
  const h = harness(async row => { inserted.push(row); return { error: null }; });
  h.view();
  h.prefill('?report=search&search_kind=cars&marketplace=all&outcome=empty&max=1000&make_set=0&location_set=1');
  assert.equal(h.slots[1], 'problem');
  assert.equal(h.slots[2], 'Cars search problem');
  assert.match(h.slots[3], /Budget: £1,000|Budget: Up to £1,000/);
  assert.match(h.slots[3], /postcode not copied/);
  assert.equal(inserted.length, 0, 'loading a report link is never a submission');
  const form = h.form();
  h.find(form, 'textarea').props.onChange({ target: { value: h.slots[3] + '\nI expected a different result.' } });
  await h.form().props.onSubmit(event);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].subject, '[Problem] Cars search problem');
  assert.match(inserted[0].message, /I expected a different result/);
  assert.equal(h.slots[2], '');
});

test('signed-out visitors can review safe settings and open the existing email fallback without signing in', () => {
  let inserts = 0;
  const h = harness(() => { inserts++; });
  h.slots[0] = null;
  h.view();
  h.prefill('?report=search&search_kind=parts&marketplace=ebay&outcome=unavailable&part_number_set=1&body=PRIVATE');
  const tree = h.view(), nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  assert.equal(h.find(tree, 'form'), undefined);
  const email = nodes(tree).find(node => node.type === 'a' && node.props.href?.startsWith('mailto:'));
  assert.ok(email.props.href.startsWith('mailto:adamayub4@gmail.com?'));
  assert.ok(!email.props.href.includes('+'), 'mailto spaces use RFC-compatible percent encoding');
  const params = new URL(email.props.href).searchParams;
  assert.equal(params.get('subject'), 'Parts search problem');
  assert.match(params.get('body'), /Part number: set/);
  assert.doesNotMatch(params.get('body'), /PRIVATE/);
  assert.ok(h.find(tree, 'details'));
  assert.equal(inserts, 0);
});
