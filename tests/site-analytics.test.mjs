import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../app/components/site-analytics.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

// Test the real component's lifecycle; the policy itself has separate integration tests.
function harness(initialAudience = 'pending') {
  const slots = [], effects = [], timers = new Map(), listeners = new Set();
  const Analytics = () => null, SpeedInsights = () => null;
  const Fragment = Symbol('Fragment');
  let cursor = 0, nextTimer = 0, audience = initialAudience, initialized = 0;
  const counts = { analyticsMounts: 0, speedMounts: 0, unmounts: 0 };
  let previousSdkTypes = [];
  const filter = event => audience === 'included' ? event : null;
  const policy = {
    analyticsAudience: () => audience,
    filterAnalyticsEvent: filter,
    initializeAnalyticsAudience: () => { initialized++; },
    subscribeAnalyticsAudience: listener => { listeners.add(listener); return () => listeners.delete(listener); },
  };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useEffect(callback, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, at) => !Object.is(value, previous.dependencies[at]))) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { dependencies, cleanup: callback() };
        });
      }
    },
    useSyncExternalStore(subscribe, getSnapshot) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { unsubscribe: subscribe(() => {}) };
      return getSnapshot();
    },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    window: {
      setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { Fragment, jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name === 'next/navigation') return { usePathname: () => '/' };
      if (name === '@vercel/analytics/next') return { Analytics };
      if (name === '@vercel/speed-insights/next') return { SpeedInsights };
      if (name === '../lib/analytics-audience') return policy;
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  const sdkNodes = tree => {
    if (!tree) return [];
    if (Array.isArray(tree)) return tree.flatMap(sdkNodes);
    if (tree.type === Analytics || tree.type === SpeedInsights) return [tree];
    return sdkNodes(tree.props?.children);
  };
  function render() {
    cursor = 0;
    const tree = exports.SiteAnalytics();
    const nodes = sdkNodes(tree);
    // React preserves a mounted child when its type and sibling position are stable.
    nodes.forEach((node, index) => {
      if (previousSdkTypes[index] !== node.type) {
        if (node.type === Analytics) counts.analyticsMounts++;
        else counts.speedMounts++;
      }
    });
    previousSdkTypes.forEach((type, index) => { if (nodes[index]?.type !== type) counts.unmounts++; });
    previousSdkTypes = nodes.map(node => node.type);
    effects.splice(0).forEach(effect => effect());
    return { tree, nodes };
  }
  return {
    render, counts, filter, timers,
    get initialized() { return initialized; },
    audience(value) { audience = value; listeners.forEach(listener => listener()); },
    flushTimers() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
  };
}

test('pending and owner-excluded audiences never mount either analytics SDK', () => {
  for (const initialAudience of ['pending', 'excluded']) {
    const h = harness(initialAudience);
    assert.equal(h.render().tree, null);
    h.flushTimers();
    assert.equal(h.render().nodes.length, 0);
    h.audience('excluded');
    assert.equal(h.render().tree, null);
    h.flushTimers();
    assert.equal(h.render().nodes.length, 0);
    assert.deepEqual(h.counts, { analyticsMounts: 0, speedMounts: 0, unmounts: 0 });
    assert.equal(h.initialized, 1);
    assert.equal(h.timers.size, 0);
  }
});

test('both SDKs mount once after inclusion and live filters block subsequent pending or excluded events', () => {
  const h = harness();
  assert.equal(h.render().tree, null);
  h.audience('included');
  assert.equal(h.render().tree, null, 'the initial pending render cannot mount either SDK');
  h.flushTimers();
  const mounted = h.render().nodes;
  assert.equal(mounted.length, 2);
  const pageview = { type: 'pageview', url: 'https://mekivo.uk/' };
  for (const node of mounted) {
    assert.strictEqual(node.props.beforeSend, h.filter);
    assert.strictEqual(node.props.beforeSend(pageview), pageview);
  }
  for (const nextAudience of ['pending', 'excluded', 'included', 'pending', 'included']) {
    h.audience(nextAudience);
    const nodes = h.render().nodes;
    h.flushTimers();
    assert.equal(nodes.length, 2, 'auth changes must not unmount initialized SDKs');
    nodes.forEach((node, index) => {
      assert.strictEqual(node.type, mounted[index].type);
      assert.strictEqual(node.props.beforeSend, mounted[index].props.beforeSend);
      assert.strictEqual(node.props.beforeSend(pageview), nextAudience === 'included' ? pageview : null);
    });
  }
  assert.deepEqual(h.counts, { analyticsMounts: 1, speedMounts: 1, unmounts: 0 });
  assert.equal(h.initialized, 1);
});
