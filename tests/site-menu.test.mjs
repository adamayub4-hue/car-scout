import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';

function menu() {
  let cursor = 0, dirty = true, tree, focused = null;
  const slots = [], effects = new Map(), pending = [], listeners = new Map();
  class Node {
    constructor(name, parent = null) { this.name = name; this.parent = parent; }
    contains(target) { return target === this || target?.parent === this; }
    focus() { focused = this.name; }
  }
  const container = new Node('container'), trigger = new Node('trigger', container);
  const document = {
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
  };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value;
        if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; }
      }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useId() { return `menu-${cursor++}`; },
    useEffect(callback, dependencies) {
      const index = cursor++, before = effects.get(index);
      if (!before || dependencies.some((value, i) => !Object.is(value, before.dependencies[i]))) {
        const record = { dependencies, cleanup: null };
        effects.set(index, record);
        pending.push(() => { before?.cleanup?.(); record.cleanup = callback(); });
      }
    },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../app/components/site-menu.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, document, Node, require(name) {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return jsx;
    if (name === 'next/link') return { default: 'a' };
    if (name === './appearance') return { default: () => null };
    throw Error(name);
  } });
  function nodes(node, found = []) {
    if (Array.isArray(node)) node.forEach(child => nodes(child, found));
    else if (node?.props) { found.push(node); nodes(node.props.children, found); }
    return found;
  }
  function render() {
    while (dirty) {
      cursor = 0; dirty = false; tree = exports.default();
      for (const node of nodes(tree)) if (node.props.ref) node.props.ref.current = node.type === 'button' ? trigger : container;
      pending.splice(0).forEach(run => run());
    }
  }
  function button() { render(); return nodes(tree).find(node => node.type === 'button'); }
  function click(control = button()) { control.props.onClick(); render(); }
  function dispatch(type, values) { listeners.get(type)?.(values); render(); }
  render();
  return { click, button, dispatch, listeners, inside: new Node('inside', container), outside: new Node('outside'),
    links() { render(); return nodes(tree).filter(node => node.type === 'a'); },
    panel() { render(); return nodes(tree).find(node => node.props.id === button().props['aria-controls']); },
    focused: () => focused,
  };
}

test('menu opens once and dismisses on outside taps without stealing outside focus', () => {
  const app = menu();
  assert.equal(app.button().props['aria-expanded'], false);
  assert.equal(app.panel(), undefined);
  assert.equal(app.listeners.size, 0);
  app.click();
  assert.equal(app.button().props['aria-expanded'], true);
  assert.ok(app.panel());
  app.dispatch('pointerdown', { target: app.inside });
  assert.equal(app.button().props['aria-expanded'], true);
  app.dispatch('pointerdown', { target: app.outside });
  assert.equal(app.button().props['aria-expanded'], false);
  assert.equal(app.listeners.size, 0, 'closed menu leaves no dismissal listeners');
  assert.equal(app.focused(), null);
});

test('Escape closes the menu and returns keyboard focus to its trigger', () => {
  const app = menu();
  app.click();
  let prevented = false;
  app.dispatch('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(app.button().props['aria-expanded'], false);
  assert.equal(app.focused(), 'trigger');
  assert.equal(prevented, true);
});

test('navigation, tabbing outside and the menu toggle all close the open panel', () => {
  const app = menu();
  app.click();
  assert.equal(app.links().length, 5);
  app.click(app.links()[0]);
  assert.equal(app.button().props['aria-expanded'], false, 'Home also closes when already on Home');
  app.click();
  app.dispatch('focusin', { target: app.inside });
  assert.equal(app.button().props['aria-expanded'], true);
  app.dispatch('focusin', { target: app.outside });
  assert.equal(app.button().props['aria-expanded'], false);
  app.click();
  app.click();
  assert.equal(app.button().props['aria-expanded'], false);
});
