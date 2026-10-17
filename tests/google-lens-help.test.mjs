import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

const transpile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const code = transpile('../app/components/google-lens-help.tsx');
const draftCode = transpile('../app/lib/lens-return.ts');
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
function nodes(node, result = []) {
  if (Array.isArray(node)) node.forEach(child => nodes(child, result));
  else if (node?.props) { result.push(node); nodes(node.props.children, result); }
  return result;
}
const sameDeps = (left, right) => left && right && left.length === right.length && left.every((value, i) => value === right[i]);
function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

// Exercise the real component handlers and storage helper without any network.
// Native navigation remains the browser's job: the anchor must not cancel it.
function help({ storage = memoryStorage() } = {}) {
  let cursor = 0, tree, focused, frameId = 0;
  const slots = [], elements = new Map(), names = [], calls = [], effects = [], frames = new Map();
  const exports = {}, draftExports = {}, window = { sessionStorage: storage };
  vm.runInNewContext(draftCode, { exports: draftExports, window, Date });
  vm.runInNewContext(code, {
    exports, window,
    fetch() { assert.fail('Photo help must not upload, search listings, or call a provider'); },
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    require(name) {
      if (name === '../lib/lens-return') return draftExports;
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'react') return {
        useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
        useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], next => { slots[index] = next; }]; },
        useCallback(callback, deps) { const index = cursor++; if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { callback, deps }; return slots[index].callback; },
        useEffect(callback, deps) {
          const index = cursor++, previous = slots[index];
          if (sameDeps(previous?.deps, deps)) return;
          slots[index] = { deps, cleanup: previous?.cleanup };
          effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = callback(); });
        },
      };
      throw Error(`Unexpected Lens help dependency: ${name}`);
    },
  });
  function render() {
    cursor = 0;
    tree = exports.default({ onChoose: name => { names.push(name); calls.push('choose'); } });
    for (const node of nodes(tree)) {
      if (typeof node.type !== 'string') continue;
      const key = node.props.id || `${node.type}:${node.props['aria-label'] || text(node)}`;
      let element = elements.get(key);
      if (!element) {
        element = { key, open: false, focus() { focused = element; calls.push(`focus:${key}`); } };
        elements.set(key, element);
      }
      element.node = node;
      if (node.type === 'dialog') {
        element.showModal = () => { assert.equal(element.open, false); element.open = true; calls.push('showModal'); };
        element.close = () => { element.open = false; calls.push('close'); element.node.props.onClose(); };
      }
      if (node.props.ref) node.props.ref.current = element;
    }
    for (const effect of effects.splice(0)) effect();
    return tree;
  }
  function one(predicate) {
    const matches = nodes(tree).filter(predicate);
    assert.equal(matches.length, 1, 'one requested photo-help control');
    return matches[0];
  }
  const dialog = () => one(node => node.type === 'dialog');
  const elementFor = node => [...elements.values()].find(element => element.node === node);
  render();
  return {
    names, calls, storage, one, render, dialog,
    trigger: () => one(node => node.type === 'a'),
    input: () => one(node => node.type === 'input'),
    use: () => one(node => node.type === 'button' && text(node) === 'Continue'),
    close: () => one(node => node.type === 'button' && node.props['aria-label'] === 'Close photo help'),
    click(node) { let prevented = false; node.props.onClick({ preventDefault() { prevented = true; } }); render(); return prevented; },
    type(value) { this.input().props.onChange({ target: { value } }); render(); },
    enter() { let prevented = false; this.input().props.onKeyDown({ key: 'Enter', preventDefault() { prevented = true; } }); render(); return prevented; },
    flushFrames() { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); render(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
    nativeClose() { elementFor(dialog()).close(); render(); },
    isOpen: () => elementFor(dialog()).open,
    focusedText: () => focused && text(focused.node),
    pending: () => draftExports.readLensReturnDraft(),
  };
}

test('one Google link launches normally and prepares a compact return form without upload or keyboard focus', () => {
  const app = help();
  assert.equal(app.isOpen(), false);
  const link = app.trigger();
  assert.equal(link.props['aria-expanded'], false);
  assert.equal(link.props.href, 'https://www.google.com/');
  assert.equal(link.props.target, '_blank');
  assert.match(link.props.rel, /\bnoopener\b/);
  assert.match(link.props.rel, /\bnoreferrer\b/);
  assert.match(link.props['aria-label'], /opens separately/);
  assert.equal(app.click(link), false, 'preparing Mekivo must not prevent the real Google navigation');
  assert.equal(app.isOpen(), true);
  assert.equal(app.trigger().props['aria-expanded'], true);
  assert.equal(app.focusedText(), 'Close', 'opening help must not summon the phone keyboard');
  assert.equal(app.pending(), '');
  assert.deepEqual(app.names, []);
  assert.equal(app.use().props.disabled, true);
  assert.equal(app.input().props.type === 'file', false, 'Mekivo does not request or receive a photo');
  assert.equal(nodes(app.render()).filter(node => node.type === 'a').length, 1, 'no second Open Google launch step');
  assert.match(text(app.dialog()), /Continue your parts search/);
  assert.match(text(app.dialog()), /Close its tab or return from the Google app/);
  assert.match(text(app.dialog()), /does not confirm that a part fits your vehicle/);
});

test('a trimmed name is handed back only after Continue and clears the pending return', () => {
  const app = help();
  app.click(app.trigger()); app.type('  Brake caliper  ');
  assert.deepEqual(app.names, [], 'typing must not submit or change the main search');
  assert.equal(app.pending(), '  Brake caliper  ');
  assert.equal(app.use().props.disabled, false);
  app.click(app.use());
  assert.deepEqual(app.names, ['Brake caliper']);
  assert.equal(app.pending(), null);
  assert.equal(app.isOpen(), false);
  assert.equal(app.trigger().props['aria-expanded'], false);
  assert.ok(app.calls.indexOf('close') < app.calls.indexOf('choose'));
  assert.equal(app.input().props.value, '', 'a completed handoff clears the next photo lookup');
  app.click(app.trigger());
  assert.equal(app.input().props.value, '');
  assert.equal(app.use().props.disabled, true);
  assert.equal(app.pending(), '');
});

test('Enter explicitly accepts a name, but whitespace cannot dismiss help or alter the search', () => {
  const app = help(); app.click(app.trigger()); app.type('   ');
  assert.equal(app.use().props.disabled, true);
  assert.equal(app.enter(), true);
  assert.equal(app.isOpen(), true);
  assert.deepEqual(app.names, []);
  app.type('Oil filter');
  assert.equal(app.enter(), true);
  assert.equal(app.isOpen(), false);
  assert.deepEqual(app.names, ['Oil filter']);
  assert.equal(app.pending(), null);
});

test('reload restores a pending draft once after mount without automatically accepting or searching', () => {
  const first = help(); first.click(first.trigger()); first.type('Brake caliper'); first.unmount();
  const restored = help({ storage: first.storage });
  assert.equal(restored.isOpen(), false, 'restore waits until the native dialog is mounted');
  restored.flushFrames();
  assert.equal(restored.isOpen(), true);
  assert.equal(restored.input().props.value, 'Brake caliper');
  assert.equal(restored.focusedText(), 'Close');
  restored.render(); restored.flushFrames();
  assert.equal(restored.calls.filter(call => call === 'showModal').length, 1);
  assert.deepEqual(restored.names, []);
});

test('Close or native Escape clears pending without reopening and retains the current in-memory draft', () => {
  for (const native of [false, true]) {
    const app = help(); app.click(app.trigger()); app.type('Brake caliper');
    assert.equal(app.dialog().props.onCancel, undefined, 'native Escape handling remains available');
    if (native) app.nativeClose(); else app.click(app.close());
    assert.equal(app.isOpen(), false);
    assert.match(app.focusedText(), /Use a photo/);
    assert.equal(app.pending(), null);
    assert.deepEqual(app.names, []);
    app.render(); app.flushFrames();
    assert.equal(app.isOpen(), false, 'rerenders must not reopen dismissed help');
    const reloaded = help({ storage: app.storage }); reloaded.flushFrames();
    assert.equal(reloaded.isOpen(), false, 'dismissed help must not restore after a reload');
    app.click(app.trigger());
    assert.equal(app.input().props.value, 'Brake caliper', 'normal reopen in this tab keeps the local draft');
  }
});

test('storage denial keeps one-tap launch and explicit manual handoff working', () => {
  const storage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  const app = help({ storage }); app.flushFrames();
  assert.equal(app.isOpen(), false);
  assert.equal(app.click(app.trigger()), false);
  app.type('Oil filter'); app.click(app.use());
  assert.deepEqual(app.names, ['Oil filter']);
  assert.equal(app.isOpen(), false);
});

test('unmount cancels queued restore and customer input is bounded before persistence', () => {
  const first = help(); first.click(first.trigger()); first.type('x'.repeat(150));
  assert.equal(first.input().props.value.length, 120);
  assert.equal(first.pending().length, 120);
  const reloaded = help({ storage: first.storage }); reloaded.unmount(); reloaded.flushFrames();
  assert.equal(reloaded.isOpen(), false);
});
