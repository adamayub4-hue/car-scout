import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

const code = ts.transpileModule(readFileSync(new URL('../app/components/google-lens-help.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
function nodes(node, result = []) {
  if (Array.isArray(node)) node.forEach(child => nodes(child, result));
  else if (node?.props) { result.push(node); nodes(node.props.children, result); }
  return result;
}

// Native dialog rendering, the browser's external tab behavior, and mobile
// navigation are checked separately in browser QA. This executes the actual
// component handlers and verifies the customer handoff without any network.
function help() {
  let cursor = 0, tree, focused;
  const slots = [], elements = new Map(), names = [], calls = [];
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    fetch() { assert.fail('Photo help must not upload a photo or call a provider'); },
    require(name) {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'react') return {
        useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
        useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], next => { slots[index] = next; }]; },
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
    names, calls, one, render, dialog,
    trigger: () => one(node => node.type === 'button' && node.props['aria-haspopup'] === 'dialog'),
    input: () => one(node => node.type === 'input'),
    use: () => one(node => node.type === 'button' && text(node) === 'Use this part name'),
    close: () => one(node => node.type === 'button' && node.props['aria-label'] === 'Close photo help'),
    click(node) { node.props.onClick(); render(); },
    type(value) { this.input().props.onChange({ target: { value } }); render(); },
    enter() { let prevented = false; this.input().props.onKeyDown({ key: 'Enter', preventDefault() { prevented = true; } }); render(); return prevented; },
    nativeClose() { elementFor(dialog()).close(); render(); },
    isOpen: () => elementFor(dialog()).open,
    focusedText: () => focused && text(focused.node),
  };
}

test('photo help starts as one compact trigger and opens without changing the search or focusing the keyboard', () => {
  const app = help();
  assert.equal(app.isOpen(), false);
  assert.equal(app.trigger().props['aria-expanded'], false);
  app.click(app.trigger());
  assert.equal(app.isOpen(), true);
  assert.equal(app.trigger().props['aria-expanded'], true);
  assert.equal(app.focusedText(), 'Close');
  assert.deepEqual(app.names, []);
  assert.equal(app.use().props.disabled, true);
  assert.equal(app.input().props.type === 'file', false, 'Mekivo does not request or receive a photo');
});

test('Google opens separately with an explicit return path and no automatic upload handler', () => {
  const app = help();
  const link = app.one(node => node.type === 'a');
  assert.equal(link.props.href, 'https://www.google.com/');
  assert.equal(link.props.target, '_blank');
  assert.match(link.props.rel, /\bnoopener\b/);
  assert.match(link.props.rel, /\bnoreferrer\b/);
  assert.equal(link.props.onClick, undefined);
  assert.match(text(app.dialog()), /Mekivo stays open here/);
  assert.match(text(app.dialog()), /Close Google's tab or switch back from the Google app/);
  assert.match(text(app.dialog()), /does not confirm that a part fits your vehicle/);
  assert.deepEqual(app.names, []);
});

test('a trimmed part name is handed back only after the customer explicitly accepts it', () => {
  const app = help();
  app.click(app.trigger());
  app.type('  Brake caliper  ');
  assert.deepEqual(app.names, [], 'typing must not submit or change the main search');
  assert.equal(app.use().props.disabled, false);
  app.click(app.use());
  assert.deepEqual(app.names, ['Brake caliper']);
  assert.equal(app.isOpen(), false);
  assert.equal(app.trigger().props['aria-expanded'], false);
  assert.ok(app.calls.indexOf('close') < app.calls.indexOf('choose'), 'close the modal before handing focus back to the form');
});

test('Enter accepts a name, but whitespace cannot dismiss help or alter the search', () => {
  const app = help();
  app.click(app.trigger());
  app.type('   ');
  assert.equal(app.use().props.disabled, true);
  assert.equal(app.enter(), true);
  assert.equal(app.isOpen(), true);
  assert.deepEqual(app.names, []);
  app.type('Oil filter');
  assert.equal(app.enter(), true);
  assert.equal(app.isOpen(), false);
  assert.deepEqual(app.names, ['Oil filter']);
});

test('closing or native Escape cancellation returns focus without accepting a name and keeps a draft', () => {
  for (const native of [false, true]) {
    const app = help();
    app.click(app.trigger());
    app.type('Brake caliper');
    assert.equal(app.dialog().props.onCancel, undefined, 'native Escape handling remains available');
    if (native) app.nativeClose(); else app.click(app.close());
    assert.equal(app.isOpen(), false);
    assert.equal(app.focusedText(), 'Use a photo');
    assert.deepEqual(app.names, []);
    app.click(app.trigger());
    assert.equal(app.input().props.value, 'Brake caliper');
  }
});
