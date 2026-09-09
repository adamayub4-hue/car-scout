import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const imageRouteSource = readFileSync(new URL('../app/api/vehicle-image/route.ts', import.meta.url), 'utf8');
const nextConfigSource = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function routeFunction(name) {
  const routeAst = ts.createSourceFile('route.ts', imageRouteSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let declaration;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.getText(routeAst) === name) declaration = node.getText(routeAst);
    ts.forEachChild(node, visit);
  }
  visit(routeAst);
  assert.ok(declaration, name);
  const code = ts.transpileModule(`${declaration}\nexports.run = ${name};`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, URL });
  return exports.run;
}

test('first-time guidance explains the complete car and parts journeys', () => {
  for (const message of [
    'New to Mekivo? Start here.',
    'Only the make is required.',
    'Press Search, then choose a marketplace',
    'Use the registration, or enter the make, model and year.',
    'Open the listing and confirm fitment with the seller.',
    'Choose a marketplace to view live listings',
  ]) {
    assert.match(source, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('generic visual parts locator is available without licensed vehicle-specific data', () => {
  for (const message of [
    'Select the vehicle system',
    'General reference · Not vehicle-specific',
    'Illustration is for location guidance only.',
    'Transmission & drivetrain',
    'Exhaust & emissions',
    'Search matching listings',
    'some shown parts will not be fitted to every vehicle',
    'Combustion-engine and exhaust options are hidden for this electric vehicle.',
    'Choose a specific part to continue',
  ]) {
    assert.match(source, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(source, /NEXT_PUBLIC_VEHICLE_DIAGRAMS_ENABLED/);
  assert.doesNotMatch(source, /<g[^>]*role="button"/);
  assert.match(source, /focus-visible:ring/);
});

test('vehicle reference images allow only Wikimedia Commons thumbnail hosts and paths', () => {
  for (const hostname of ['upload.wikimedia.org', 'thumb.wikimedia.org']) {
    assert.match(imageRouteSource, new RegExp(`url\\.hostname === "${hostname.replaceAll('.', '\\.')}"`));
    assert.match(nextConfigSource, new RegExp(`hostname: "${hostname.replaceAll('.', '\\.')}"`));
  }
  assert.match(imageRouteSource, /url\.pathname\.startsWith\("\/wikipedia\/commons\/thumb\/"\)/);
  assert.match(nextConfigSource, /pathname: "\/wikipedia\/commons\/thumb\/\*\*"/);
  assert.match(nextConfigSource, /search: ""/);
  assert.match(nextConfigSource, /port: ""/);
});

test('vehicle reference URL validation rejects unsafe hosts, protocols, paths and ports', () => {
  const safeCommonsUrl = routeFunction('safeCommonsUrl');
  assert.equal(safeCommonsUrl('https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/car.jpg?tracking=1'), 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/car.jpg');
  for (const unsafe of [
    'http://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/car.jpg',
    'https://thumb.wikimedia.org.evil.test/wikipedia/commons/thumb/a/a1/car.jpg',
    'https://thumb.wikimedia.org:444/wikipedia/commons/thumb/a/a1/car.jpg',
    'https://thumb.wikimedia.org/not-commons/car.jpg',
    'javascript:alert(1)',
  ]) assert.equal(safeCommonsUrl(unsafe), null);
});
function handler(name, context) {
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) expression = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return vm.runInNewContext(`${code}\nrun`, context);
}

test('each visual system has one hotspot and explanation for every selectable part', () => {
  const systems = handler('diagramSystems', {});
  const electricCategoryOverrides = handler('electricCategoryOverrides', {});
  const electricSystems = handler('electricDiagramOverrides', { diagramSystems: systems, electricCategoryOverrides });
  const hints = handler('partHints', {});
  for (const [systemName, system] of Object.entries({ ...systems, ...electricSystems })) {
    assert.equal(system.parts.length, system.partPositions.length, systemName);
    for (const part of system.parts) assert.ok(hints[part], `${systemName}: ${part}`);
  }
});

test('diagram search requires a specific part rather than a broad system', async () => {
  const searches = [];
  let error = '';
  const fn = handler('handlePartsSearch', {
    vehicleReady: true, partMethod: 'diagram', part: '', partCategory: 'Engine', partNumber: '',
    setError: value => { error = value; }, setShowResults() {}, trackGrowthEvent() {}, trackActivity() {},
    searchEbay: (...args) => searches.push(args), vehicleLabel: '2018 Audi A3', engine: '', fuel: '', bodyStyle: '',
  });
  await fn();
  assert.equal(searches.length, 0);
  assert.equal(error, 'Choose a specific part before searching.');
});

for (const name of ['handleCarSearch', 'handlePartsSearch', 'handlePartNumberSearch']) {
  test(`${name} starts eBay without waiting for stalled analytics`, async () => {
    const searches = [], events = [];
    const ctx = {
      make: 'Audi', model: 'A3', year: '2018', price: '', postcode: '', platform: 'all',
      vehicleReady: true, vehicleLabel: '2018 Audi A3', engine: '', fuel: '', bodyStyle: '',
      part: 'oil filter', partCategory: '', partNumber: '06J115403Q', partMethod: 'search',
      setError() {}, setShowResults() {}, setPartNumber() {}, setPartMethod() {}, setPartCategory() {}, setPart() {},
      trackGrowthEvent() {},
      trackActivity: (...args) => { events.push(args); return new Promise(() => {}); },
      searchEbay: (...args) => searches.push(args),
    };
    // Side effects must happen in the click's synchronous turn, not after telemetry.
    const pending = handler(name, ctx)();
    assert.equal(events.length, 1);
    assert.equal(searches.length, 1);
    await pending;
  });
}
test('external marketplace opens in the click turn despite stalled analytics', async () => {
  const opened = [];
  const pending = handler('handleCarSearch', {
    make: 'Audi', model: 'A3', year: '', price: '', postcode: '', platform: 'autotrader',
    trackGrowthEvent() {},
    setError() {}, setShowResults() {}, trackActivity: () => new Promise(() => {}),
    carLinks: { autotrader: 'https://example.com/search' }, window: { open: (...args) => opened.push(args) },
  })();
  assert.equal(opened.length, 1);
  await pending;
});
for (const kind of ['session rejection', 'insert rejection', 'missing client', 'signed out']) {
  test(`optional tracking handles ${kind}`, async () => {
    let inserts = 0;
    const fn = handler('trackActivity', {
      getSupabaseBrowserClient: () => kind === 'missing client' ? null : {
        auth: { getSession: async () => { if (kind === 'session rejection') throw new Error('offline'); return { data: { session: kind === 'signed out' ? null : { user: { id: 'test' } } } }; } },
        from: () => ({ insert: async () => { inserts++; throw new Error('offline'); } }),
      },
    });
    await assert.doesNotReject(() => fn('car_search', {}));
    assert.equal(inserts, kind === 'insert rejection' ? 1 : 0);
  });
}

for (const telemetry of ['stalled', 'rejected']) {
  test(`confirmed save succeeds with ${telemetry} tracking`, async () => {
    const saveSource = readFileSync(new URL('../app/components/save-button.tsx', import.meta.url), 'utf8');
    const code = ts.transpileModule(saveSource, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const slots = []; let cursor = 0;
    const exports = {};
    const jsx = (type, props) => ({ type, props });
    vm.runInNewContext(code, { exports, require(name) {
      if (name === 'react') return { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => slots[i] = v]; } };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/navigation') return { useRouter: () => ({ push() { throw new Error('Unexpected redirect'); } }) };
      if (name === '../lib/supabase') return { getSupabaseBrowserClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'test' } } }) },
        from: table => ({ insert: () => table === 'saved_items' ? Promise.resolve({ error: null }) : telemetry === 'stalled' ? new Promise(() => {}) : Promise.reject(new Error('offline')) }),
      }) };
      throw new Error(name);
    } });
    const render = () => { cursor = 0; return exports.default({ item: { kind: 'car_search', title: 'Test', data: {} } }); };
    const button = render().props.children[0];
    await button.props.onClick();
    assert.equal(render().props.children[0].props.children, '✓ Saved');
  });
}
