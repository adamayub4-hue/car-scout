import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const landingCode = compile('../app/lib/campaign-landing.ts');
const growthCode = compile('../app/lib/growth-events.ts');
const campaign = '?utm_source=facebook&utm_medium=organic_social&utm_campaign=october_followon&utm_content=followon_budget_v1';

function harness({ query = campaign, audience = 'included', server = false, storage = new Map() } = {}) {
  const events = [], requests = [];
  const browser = { location: new URL(`https://mekivo.uk/${query}`), va() {}, sessionStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } };
  const globals = { URLSearchParams, Date, setTimeout, clearTimeout, ...(server ? {} : { window: browser }) };
  const growth = {};
  vm.runInNewContext(growthCode, { ...globals, exports: growth, require(name) {
    if (name === './analytics-audience') return { analyticsAudience: () => audience, initializeAnalyticsAudience() {} };
    assert.equal(name, '@vercel/analytics');
    return { track: (name, properties) => events.push(JSON.parse(JSON.stringify({ name, properties }))) };
  } });
  const context = vm.createContext({ ...globals, exports: {}, require(name) {
    assert.equal(name, './growth-events');
    return { trackGrowthEvent(name, properties) {
      requests.push(JSON.parse(JSON.stringify({ name, properties })));
      growth.trackGrowthEvent(name, properties);
    } };
  } });
  vm.runInContext(landingCode, context);
  return { events, requests, storage, track: mode => context.exports.trackCampaignLanding(mode), navigate(path) { browser.location = new URL(path, browser.location.origin); } };
}

test('StrictMode effect replay and navigation between public search pages record one landing per document', () => {
  const h = harness();
  h.track('cars'); h.track('cars');
  h.navigate(`/parts${campaign}`); h.track('parts');
  h.navigate(`/motorbikes${campaign}`); h.track('motorbikes');
  assert.deepEqual(h.requests, [{ name: 'campaign_landing', properties: { landing_mode: 'cars' } }]);
  assert.deepEqual(h.events, [{ name: 'campaign_landing', properties: { campaign: 'facebook|organic_social|october_followon|followon_budget_v1', context: 'cars' } }]);
});

test('car, motorbike and parts entries keep only the approved static context, never private URL fields', () => {
  for (const mode of ['cars', 'motorbikes', 'parts']) {
    const h = harness({ query: `${campaign}&registration=PRIVATE&postcode=PRIVATE&q=PRIVATE#PRIVATE` });
    h.track(mode);
    assert.deepEqual(h.events, [{ name: 'campaign_landing', properties: { campaign: 'facebook|organic_social|october_followon|followon_budget_v1', context: mode } }]);
    assert.ok(!JSON.stringify([h.requests, h.events, [...h.storage]]).includes('PRIVATE'));
  }
});

test('plain, shared and saved searches without campaign labels do not invent a landing', () => {
  for (const query of ['', '?restore=1&mode=cars&price=500', '?restore=1&mode=parts&part_number=06J115403Q', '?guide=1&mode=parts']) {
    const h = harness({ query }); h.track('cars'); h.track('parts');
    assert.equal(h.requests.length, 0, query); assert.equal(h.events.length, 0); assert.equal(h.storage.size, 0);
  }
});

test('fresh documents can count their own arrival and preserve normal campaign attribution', () => {
  const first = harness(); first.track('cars');
  const nextDocument = harness({ storage: first.storage }); nextDocument.track('parts');
  assert.equal(first.events.length, 1); assert.equal(nextDocument.events.length, 1);
  assert.equal(nextDocument.events[0].properties.context, 'parts');
  assert.equal(nextDocument.events[0].properties.campaign, first.events[0].properties.campaign);
});

test('owner/testing exclusions suppress storage and delivery, while server execution never accesses browser state', () => {
  const owner = harness({ audience: 'excluded' }); owner.track('parts'); owner.track('cars');
  assert.equal(owner.events.length, 0); assert.equal(owner.storage.size, 0);
  const server = harness({ server: true });
  assert.doesNotThrow(() => server.track('cars'));
  assert.equal(server.requests.length, 0); assert.equal(server.storage.size, 0);
});

test('unknown campaign values are reduced to bounded labels rather than copied from a landing URL', () => {
  const h = harness({ query: '?utm_source=PRIVATE@example.test&utm_campaign=PRIVATE&utm_content=PRIVATE&registration=PRIVATE' });
  h.track('cars');
  assert.deepEqual(h.events, [{ name: 'campaign_landing', properties: { campaign: 'unknown|unknown|unknown|unknown', context: 'cars' } }]);
  assert.ok(!JSON.stringify([h.events, [...h.storage]]).includes('PRIVATE'));
});
