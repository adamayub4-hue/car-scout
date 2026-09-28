import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const data = {};
vm.runInNewContext(compile('../app/lib/parts-guide-data.ts'), { exports: data });
const componentCode = compile('../app/components/parts-guide.tsx');

// Keep expected selections independent of the component's array indexing. A
// marker wired to its neighbour, or the combustion artwork used for an EV,
// must fail even when every callback still receives a valid part name.
const variants = [
  ['Engine', 'Petrol', 'engine-cooling-v1', ['Air Filter', 'Oil Filter', 'Timing Belt', 'Water Pump']],
  ['Brakes', 'Petrol', 'braking-system-v1', ['Brake Disc', 'Brake Pads', 'Brake Caliper', 'ABS Sensor']],
  ['Suspension', 'Petrol', 'suspension-v1', ['Shock Absorber', 'Coil Spring', 'Control Arm', 'Drop Link']],
  ['Body', 'Petrol', 'body-lighting-v1', ['Front Bumper', 'Headlight', 'Wing Mirror', 'Tail Light']],
  ['Electrical', 'Petrol', 'electrical-v1', ['Battery', 'Alternator', 'Starter Motor', 'Fuse Box']],
  ['Interior', 'Petrol', 'interior-controls-v1', ['Steering Wheel', 'Dashboard', 'Front Seat', 'Gear Knob']],
  ['Exhaust', 'Petrol', 'exhaust-emissions-v1', ['Exhaust Back Box', 'Catalytic Converter', 'DPF', 'Oxygen Sensor']],
  ['Drivetrain', 'Petrol', 'drivetrain-v1', ['Clutch Kit', 'Gearbox', 'Driveshaft', 'CV Joint']],
  ['Electrical', 'Electric', 'ev-electrical-v1', ['12V Battery', 'Drive Motor', 'Power Inverter', 'Onboard Charger']],
  ['Drivetrain', 'Electric', 'ev-drivetrain-v1', ['Reduction Gear', 'Driveshaft', 'CV Joint', 'Differential']],
];
const standardSystems = ['Engine', 'Brakes', 'Suspension', 'Body', 'Electrical', 'Interior', 'Exhaust', 'Drivetrain'];

function nodes(node, result = []) {
  if (Array.isArray(node)) node.forEach(child => nodes(child, result));
  else if (node && typeof node === 'object') {
    result.push(node);
    nodes(node.props?.children, result);
  }
  return result;
}
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
const partMarker = node => node.type === 'button' && /^Select .+ from illustration$/.test(node.props['aria-label'] || '');
const markerAppearance = marker => nodes(marker).find(node => node.type === 'span').props.className;

// Run the real controlled component and commit refs before effects. This checks
// callback, selection, and focus behavior without a browser or network access;
// native browser keyboard dispatch and pixel placement are separate UI checks.
function explorer(initial = {}) {
  let cursor = 0, tree, props;
  const slots = [], effects = new Map(), pendingEffects = [], committedRefs = new Set();
  const calls = { category: [], part: [] }, focus = [];
  const hooks = {
    useState(initialValue) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initialValue;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initialValue) { const index = cursor++; return slots[index] ??= { current: initialValue }; },
    useEffect(callback, dependencies) {
      const index = cursor++, previous = effects.get(index);
      if (!previous || dependencies.some((value, position) => !Object.is(value, previous[position]))) {
        effects.set(index, dependencies);
        pendingEffects.push(callback);
      }
    },
  };
  const exports = {};
  vm.runInNewContext(componentCode, { exports, require(name) {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name === 'next/image') return { default: 'img' };
    if (name === '../lib/parts-guide-data') return data;
    throw Error(`Unexpected dependency: ${name}`);
  } });
  props = {
    category: '', part: '', fuel: 'Petrol', ...initial,
    onCategory(value) { calls.category.push(value); props = { ...props, category: value, part: '' }; },
    onPart(value) { calls.part.push(value); props = { ...props, part: value }; },
  };
  function render() {
    cursor = 0;
    tree = exports.default(props);
    committedRefs.forEach(ref => { ref.current = null; });
    committedRefs.clear();
    for (const node of nodes(tree)) if (node.props?.ref) {
      node.props.ref.current = { focus() { focus.push(text(node)); } };
      committedRefs.add(node.props.ref);
    }
    pendingEffects.splice(0).forEach(effect => effect());
    return tree;
  }
  function one(predicate) {
    const found = nodes(tree).filter(predicate);
    assert.equal(found.length, 1, 'expected exactly one matching control or region');
    return found[0];
  }
  render();
  return {
    calls, focus, render, one,
    update(next) { props = { ...props, ...next }; render(); },
    nodes: () => nodes(tree), text: () => text(tree),
    marker: part => one(node => partMarker(node) && node.props['aria-label'] === `Select ${part} from illustration`),
    list: part => one(node => node.type === 'button' && !node.props['aria-label']
      && nodes(node).some(child => child.type === 'strong' && text(child) === part)),
    systemMarker: name => one(node => node.type === 'button' && node.props['aria-label'] === `${name}: view common parts`),
  };
}

function assertNativeButton(button) {
  assert.equal(button.type, 'button');
  assert.equal(button.props.type, 'button');
  assert.notEqual(button.props.disabled, true);
  assert.ok(button.props.tabIndex === undefined || button.props.tabIndex >= 0, 'control remains in native keyboard order');
}

for (const [category, fuel, artwork, parts] of variants) {
  test(`${artwork}: each numbered marker and list entry selects exactly its named part`, () => {
    const app = explorer({ category, fuel });
    assert.equal(app.one(node => node.type === 'img').props.src, `/parts-guide/${artwork}.webp`);
    const markers = app.nodes().filter(partMarker);
    assert.deepEqual(markers.map(node => node.props['aria-label']), parts.map(part => `Select ${part} from illustration`));
    assert.deepEqual(markers.map(text), ['1', '2', '3', '4']);
    for (const part of parts) {
      for (const control of ['marker', 'list']) {
        app.update({ part: '' });
        const button = app[control](part);
        assertNativeButton(button);
        assert.equal(button.props['aria-pressed'], false);
        const before = app.calls.part.length;
        button.props.onClick();
        app.render();
        assert.deepEqual(app.calls.part.slice(before), [part]);
        assert.equal(app.marker(part).props['aria-pressed'], true);
        assert.equal(app.list(part).props['aria-pressed'], true);
        assert.equal(app.nodes().filter(node => node.type === 'button' && node.props['aria-pressed'] === true).length, 2);
        assert.ok(app.text().includes(`Selected: ${part}.`));
        const announcement = text(app.one(node => node.props?.['aria-live'] === 'polite'));
        assert.ok(announcement.includes(`${parts.indexOf(part) + 1}. ${part}`));
        assert.ok(announcement.includes(data.partHints[part]));
      }
    }
    assert.deepEqual(app.calls.category, []);
  });
}

test('both vehicle-map controls open each standard and electric system without choosing a part', () => {
  for (const fuel of ['Petrol', 'Electric']) {
    const expected = standardSystems.filter(id => fuel !== 'Electric' || !['Engine', 'Exhaust'].includes(id));
    const app = explorer({ fuel });
    assert.equal(app.nodes().filter(node => node.type === 'button').length, expected.length * 2);
    for (const id of expected) {
      const system = fuel === 'Electric' ? data.electricDiagramOverrides[id] || data.diagramSystems[id] : data.diagramSystems[id];
      for (const control of ['marker', 'list']) {
        app.update({ category: '', part: '' });
        const button = control === 'marker' ? app.systemMarker(system.name) : app.list(system.shortName);
        assertNativeButton(button);
        button.props.onClick(); app.render();
        assert.equal(app.calls.category.at(-1), id);
        assert.equal(text(app.one(node => node.type === 'h3')), system.name);
        assert.equal(app.focus.at(-1), system.name);
        assert.equal(app.nodes().filter(partMarker).length, system.parts.length);
      }
    }
    assert.deepEqual(app.calls.part, []);
  }
});

test('electric fuel uses the EV overview and excludes combustion systems, while hybrid keeps them', () => {
  for (const fuel of ['Electric', ' electric ', 'Electric (battery)']) {
    const app = explorer({ fuel });
    assert.equal(app.one(node => node.type === 'img').props.src, '/parts-guide/vehicle-electric-overview-v2.png');
    for (const name of ['Engine & cooling', 'Exhaust & emissions']) {
      assert.ok(!app.nodes().some(node => node.props?.['aria-label'] === `${name}: view common parts`));
    }
    assert.equal(app.nodes().filter(node => node.type === 'button').length, 12);
    for (const category of ['Engine', 'Exhaust']) {
      app.update({ category, part: category === 'Engine' ? 'Oil Filter' : 'DPF' });
      assert.equal(app.nodes().filter(partMarker).length, 0, 'a stale combustion selection cannot expose its parts on an EV');
      assert.equal(app.one(node => node.type === 'img').props.src, '/parts-guide/vehicle-electric-overview-v2.png');
    }
  }
  const hybrid = explorer({ fuel: 'Petrol hybrid' });
  assert.equal(hybrid.one(node => node.type === 'img').props.src, '/parts-guide/vehicle-overview-v2.png');
  assert.equal(hybrid.nodes().filter(node => node.type === 'button').length, 16);
  assert.ok(hybrid.systemMarker('Engine & cooling'));
  assert.ok(hybrid.systemMarker('Exhaust & emissions'));
});

test('foreign or stale parts are not announced as selected in another system or EV variant', () => {
  for (const [category, fuel, part] of [
    ['Brakes', 'Petrol', 'Oil Filter'], ['Electrical', 'Electric', 'Alternator'], ['Drivetrain', 'Electric', 'Clutch Kit'],
  ]) {
    const app = explorer({ category, fuel, part });
    assert.ok(!app.nodes().some(node => node.props?.['aria-pressed'] === true));
    assert.ok(!app.text().includes(`Selected: ${part}.`));
    assert.match(text(app.one(node => node.props?.['aria-live'] === 'polite')), /Tap a numbered marker/);
    assert.deepEqual(app.calls.part, []);
  }
});

test('return-to-map calls only the category callback and restores focus to the map heading', () => {
  const app = explorer();
  assert.deepEqual(app.focus, [], 'initial map does not steal focus');
  app.systemMarker('Braking system').props.onClick(); app.render();
  assert.deepEqual(app.focus, ['Braking system']);
  app.marker('Brake Pads').props.onClick(); app.render();
  assert.deepEqual(app.focus, ['Braking system'], 'part selection does not refocus the section heading');
  app.one(node => node.type === 'button' && text(node).includes('Return to system map')).props.onClick();
  app.render();
  assert.deepEqual(app.calls.category, ['Brakes', '']);
  assert.deepEqual(app.calls.part, ['Brake Pads']);
  assert.deepEqual(app.focus, ['Braking system', 'Select the vehicle system']);
  assert.equal(app.nodes().filter(partMarker).length, 0);
});

test('keyboard focus and pointer hover link each part marker to its list highlight without selecting it', () => {
  const app = explorer({ category: 'Brakes' });
  const part = 'Brake Pads';
  const inactiveMarker = markerAppearance(app.marker(part));
  const inactiveList = app.list(part).props.className;
  for (const [control, enter, leave] of [
    ['marker', 'onFocus', 'onBlur'], ['list', 'onFocus', 'onBlur'],
    ['marker', 'onMouseEnter', 'onMouseLeave'], ['list', 'onMouseEnter', 'onMouseLeave'],
  ]) {
    app[control](part).props[enter](); app.render();
    assert.notEqual(markerAppearance(app.marker(part)), inactiveMarker);
    assert.notEqual(app.list(part).props.className, inactiveList);
    assert.equal(app.marker(part).props['aria-pressed'], false);
    assert.equal(app.list(part).props['aria-pressed'], false);
    app[control](part).props[leave](); app.render();
    assert.equal(markerAppearance(app.marker(part)), inactiveMarker);
    assert.equal(app.list(part).props.className, inactiveList);
  }
  app.marker(part).props.onClick(); app.render();
  const selectedAppearance = markerAppearance(app.marker(part));
  app.marker(part).props.onBlur(); app.render();
  assert.equal(markerAppearance(app.marker(part)), selectedAppearance, 'selected highlight survives blur');
  assert.deepEqual(app.calls.part, [part]);
});

test('keyboard focus links overview markers and system-list highlights in both directions', () => {
  const app = explorer();
  const inactiveMarker = markerAppearance(app.systemMarker('Braking system'));
  for (const control of ['marker', 'list']) {
    const get = () => control === 'marker' ? app.systemMarker('Braking system') : app.list('Brakes');
    get().props.onFocus(); app.render();
    assert.equal(app.list('Brakes').props['data-active'], true);
    assert.notEqual(markerAppearance(app.systemMarker('Braking system')), inactiveMarker);
    assert.equal(app.list('Suspension').props['data-active'], false);
    get().props.onBlur(); app.render();
    assert.equal(app.list('Brakes').props['data-active'], false);
    assert.equal(markerAppearance(app.systemMarker('Braking system')), inactiveMarker);
  }
  assert.deepEqual(app.calls, { category: [], part: [] });
});
