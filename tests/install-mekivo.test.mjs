import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

const code = ts.transpileModule(readFileSync(new URL('../app/components/install-mekivo.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const nodes = (node, found = []) => {
  if (Array.isArray(node)) node.forEach(child => nodes(child, found));
  else if (node && typeof node === 'object') { found.push(node); nodes(node.props?.children, found); }
  return found;
};
const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
const settle = () => new Promise(resolve => setImmediate(resolve));
const promise = () => {
  let resolve, reject;
  const value = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { value, resolve, reject };
};
function installEvent(prompt = async () => {}, userChoice = Promise.resolve({ outcome: 'accepted' })) {
  return Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice });
}

function harness({ standalone = false, appleStandalone = false, server = false, noMedia = false } = {}) {
  const slots = [], effects = [], cleanups = [], windowListeners = new Map(), mediaListeners = new Set();
  let cursor = 0, mounted = false, writes = 0, focuses = 0;
  const media = {
    matches: standalone,
    addEventListener(name, callback) { assert.equal(name, 'change'); mediaListeners.add(callback); },
    removeEventListener(name, callback) { assert.equal(name, 'change'); mediaListeners.delete(callback); },
  };
  const browser = {
    addEventListener(name, callback) { if (!windowListeners.has(name)) windowListeners.set(name, new Set()); windowListeners.get(name).add(callback); },
    removeEventListener(name, callback) { windowListeners.get(name)?.delete(callback); },
    ...(noMedia ? {} : { matchMedia(query) { assert.equal(query, '(display-mode: standalone)'); return media; } }),
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    ...(server ? {} : { window: browser, navigator: { standalone: appleStandalone } }),
    require(name) {
      if (name === 'react') return {
        useState(initial) {
          const index = cursor++;
          if (!(index in slots)) slots[index] = initial;
          return [slots[index], value => { writes++; slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
        },
        useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
        useId() { return `install-status-${cursor++}`; },
        useEffect(effect) { const index = cursor++; if (!(index in slots)) { slots[index] = true; effects.push(effect); } },
        useSyncExternalStore(subscribe, snapshot, serverSnapshot) {
          const index = cursor++;
          if (!server && !(index in slots)) { slots[index] = true; cleanups.push(subscribe(() => {})); }
          return server ? serverSnapshot() : snapshot();
        },
      };
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'next/image') return { default: 'image' };
      throw new Error(`Unexpected install dependency, including analytics or authentication: ${name}`);
    },
  });
  const render = () => {
    cursor = 0;
    const tree = exports.default();
    for (const node of nodes(tree)) if (node.type === 'summary') node.props.ref.current = { focus() { focuses++; } };
    if (!mounted && !server) { mounted = true; effects.forEach(effect => cleanups.push(effect())); }
    return tree;
  };
  return {
    render, text: () => text(render()),
    button: () => nodes(render()).find(node => node.type === 'button'),
    status: () => nodes(render()).find(node => node.props?.role === 'status'),
    dispatch(name, event = new Event(name)) { for (const listener of windowListeners.get(name) || []) listener(event); },
    setStandalone(value) { media.matches = value; for (const listener of mediaListeners) listener(); },
    unmount() { cleanups.forEach(cleanup => cleanup?.()); },
    get writes() { return writes; }, get focuses() { return focuses; },
    get listenerCount() { return [...windowListeners.values()].reduce((total, listeners) => total + listeners.size, mediaListeners.size); },
  };
}

test('server rendering and installed standalone launches do not advertise installation', () => {
  assert.equal(harness({ server: true }).render(), null, 'server render does not access browser globals');
  for (const options of [{ standalone: true }, { appleStandalone: true }]) {
    const h = harness(options);
    assert.equal(h.render(), null);
    h.dispatch('beforeinstallprompt', installEvent());
    assert.equal(h.render(), null);
    h.unmount();
  }
});

test('unsupported browsers get compact accessible instructions without an unusable install button', () => {
  const h = harness({ noMedia: true });
  const tree = h.render(), all = nodes(tree);
  assert.equal(tree.type, 'details');
  assert.equal(tree.props.open, undefined, 'manual help starts collapsed');
  assert.ok(all.some(node => node.type === 'summary'));
  assert.ok(all.some(node => node.type === 'h2' && text(node) === 'Install Mekivo'));
  assert.equal(all.filter(node => node.type === 'h3').length, 2);
  assert.match(h.text(), /page menu/);
  assert.match(h.text(), /Open as Web App/);
  assert.match(h.text(), /Install and create shortcut/);
  assert.match(h.text(), /internet connection/);
  assert.match(h.text(), /bookmark Mekivo/);
  assert.doesNotMatch(h.text(), /App Store|Google Play|offline access|notifications/i);
  assert.equal(h.button(), undefined);
  assert.equal(h.status().props['aria-live'], 'polite');
  h.unmount();
});

test('a browser install offer waits for a user click and cannot be prompted twice', async () => {
  const h = harness(); h.render();
  const opened = promise(), choice = promise(); let prompts = 0;
  const event = installEvent(() => { prompts++; return opened.value; }, choice.value);
  h.dispatch('beforeinstallprompt', event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(prompts, 0, 'receiving the event never opens a prompt');
  const button = h.button();
  assert.equal(text(button), 'Install Mekivo');
  button.props.onClick(); button.props.onClick();
  assert.equal(prompts, 1, 'rapid activation consumes the event once');
  assert.equal(h.button().props.disabled, true);
  opened.resolve(); choice.resolve({ outcome: 'accepted' });
  await settle();
  assert.match(h.text(), /Installation requested/);
  assert.equal(h.button(), undefined);
  assert.equal(h.focuses, 1, 'focus returns to the persistent summary');
  button.props.onClick(); await settle();
  assert.equal(prompts, 1);
  h.unmount();
});

test('dismissal keeps manual help and does not offer a repeating prompt on the same page', async () => {
  const h = harness(); h.render(); let prompts = 0;
  h.dispatch('beforeinstallprompt', installEvent(async () => { prompts++; }, Promise.resolve({ outcome: 'dismissed' })));
  h.button().props.onClick(); await settle();
  assert.match(h.text(), /Installation cancelled/);
  assert.match(h.text(), /iPhone/);
  h.dispatch('beforeinstallprompt', installEvent(async () => { prompts++; }));
  assert.equal(h.button(), undefined);
  assert.equal(prompts, 1);
  h.unmount();
});

test('both prompt and choice rejection are handled with honest manual fallback', async () => {
  for (const rejectPrompt of [true, false]) {
    const h = harness(); h.render(); const choice = promise();
    h.dispatch('beforeinstallprompt', installEvent(() => {
      choice.reject(new Error('blocked choice'));
      return rejectPrompt ? Promise.reject(new Error('blocked prompt')) : Promise.resolve();
    }, choice.value));
    h.button().props.onClick(); await settle();
    assert.match(h.text(), rejectPrompt ? /could not open installation/ : /could not confirm installation/);
    assert.match(h.text(), /bookmark Mekivo/);
    assert.equal(h.button(), undefined);
    assert.equal(h.focuses, 1);
    h.unmount();
  }
});

test('installation through browser controls and standalone mode changes hide the promotion', () => {
  const h = harness(); h.render();
  h.dispatch('beforeinstallprompt', installEvent());
  h.dispatch('appinstalled');
  assert.equal(h.render(), null);
  h.dispatch('beforeinstallprompt', installEvent());
  assert.equal(h.render(), null);
  h.unmount();
  const mode = harness(); mode.render(); mode.setStandalone(true);
  assert.equal(mode.render(), null);
  mode.unmount();
});

test('unmount removes subscriptions and pending installation cannot update an unmounted component', async () => {
  const h = harness(); h.render(); const opened = promise(), choice = promise();
  assert.equal(h.listenerCount, 3);
  h.dispatch('beforeinstallprompt', installEvent(() => opened.value, choice.value));
  h.button().props.onClick();
  h.unmount(); const writes = h.writes;
  assert.equal(h.listenerCount, 0);
  opened.resolve(); choice.resolve({ outcome: 'dismissed' }); await settle();
  assert.equal(h.writes, writes);
});
