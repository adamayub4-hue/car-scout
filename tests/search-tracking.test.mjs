import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const guideSource = readFileSync(new URL('../app/components/parts-guide.tsx', import.meta.url), 'utf8');
const carResultsSource = readFileSync(new URL('../app/components/car-search-results.tsx', import.meta.url), 'utf8');
const guideDataSource = readFileSync(new URL('../app/lib/parts-guide-data.ts', import.meta.url), 'utf8');
const searchSource = readFileSync(new URL('../app/lib/search.ts', import.meta.url), 'utf8');
function loadModule(source) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, URL, URLSearchParams });
  return exports;
}
const searchHelpers = loadModule(searchSource);
const guideData = loadModule(guideDataSource);
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
    'Choose a budget, or add a make and model to narrow it down.',
    'Press Search to browse eBay cars here, or open another site.',
    'Use the registration, or enter the make, model and year.',
    'Open the listing and confirm fitment with the seller.',
  ]) {
    assert.match(source, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(carResultsSource, /These sites show their listings on their own websites; live listings inside Mekivo currently come from eBay\./);
  assert.match(carResultsSource, /Open your prepared search in a new tab\./);
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
    assert.match([source, guideSource, guideDataSource].join("\n"), new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch([source, guideSource].join("\n"), /NEXT_PUBLIC_VEHICLE_DIAGRAMS_ENABLED/);
  assert.doesNotMatch([source, guideSource].join("\n"), /<g[^>]*role="button"/);
  assert.match([source, guideSource, guideDataSource].join("\n"), /focus-visible:ring/);
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

test('each visual system has one selectable reference and explanation for every part', () => {
  const { diagramSystems, electricDiagramOverrides, partHints, systemIllustrations, illustrationHotspots } = guideData;
  const systems = [
    ...Object.entries(diagramSystems),
    ...Object.entries(electricDiagramOverrides).map(([name, system]) => [`Electric${name}`, system]),
  ];
  for (const [systemName, system] of systems) {
    const artwork = systemIllustrations[systemName];
    assert.ok(artwork, `${systemName}: image reference`);
    assert.ok(existsSync(new URL(`../public/parts-guide/${artwork}.webp`, import.meta.url)), `${artwork}: image exists`);
    assert.equal(system.parts.length, illustrationHotspots[artwork]?.length, `${systemName}: marker count`);
    assert.equal('partPositions' in system, false, `${systemName}: obsolete coordinates removed`);
    for (const part of system.parts) assert.ok(partHints[part], `${systemName}: ${part}`);
  }
  assert.deepEqual(Object.keys(illustrationHotspots).sort(), Object.values(systemIllustrations).sort(), 'every artwork has its own reviewed anchors');
});

test('numbered part names match the reviewed artwork order, including distinct electric layouts', () => {
  // A label change/reorder must be reviewed against the image, not silently move
  // a number to a different component. These are the depicted parts in order.
  const depictedParts = {
    'engine-cooling-v1': ['Air Filter', 'Oil Filter', 'Timing Belt', 'Water Pump'],
    'braking-system-v1': ['Brake Disc', 'Brake Pads', 'Brake Caliper', 'ABS Sensor'],
    'suspension-v1': ['Shock Absorber', 'Coil Spring', 'Control Arm', 'Drop Link'],
    'body-lighting-v1': ['Front Bumper', 'Headlight', 'Wing Mirror', 'Tail Light'],
    'electrical-v1': ['Battery', 'Alternator', 'Starter Motor', 'Fuse Box'],
    'interior-controls-v1': ['Steering Wheel', 'Dashboard', 'Front Seat', 'Gear Knob'],
    'exhaust-emissions-v1': ['Exhaust Back Box', 'Catalytic Converter', 'DPF', 'Oxygen Sensor'],
    'drivetrain-v1': ['Clutch Kit', 'Gearbox', 'Driveshaft', 'CV Joint'],
    'ev-electrical-v1': ['12V Battery', 'Drive Motor', 'Power Inverter', 'Onboard Charger'],
    'ev-drivetrain-v1': ['Reduction Gear', 'Driveshaft', 'CV Joint', 'Differential'],
  };
  for (const [systemName, artwork] of Object.entries(guideData.systemIllustrations)) {
    const system = systemName.startsWith('Electric') && systemName !== 'Electrical'
      ? guideData.electricDiagramOverrides[systemName.slice('Electric'.length)]
      : guideData.diagramSystems[systemName];
    assert.deepEqual(Array.from(system.parts), depictedParts[artwork], artwork);
  }
});

test('artwork anchors keep 44px targets inside a narrow image without overlapping', () => {
  // A 240px-wide, uncropped 3:2 plate is narrower than the normal mobile card.
  const width = 240, height = 160, targetSize = 44;
  for (const [artwork, positions] of Object.entries(guideData.illustrationHotspots)) {
    const centres = positions.map((position, index) => {
      assert.equal(position.length, 2, `${artwork} #${index + 1}: coordinate pair`);
      for (const coordinate of position) assert.ok(Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 100, `${artwork}: percentage coordinates`);
      const [x, y] = [position[0] * width / 100, position[1] * height / 100];
      assert.ok(x >= targetSize / 2 && x <= width - targetSize / 2, `${artwork} #${index + 1}: horizontal clipping`);
      assert.ok(y >= targetSize / 2 && y <= height - targetSize / 2, `${artwork} #${index + 1}: vertical clipping`);
      return [x, y];
    });
    for (let i = 0; i < centres.length; i += 1) {
      for (let j = i + 1; j < centres.length; j += 1) {
        assert.ok(Math.abs(centres[i][0] - centres[j][0]) >= targetSize || Math.abs(centres[i][1] - centres[j][1]) >= targetSize, `${artwork}: #${i + 1} and #${j + 1} targets overlap`);
      }
    }
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
    let revision = 7;
    const ctx = {
      vehicleType: 'cars', make: 'Audi', model: 'A3', year: '2018', price: '', minPrice: '', carSort: 'price_asc', hideUnwanted: true, postcode: '', platform: 'all',
      vehicleReady: true, vehicleLabel: '2018 Audi A3', engine: '', fuel: '', bodyStyle: '',
      part: 'oil filter', partCategory: '', partNumber: '06J115403Q', partMethod: 'search',
      setError() {}, setShowResults() {}, setPartNumber() {}, setPartMethod() {}, setPartCategory() {}, setPart() {},
      ...searchHelpers, setSubmittedSearch() {},
      setCarSearchRevision(update) { revision = typeof update === 'function' ? update(revision) : update; },
      trackGrowthEvent() {},
      trackActivity: (...args) => { events.push(args); return new Promise(() => {}); },
      searchEbay: (...args) => searches.push(args),
    };
    // Side effects must happen in the click's synchronous turn, not after telemetry.
    const run = handler(name, ctx);
    const pending = run();
    assert.equal(events.length, 1);
    assert.equal(searches.length, 1);
    assert.equal(revision, name === 'handleCarSearch' ? 8 : 7, 'only a car submission resets the car results view');
    await pending;
    if (name === 'handleCarSearch') {
      const repeated = run();
      assert.equal(revision, 9, 'submitting identical criteria again creates a fresh results view');
      assert.equal(events.length, 2);
      assert.equal(searches.length, 2);
      await repeated;
    }
  });
}
test('external marketplace opens in the click turn despite stalled analytics', async () => {
  const opened = [];
  let revision = 20;
  let searchInfo = { checkedCount: 96, pagesChecked: 2, hasMore: true, partial: true };
  const pending = handler('handleCarSearch', {
    vehicleType: 'cars', make: 'Audi', model: 'A3', year: '', price: '', minPrice: '', carSort: 'price_asc', hideUnwanted: true, postcode: '', platform: 'autotrader',
    trackGrowthEvent() {},
    ...searchHelpers, setSubmittedSearch() {}, ebayRequest: { current: { id: 0, controller: null } }, setEbayLoading() {},
    setCarSearchInfo(value) { searchInfo = value; },
    setCarSearchRevision(update) { revision = typeof update === 'function' ? update(revision) : update; },
    setError() {}, setShowResults() {}, trackActivity: () => new Promise(() => {}),
    window: { open: (...args) => opened.push(args) },
  })();
  assert.equal(opened.length, 1);
  assert.equal(revision, 21, 'an external-marketplace search also resets the previous results view');
  assert.equal(searchInfo, null, 'external marketplace results cannot retain the previous live search metadata');
  assert.equal(new URL(opened[0][0]).hostname, 'www.autotrader.co.uk');
  assert.equal(new URL(opened[0][0]).searchParams.get('model'), 'A3');
  await pending;
});
for (const kind of ['session rejection', 'insert rejection', 'missing client', 'signed out']) {
  test(`optional tracking handles ${kind}`, async () => {
    let inserts = 0;
    const fn = handler('trackActivity', {
      analyticsAudience: () => 'included',
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
      if (name === 'react') return { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => slots[i] = v]; }, useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; } };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/navigation') return { useRouter: () => ({ push() { throw new Error('Unexpected redirect'); } }) };
      if (name === '../lib/saved-search') return { withRequestDeadline: request => Promise.resolve(request), getSavedSearchUrl: () => '/?restore=1&mode=cars' };
      if (name === '../lib/supabase') return { getSupabaseBrowserClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'test' } } }) },
        from: table => ({ insert: () => table === 'saved_items' ? Promise.resolve({ error: null }) : telemetry === 'stalled' ? new Promise(() => {}) : Promise.reject(new Error('offline')) }),
      }) };
      if (name === '../lib/analytics-audience') return { analyticsAudience: () => 'included' };
      throw new Error(name);
    } });
    const render = () => { cursor = 0; return exports.default({ item: { kind: 'car_search', title: 'Test', data: {} } }); };
    const button = render().props.children[0];
    await button.props.onClick();
    assert.equal(render().props.children[0].props.children, '✓ Saved');
  });
}

for (const audience of ['excluded', 'pending']) {
  test(`optional account activity skips ${audience} visitors`, async () => {
    let sessionCalls = 0;
    const fn = handler('trackActivity', { analyticsAudience: () => audience, getSupabaseBrowserClient: () => { sessionCalls++; throw new Error('Should not run'); } });
    await fn('car_search', {});
    assert.equal(sessionCalls, 0);
  });
}

test('account activity rechecks exclusion after session lookup', async () => {
  let audience = 'included', inserts = 0;
  const fn = handler('trackActivity', {
    analyticsAudience: () => audience,
    getSupabaseBrowserClient: () => ({
      auth: { getSession: async () => { audience = 'excluded'; return { data: { session: { user: { id: 'owner' } } } }; } },
      from: () => ({ insert: async () => { inserts++; } }),
    }),
  });
  await fn('car_search', {});
  assert.equal(inserts, 0);
});
