import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function pureModule(path) {
  const exports = {};
  vm.runInNewContext(compile(path), { exports, URL, URLSearchParams });
  return exports;
}
const guideData = pureModule('../app/lib/parts-guide-data.ts');
const savedSearch = pureModule('../app/lib/saved-search.ts');
const search = pureModule('../app/lib/search.ts');
const pageCode = compile('../app/page.tsx');
const Guide = () => null;
const Placeholder = () => null;

function nodes(node, result = []) {
  if (Array.isArray(node)) node.forEach(child => nodes(child, result));
  else if (node && typeof node === 'object') {
    result.push(node);
    nodes(node.props?.children, result);
  }
  return result;
}
const text = node => typeof node === 'string' ? node : Array.isArray(node)
  ? node.map(text).join('') : node?.props ? text(node.props.children) : '';

// Execute the real page, its URL parsing and event handlers with deterministic
// hook commits. Browser layout is separate; this verifies the requested target
// exists before scrolling and that restoration and later interactions win.
function page(query) {
  let cursor = 0, dirty = true, tree;
  const slots = [], effects = new Map(), pendingEffects = [], scrolls = [], requests = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value;
        if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(callback, dependencies) {
      const index = cursor++, previous = effects.get(index);
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous[i]))) {
        effects.set(index, dependencies);
        pendingEffects.push(callback);
      }
    },
  };
  const frame = callback => { callback(); return 1; };
  const exports = {};
  vm.runInNewContext(pageCode, {
    exports, URLSearchParams, AbortController, setTimeout, clearTimeout, requestAnimationFrame: frame,
    window: { location: { search: query }, requestAnimationFrame: frame, cancelAnimationFrame() {} },
    fetch(...args) { requests.push(args); throw new Error('Provider calls are not part of guide browsing'); },
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === './lib/parts-guide-data') return guideData;
      if (name === './lib/saved-search') return savedSearch;
      if (name === './lib/search') return search;
      if (name === './lib/growth-events') return { trackGrowthEvent() {} };
      if (name === './lib/analytics-audience') return { analyticsAudience: () => 'excluded' };
      if (name === './lib/supabase') return { getSupabaseBrowserClient: () => null };
      if (name === './components/parts-guide') return { default: Guide };
      return { default: Placeholder };
    },
  });
  const render = () => {
    for (let attempt = 0; dirty; attempt++) {
      assert.ok(attempt < 10, 'page settles after URL restoration');
      cursor = 0; dirty = false; tree = exports.default();
      for (const node of nodes(tree)) {
        if (typeof node.type === 'string' && node.props.ref) {
          const target = nodes(node).some(child => child.type === Guide) ? 'guide' : 'other';
          node.props.ref.current = { scrollIntoView: options => scrolls.push({ target, ...options }) };
        }
      }
      for (const effect of pendingEffects.splice(0)) effect();
    }
    return tree;
  };
  render();
  return {
    scrolls, requests, render,
    guide: () => nodes(render()).find(node => node.type === Guide),
    button: label => nodes(render()).find(node => node.type === 'button' && text(node) === label),
    vehicle: () => nodes(render()).find(node => node.type === 'details' && /Search with vehicle details|Vehicle:/.test(text(node))),
  };
}

test('direct guide landing reveals the guide and scrolls once without vehicle details or animation', () => {
  const app = page('?mode=parts&guide=1');
  assert.ok(app.guide());
  assert.equal(app.vehicle().props.open, false);
  assert.deepEqual(app.scrolls, [{ target: 'guide', behavior: 'instant', block: 'start' }]);
  app.guide().props.onCategory('Suspension');
  app.render();
  app.guide().props.onPart('Control Arm');
  app.render();
  assert.equal(app.scrolls.length, 1, 'choosing a system or part does not repeat landing scroll');
  app.button('Add vehicle details').props.onClick();
  app.render();
  assert.equal(app.vehicle().props.open, true);
  assert.equal(app.requests.length, 0);
  app.button('Find cars').props.onClick();
  app.render();
  app.button('Find parts').props.onClick();
  app.render();
  assert.equal(app.scrolls.filter(scroll => scroll.target === 'guide').length, 1);
});

test('already scheduled guide campaign links open the guide without needing their captions edited', () => {
  for (const content of ['visual_guide', 'visual_guide_v2']) {
    const app = page(`?mode=parts&utm_source=facebook&utm_medium=organic_social&utm_campaign=september_validation&utm_content=${content}`);
    assert.ok(app.guide());
    assert.equal(app.vehicle().props.open, false);
    assert.deepEqual(app.scrolls, [{ target: 'guide', behavior: 'instant', block: 'start' }]);
    app.guide().props.onCategory('Suspension');
    app.render();
    assert.equal(app.scrolls.length, 1);
    assert.equal(app.requests.length, 0);
  }
});

test('ordinary, unrelated and unrecognised campaign landings do not open or scroll the guide', () => {
  for (const query of ['', '?mode=parts', '?mode=cars&guide=1',
    '?mode=cars&utm_content=visual_guide_v2', '?mode=parts&utm_content=part_number_v2',
    '?mode=parts&utm_content=visual_guide_v3', '?mode=parts&utm_content=Visual_Guide',
    '?mode=parts&utm_content=other_visual_guide']) {
    const app = page(query);
    assert.equal(app.guide(), undefined);
    assert.equal(app.scrolls.length, 0);
    assert.equal(app.requests.length, 0);
  }
});

test('saved search restoration takes precedence over explicit and campaign guide links', () => {
  for (const guideQuery of ['guide=1', 'utm_content=visual_guide', 'utm_content=visual_guide_v2']) {
    const direct = page(`?mode=parts&${guideQuery}&restore=1&search_method=part_number&part_number=06J115403Q`);
    assert.equal(direct.guide(), undefined);
    assert.equal(direct.vehicle().props.open, false);
    assert.equal(direct.scrolls.length, 0);
    const diagram = page(`?mode=parts&${guideQuery}&restore=1&make=Ford&model=Fiesta&year=2012&part_method=diagram&category=Suspension&part=Control+Arm`);
    assert.equal(diagram.guide().props.category, 'Suspension');
    assert.equal(diagram.guide().props.part, 'Control Arm');
    assert.equal(diagram.vehicle().props.open, true);
    assert.equal(diagram.scrolls.length, 0);
  }
});
