import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual page handlers with controlled Supabase responses.
// This lightweight hook harness is not a substitute for browser layout QA.
const code = ts.transpileModule(readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function harness(options = {}) {
  let cursor = 0, mounted = false;
  const slots = [], effects = [], calls = [];
  const result = (table, config, update) => {
    calls.push({ table, config, update });
    if (options.hang === table) return new Promise(() => {});
    if (options.fail === table) return { data: null, error: { message: 'Unavailable' }, count: null };
    if (options.reject === table) throw new Error('Network failure');
    if (table === 'admins') return { data: options.denied ? null : { user_id: 'owner' }, error: null };
    if (update) return options.saveFail ? { data: null, error: { message: 'Denied' } } : { data: { id: 'report', status: update.status }, error: null };
    const data = table === 'complaints' && !config?.head && options.report ? [{ id: 'report', user_id: 'owner', subject: 'Test report', message: 'Example', status: 'open', created_at: '2026-08-31' }] : [];
    return { data, error: null, count: config?.count ? (options.nullCount ? null : (config.head ? Number(!!options.report) : 1234)) : null };
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: options.signedOut ? null : { id: 'owner' } }, error: options.authError ? { message: 'Auth unavailable' } : null }) },
    from(table) {
      let config, update;
      const query = {
        select(_columns, selected) { config = selected; return query; },
        update(value) { update = value; return query; },
        eq() { return query; }, neq() { return query; }, order() { return query; }, limit() { return query; },
        maybeSingle() { return query; }, single() { return query; },
        then(resolve, reject) { return Promise.resolve().then(() => result(table, config, update)).then(resolve, reject); },
      };
      return query;
    },
  };
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useMemo(fn) { return fn(); },
    useEffect(fn) { if (!mounted) effects.push(fn); },
  };
  const exports = {};
  const jsx = (type, props) => ({ type, props: props || {} });
  vm.runInNewContext(code, {
    exports, setTimeout: (fn, delay) => setTimeout(fn, options.fastDeadline && delay === 15000 ? 1 : delay), clearTimeout, window: { setTimeout, clearTimeout },
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/link') return { default: 'a' };
      if (name === '../lib/supabase') return { getSupabaseBrowserClient: () => options.noClient ? null : client };
      throw new Error(name);
    },
  });
  const render = () => { cursor = 0; const tree = exports.default(); if (!mounted) { mounted = true; effects.forEach(fn => fn()); } return tree; };
  return { render, calls, options };
}
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]; }
function text(tree) { return tree == null ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(text).join(' ') : text(tree.props?.children); }
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function loaded(options) { const h = harness(options); assert.match(text(h.render()), /Loading dashboard/); await tick(); return h; }

test('success uses exact totals instead of list length', async () => {
  const h = await loaded({}); const output = text(h.render());
  assert.match(output, /1234 Users/); assert.match(output, /1234 Saved items/);
  assert.match(output, /0 Open feedback/); assert.match(output, /No feedback submitted/);
  assert.match(output, /Recent activity \(up to 100\)/);
});
for (const table of ['profiles', 'complaints', 'activity_events', 'saved_items', 'admins']) {
  test(`${table} failure never appears as an empty dashboard`, async () => {
    const h = await loaded({ fail: table }); const output = text(h.render());
    assert.match(output, /Dashboard unavailable/); assert.doesNotMatch(output, /No feedback submitted|0 Open feedback/);
    h.options.fail = null;
    await nodes(h.render()).find(n => n.type === 'button').props.onClick(); await tick();
    assert.match(text(h.render()), /Mekivo control centre/);
  });
}
for (const options of [{ authError: true }, { noClient: true }, { nullCount: true }, { reject: 'complaints' }]) {
  test(`unavailable service is explicit: ${JSON.stringify(options)}`, async () => {
    const h = await loaded(options); assert.match(text(h.render()), /Dashboard unavailable/);
  });
}
for (const options of [{ denied: true }, { signedOut: true }, { signedOut: true, authError: true }]) {
  test(`non-owner cannot load private records: ${JSON.stringify(options)}`, async () => {
    const h = await loaded(options); assert.match(text(h.render()), /Owner access only/);
    assert.ok(h.calls.every(c => c.table === 'admins'));
  });
}
test('failed status change keeps confirmed status and requires refresh', async () => {
  const h = await loaded({ report: true, saveFail: true });
  await nodes(h.render()).find(n => n.type === 'select').props.onChange({ target: { value: 'resolved' } }); await tick();
  const tree = h.render(); assert.match(text(tree), /status change could not be confirmed/);
  const select = nodes(tree).find(n => n.type === 'select');
  assert.equal(select.props.value, 'open'); assert.equal(select.props.disabled, true);
  assert.match(text(tree), /1 Open feedback/);
});
test('confirmed status change updates report and open count', async () => {
  const h = await loaded({ report: true });
  await nodes(h.render()).find(n => n.type === 'select').props.onChange({ target: { value: 'resolved' } }); await tick();
  assert.equal(nodes(h.render()).find(n => n.type === 'select').props.value, 'resolved');
  assert.match(text(h.render()), /0 Open feedback/);
});
test('a stalled request times out and can be retried', async () => {
  const h = await loaded({ hang: 'complaints', fastDeadline: true });
  for (let i = 0; i < 20 && /Loading dashboard/.test(text(h.render())); i++) await tick();
  assert.match(text(h.render()), /Dashboard unavailable/);
  h.options.hang = null;
  await nodes(h.render()).find(n => n.type === 'button').props.onClick(); await tick();
  assert.match(text(h.render()), /Mekivo control centre/);
});
