import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helpers = {};
vm.runInNewContext(compile('../app/lib/vehicle-picker-options.ts'), { exports: helpers });
const component = compile('../app/components/vehicle-picker.tsx');

const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
function nodes(node, result = []) {
  if (Array.isArray(node)) node.forEach(child => nodes(child, result));
  else if (node?.props) { result.push(node); nodes(node.props.children, result); }
  return result;
}

// Exercise the real controlled component with its actual handlers. The dialog
// double models native showModal/close and refs, not a browser's rendering or
// native Tab/Escape dispatch; those remain part of local browser QA.
function picker(initial = {}) {
  let cursor = 0, tree, props, focused;
  const slots = [], imperative = [], dom = new Map(), calls = [], actions = [];
  const forwardedRef = { current: null };
  const exports = {};
  vm.runInNewContext(component, { exports, require(name) {
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name === '../lib/vehicle-picker-options') return helpers;
    if (name === 'react') return {
      forwardRef: render => next => render(next, forwardedRef),
      useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
      useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], next => { slots[index] = next; }]; },
      useImperativeHandle(ref, create) { imperative.push(() => { ref.current = create(); }); },
    };
    throw Error(`Unexpected dependency: ${name}`);
  } });
  props = { id: 'test-make', label: 'Make', value: '', options: ['Volkswagen', 'Audi', 'BMW'], ...initial,
    onChange(value) { calls.push(value); props = { ...props, value }; },
  };
  function render() {
    cursor = 0;
    tree = exports.default(props);
    for (const node of nodes(tree)) {
      const key = node.props.id || `${node.type}:${node.props['aria-label'] || text(node)}`;
      let element = dom.get(key);
      if (!element) {
        element = { key, open: false, focus() { focused = element; actions.push(`focus:${key}`); } };
        dom.set(key, element);
      }
      element.node = node;
      if (node.type === 'dialog') {
        element.showModal = () => { assert.equal(element.open, false); actions.push('showModal'); element.open = true; };
        element.close = () => { actions.push('close'); element.open = false; element.node.props.onClose(); };
        element.querySelectorAll = () => options().map(option => elementFor(option));
        element.querySelector = () => element.querySelectorAll()[0];
      }
      if (node.props.ref) node.props.ref.current = element;
    }
    imperative.splice(0).forEach(callback => callback());
    return tree;
  }
  function one(predicate) {
    const matches = nodes(tree).filter(predicate);
    assert.equal(matches.length, 1, 'one requested control');
    return matches[0];
  }
  const elementFor = node => [...dom.values()].find(element => element.node === node);
  const options = () => nodes(tree).filter(node => node.type === 'button' && node.props['data-vehicle-option']);
  render();
  return {
    calls, actions, render, one, options, forwardedRef,
    trigger: () => one(node => node.type === 'button' && node.props.id === props.id),
    dialog: () => one(node => node.type === 'dialog'),
    input: () => one(node => node.type === 'input'),
    button: label => one(node => node.type === 'button' && text(node) === label),
    update(next) { props = { ...props, ...next }; render(); },
    click(node) { node.props.onClick(); render(); },
    type(value) { this.input().props.onChange({ target: { value } }); render(); },
    press(node, key) { let prevented = false; node.props.onKeyDown({ key, currentTarget: elementFor(node), preventDefault() { prevented = true; } }); render(); return prevented; },
    nativeClose() { elementFor(this.dialog()).close(); render(); },
    isOpen: () => elementFor(one(node => node.type === 'dialog')).open,
    focusText: () => focused && text(focused.node),
  };
}

test('a single trigger activation opens an alphabetical list without focusing the text input', () => {
  const app = picker();
  assert.equal(app.isOpen(), false);
  app.click(app.trigger());
  assert.equal(app.isOpen(), true);
  assert.equal(app.trigger().props['aria-expanded'], true);
  assert.deepEqual(app.options().map(text), ['Audi', 'BMW', 'Volkswagen']);
  assert.deepEqual(app.actions.slice(0, 2), ['showModal', 'focus:button:Close make picker']);
  assert.equal(app.focusText(), 'Close');
  assert.equal(app.input().props.value, '');
  assert.deepEqual(app.calls, [], 'opening the picker does not alter the vehicle');
  app.click(app.options()[0]);
  assert.deepEqual(app.calls, ['Audi']);
  assert.equal(app.isOpen(), false);
  assert.equal(app.trigger().props['aria-expanded'], false);
  assert.ok(app.focusText().startsWith('Audi'), 'focus returns to the original field');
});

test('searching is case-insensitive and a custom make or model remains searchable', () => {
  const app = picker({ label: 'Model', options: ['Golf', 'Golf Plus', 'Taigo'] });
  app.click(app.trigger());
  app.type('GOlF');
  assert.deepEqual(app.options().map(text), ['Golf', 'Golf Plus']);
  app.click(app.button('Use “Golf”'));
  assert.deepEqual(app.calls, ['Golf'], 'known spelling is canonicalised');
  app.click(app.trigger());
  assert.equal(app.input().props.value, '', 'reopening shows all suggestions');
  app.type('  Type 181  ');
  assert.equal(app.options().length, 0);
  assert.equal(app.press(app.input(), 'Enter'), true);
  assert.deepEqual(app.calls, ['Golf', 'Type 181']);
  assert.equal(app.isOpen(), false);
});

test('unlisted bike models can be entered when there are no model suggestions', () => {
  const app = picker({ label: 'Model', options: [], optional: true });
  app.click(app.trigger());
  assert.equal(app.options().length, 0);
  app.type('Monkey 125');
  app.click(app.button('Use “Monkey 125”'));
  assert.deepEqual(app.calls, ['Monkey 125']);
  app.click(app.trigger());
  app.click(app.button('Any model'));
  assert.deepEqual(app.calls, ['Monkey 125', '']);
});

test('keyboard arrows navigate the visible suggestions without committing a different value', () => {
  const app = picker({ value: 'BMW' });
  app.click(app.trigger());
  assert.equal(app.press(app.input(), 'ArrowDown'), true);
  assert.equal(app.focusText(), 'Audi');
  assert.equal(app.press(app.options()[0], 'ArrowDown'), true);
  assert.equal(app.focusText(), 'BMW✓');
  app.press(app.options()[1], 'End');
  assert.equal(app.focusText(), 'Volkswagen');
  app.press(app.options()[2], 'ArrowDown');
  assert.equal(app.focusText(), 'Audi');
  app.press(app.options()[0], 'ArrowUp');
  assert.equal(app.focusText(), 'Volkswagen');
  app.press(app.options()[2], 'Home');
  assert.equal(app.focusText(), 'Audi');
  assert.deepEqual(app.calls, []);
  assert.equal(app.dialog().props.onCancel, undefined, 'native Escape cancellation is not intercepted');
  app.nativeClose();
  assert.equal(app.isOpen(), false);
  assert.deepEqual(app.calls, []);
  assert.ok(app.focusText().startsWith('BMW'));
});

test('choosing the current make closes without resetting dependent model fields', () => {
  const app = picker({ value: 'Audi' });
  app.click(app.trigger());
  app.click(app.options().find(node => text(node).startsWith('Audi')));
  assert.deepEqual(app.calls, [], 'a repeated selection is not a vehicle change');
  assert.equal(app.isOpen(), false);
});

test('disabled fields stay closed and the forwarded field ref can receive edit-search focus', () => {
  const app = picker({ disabled: true });
  assert.equal(app.trigger().props.disabled, true);
  app.click(app.trigger());
  assert.equal(app.isOpen(), false);
  assert.deepEqual(app.actions, []);
  app.forwardedRef.current.focus();
  assert.ok(app.focusText().includes('Choose make'));
  assert.equal(app.trigger().props['aria-haspopup'], 'dialog');
  assert.equal(app.trigger().props['aria-controls'], app.dialog().props.id);
  assert.equal(app.dialog().props['aria-labelledby'], 'test-make-title');
  assert.match(app.input().props.className, /\btext-base\b/);
});

test('suggestion normalisation preserves arbitrary free text and supports make case differences', () => {
  assert.deepEqual(Array.from(helpers.vehiclePickerOptions([' BMW ', 'Audi', 'audi', '', 'Volkswagen'])), ['Audi', 'BMW', 'Volkswagen']);
  assert.deepEqual(Array.from(helpers.vehiclePickerOptions(['Golf', 'Taigo', 'Golf Plus'], ' GOLF ')), ['Golf', 'Golf Plus']);
  assert.equal(helpers.vehiclePickerValue(['Audi'], 'audi'), 'Audi');
  assert.equal(helpers.vehiclePickerValue(['Audi'], '  Bristol  '), 'Bristol');
  assert.deepEqual(Array.from(helpers.vehicleModelsForMake({ Audi: ['A3', 'A5'] }, ' AUDI ')), ['A3', 'A5']);
  assert.deepEqual(Array.from(helpers.vehicleModelsForMake({ Audi: ['A3'] }, 'Unlisted make')), []);
});
