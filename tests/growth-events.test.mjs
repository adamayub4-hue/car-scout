import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/lib/growth-events.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const paidCampaign = '?utm_source=meta&utm_medium=paid_social&utm_campaign=september_demo&utm_content=budget_car';
const storageKey = 'mekivo_campaign_v2';

function load({ query = '', storage = new Map(), ready = true, blockedStorage = false, trackError = false, server = false, audience = 'included' } = {}) {
  const events = [], timers = new Map(), exports = {};
  let now = 0, nextTimer = 0;
  const window = {
    location: { search: query },
    sessionStorage: {
      getItem(key) { if (blockedStorage) throw new Error('Storage denied'); return storage.get(key) ?? null; },
      setItem(key, value) { if (blockedStorage) throw new Error('Storage denied'); storage.set(key, value); },
    },
    ...(ready ? { va() {} } : {}),
  };
  vm.runInNewContext(code, {
    exports, URLSearchParams,
    ...(server ? {} : { window }),
    Date: { now: () => now },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout(id) { timers.delete(id); },
    require(name) {
      if (name === './analytics-audience') return { analyticsAudience: () => audience, initializeAnalyticsAudience() {} };
      assert.equal(name, '@vercel/analytics');
      return { track(name, properties) {
        if (trackError) throw new Error('Analytics unavailable');
        events.push(JSON.parse(JSON.stringify({ name, properties })));
      } };
    },
  });
  return {
    track: exports.trackGrowthEvent, events, window, storage, timers, setAudience(value) { audience = value; },
    advance(ms) {
      const end = now + ms;
      for (let calls = 0; timers.size; calls++) {
        assert.ok(calls < 300, 'startup retries must be bounded');
        const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (timer.at > end) break;
        now = timer.at; timers.delete(id); timer.callback();
      }
      now = end;
    },
  };
}

test('every existing funnel event keeps its name and exactly two useful Pro properties', () => {
  const app = load({ query: paidCampaign });
  const cases = [
    ['campaign_landing', { landing_mode: 'cars' }, 'cars'],
    ['campaign_landing', { landing_mode: 'parts' }, 'parts'],
    ['vehicle_lookup_success', { has_model: true }, 'parts:model_found'],
    ['vehicle_lookup_success', { has_model: false }, 'parts:model_missing'],
    ['search_submitted', { search_type: 'cars', marketplace: 'all', has_model: true, has_year: true, has_price: true, has_postcode: true }, 'cars:all'],
    ['search_submitted', { search_type: 'parts', search_method: 'diagram', has_part_number: false }, 'parts:diagram'],
    ['search_submitted', { search_type: 'parts', search_method: 'part_number', has_part_number: true }, 'parts:part_number'],
    ['results_shown', { search_type: 'cars', search_method: 'vehicle', result_count: 14 }, 'cars:vehicle'],
    ['results_shown', { search_type: 'cars', result_kind: 'marketplace_links' }, 'cars:marketplace_links'],
    ['results_empty', { search_type: 'parts', search_method: 'catalogue', result_count: 0 }, 'parts:catalogue'],
    ['results_error', { search_type: 'parts', search_method: 'search', reason: 'timeout' }, 'parts:search:timeout'],
    ['results_error', { search_type: 'cars', search_method: 'vehicle', reason: 'unavailable' }, 'cars:vehicle:unavailable'],
    ['marketplace_outbound', { search_type: 'cars', marketplace: 'autotrader', destination: 'search_results' }, 'cars:autotrader:search_results'],
    ['marketplace_outbound', { search_type: 'parts', marketplace: 'ebay', destination: 'listing' }, 'parts:ebay:listing'],
    ['marketplace_outbound', { search_type: 'parts', marketplace: 'ebay', destination: 'all_results' }, 'parts:ebay:all_results'],
  ];
  for (const [name, properties, context] of cases) {
    app.track(name, properties);
    assert.deepEqual(app.events.at(-1), {
      name,
      properties: { campaign: 'meta|paid_social|september_demo|budget_car', context },
    });
  }
  assert.equal(app.events.length, cases.length);
  assert.equal(app.timers.size, 0);
});

test('all car platforms in the current UI have distinct submission context, including More platforms', () => {
  const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('page.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let platforms;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'platformNames') {
      platforms = node.initializer.properties.map(property => property.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(platforms?.includes('more'), 'use the actual current car platform choices');
  const app = load();
  for (const platform of platforms) {
    app.track('search_submitted', { search_type: 'cars', marketplace: platform });
    assert.deepEqual(app.events.at(-1).properties, { campaign: 'direct', context: `cars:${platform}` });
  }
});

test('current paid and scheduled creative links retain each campaign label', () => {
  // Campaign values verified against CAPTIONS-AND-LAUNCH-LEDGER.md and the repo ad brief.
  const campaigns = [
    ['meta', 'paid_social', 'september_demo', 'budget_car'],
    ['tiktok', 'paid_social', 'september_demo', 'budget_car'],
    ...['facebook', 'instagram', 'tiktok'].flatMap(platform =>
      ['budget_car', 'part_number', 'visual_guide'].map(creative => [platform, 'organic_social', 'september_demo', creative])),
    ...['instagram', 'tiktok'].flatMap(platform =>
      ['wrong_part_v1', 'car_search_v1', 'part_number_v1'].map(creative => [platform, 'organic_social', 'september_validation', creative])),
  ];
  for (const [source, medium, campaign, content] of campaigns) {
    const app = load({ query: `?${new URLSearchParams({ utm_source: source, utm_medium: medium, utm_campaign: campaign, utm_content: content })}` });
    app.track('campaign_landing', { landing_mode: content.includes('car') ? 'cars' : 'parts' });
    assert.equal(app.events[0].properties.campaign, [source, medium, campaign, content].join('|'));
  }
});

test('new September creative labels survive landing, clean navigation, and reload attribution', () => {
  for (const content of ['car_shortlist_v1', 'part_number_v2', 'visual_guide_v2']) {
    for (const [source, medium] of [['meta', 'paid_social'], ['instagram', 'organic_social'], ['tiktok', 'paid_social']]) {
      const campaign = [source, medium, 'september_validation', content].join('|');
      const mode = content === 'car_shortlist_v1' ? 'cars' : 'parts';
      const app = load({ query: `?${new URLSearchParams({ utm_source: source, utm_medium: medium, utm_campaign: 'september_validation', utm_content: content })}` });
      app.track('campaign_landing', { landing_mode: mode });
      assert.deepEqual(app.events[0].properties, { campaign, context: mode });
      assert.equal(app.storage.get(storageKey), campaign);

      app.window.location.search = '';
      app.track('marketplace_outbound', { search_type: mode, marketplace: 'ebay', destination: 'listing' });
      const reloaded = load({ storage: app.storage });
      reloaded.track('marketplace_outbound', { search_type: mode, marketplace: 'ebay', destination: 'listing' });
      const expected = { campaign, context: `${mode}:ebay:listing` };
      assert.deepEqual(app.events.at(-1).properties, expected);
      assert.deepEqual(reloaded.events[0].properties, expected);
    }
  }
});

test('approving new creatives does not accept unknown variants or new campaign, source, and medium labels', () => {
  const approved = { utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: 'september_validation', utm_content: 'car_shortlist_v1' };
  const cases = [
    ['utm_content', 'car_shortlist_v2', 'meta|paid_social|september_validation|unknown'],
    ['utm_content', 'part_number_v3', 'meta|paid_social|september_validation|unknown'],
    ['utm_content', 'visual_guide_v3', 'meta|paid_social|september_validation|unknown'],
    ['utm_source', 'unapproved_source', 'unknown|paid_social|september_validation|car_shortlist_v1'],
    ['utm_medium', 'unapproved_medium', 'meta|unknown|september_validation|car_shortlist_v1'],
    ['utm_campaign', 'september_validation_v2', 'meta|paid_social|unknown|car_shortlist_v1'],
  ];
  for (const [key, value, campaign] of cases) {
    const app = load({ query: `?${new URLSearchParams({ ...approved, [key]: value })}` });
    app.track('campaign_landing', { landing_mode: 'cars' });
    assert.deepEqual(app.events[0].properties, { campaign, context: 'cars' });
    assert.equal(app.storage.get(storageKey), campaign);
  }
});

test('new partial or empty UTMs replace the whole campaign rather than inheriting stale fields', () => {
  const app = load({ query: paidCampaign });
  app.track('campaign_landing', { landing_mode: 'cars' });
  app.window.location.search = '?utm_source=tiktok';
  app.track('campaign_landing', { landing_mode: 'parts' });
  assert.equal(app.events.at(-1).properties.campaign, 'tiktok|unknown|unknown|unknown');
  assert.equal(app.storage.get(storageKey), 'tiktok|unknown|unknown|unknown');
  app.window.location.search = '?utm_campaign=';
  app.track('campaign_landing', { landing_mode: 'parts' });
  assert.equal(app.events.at(-1).properties.campaign, 'unknown|unknown|unknown|unknown');
});

test('the same tab retains campaign attribution across clean navigation and reload', () => {
  const app = load({ query: paidCampaign });
  app.track('campaign_landing', { landing_mode: 'cars' });
  app.window.location.search = '?mode=parts&restore=1';
  app.track('search_submitted', { search_type: 'parts', search_method: 'diagram' });
  const reloaded = load({ storage: app.storage });
  reloaded.track('marketplace_outbound', { search_type: 'parts', marketplace: 'ebay', destination: 'listing' });
  assert.equal(app.events.at(-1).properties.campaign, 'meta|paid_social|september_demo|budget_car');
  assert.equal(reloaded.events[0].properties.campaign, 'meta|paid_social|september_demo|budget_car');
});

test('a clean visitor is direct and legacy per-field storage cannot revive mixed attribution', () => {
  const app = load({ storage: new Map([['mekivo_utm_source', 'meta'], ['mekivo_utm_content', 'budget_car']]) });
  app.track('campaign_landing', { landing_mode: 'cars' });
  assert.equal(app.events[0].properties.campaign, 'direct');
});

test('only approved marketing labels are normalized; unknown or private URL values are never retained', () => {
  const app = load({ query: '?utm_source=INSTAGRAM&utm_medium=organic_social&utm_campaign=september_validation&utm_content=wrong_part_v1' });
  app.track('campaign_landing', { landing_mode: 'parts' });
  assert.equal(app.events[0].properties.campaign, 'instagram|organic_social|september_validation|wrong_part_v1');
  for (const unsafe of ['person@example.test', 'john_smith', 'AB12CDE', 'https://private.test/user/123', 'x'.repeat(500), 'budget_car|person', 'unknown_campaign']) {
    app.window.location.search = `?utm_source=${encodeURIComponent(unsafe)}&utm_medium=${encodeURIComponent(unsafe)}&utm_campaign=${encodeURIComponent(unsafe)}&utm_content=${encodeURIComponent(unsafe)}`;
    app.track('campaign_landing', { landing_mode: 'cars' });
    assert.equal(app.events.at(-1).properties.campaign, 'unknown|unknown|unknown|unknown');
    assert.equal(app.storage.get(storageKey), 'unknown|unknown|unknown|unknown');
  }
});

test('stored campaign data is validated again before use', () => {
  for (const [stored, expected] of [
    ['meta|paid_social|person@example.test|john_smith', 'meta|paid_social|unknown|unknown'],
    ['meta|paid_social|september_demo|budget_car|extra', 'direct'],
    ['x'.repeat(500), 'direct'],
  ]) {
    const app = load({ storage: new Map([[storageKey, stored]]) });
    app.track('campaign_landing', { landing_mode: 'cars' });
    assert.equal(app.events[0].properties.campaign, expected);
  }
});

test('free-text, identifiers, arbitrary context fields, and unknown event names cannot reach analytics', () => {
  const app = load();
  app.track('marketplace_outbound', {
    search_type: 'person@example.test', marketplace: 'private listing', destination: 'https://private.test',
    campaign: 'override', context: 'override', user_id: '123', query: 'Ford AB12CDE', postcode: 'SW1A1AA',
  });
  assert.deepEqual(app.events[0].properties, { campaign: 'direct', context: 'unknown:unknown:unknown' });
  app.track('person@example.test', { anything: 'private' });
  assert.equal(app.events.length, 1);
});

test('blocked storage keeps the latest campaign in memory and cannot undo the visitor action', () => {
  const app = load({ query: paidCampaign, blockedStorage: true, storage: new Map([[storageKey, 'tiktok|organic_social|september_validation|wrong_part_v1']]) });
  assert.doesNotThrow(() => app.track('campaign_landing', { landing_mode: 'cars' }));
  app.window.location.search = '';
  app.track('search_submitted', { search_type: 'cars', marketplace: 'all' });
  assert.equal(app.events.at(-1).properties.campaign, 'meta|paid_social|september_demo|budget_car');
});

test('the first landing waits briefly for SDK initialization without changing its campaign snapshot', () => {
  const app = load({ query: paidCampaign, ready: false });
  app.track('campaign_landing', { landing_mode: 'cars' });
  assert.equal(app.events.length, 0);
  assert.equal(app.timers.size, 1);
  app.window.location.search = '?utm_source=tiktok';
  app.track('search_submitted', { search_type: 'parts', search_method: 'diagram' });
  app.window.va = () => {};
  app.advance(50);
  assert.deepEqual(app.events.map(event => event.properties.campaign), [
    'meta|paid_social|september_demo|budget_car', 'tiktok|unknown|unknown|unknown',
  ]);
  assert.deepEqual(app.events.map(event => event.name), ['campaign_landing', 'search_submitted']);
  assert.equal(app.timers.size, 0);
  app.advance(5000);
  assert.equal(app.events.length, 2);
});

test('a ready SDK flushes pending events before the next click without duplicate timer delivery', () => {
  const app = load({ ready: false });
  app.track('campaign_landing', { landing_mode: 'cars' });
  app.window.va = () => {};
  app.track('search_submitted', { search_type: 'cars', marketplace: 'all' });
  app.advance(100);
  assert.deepEqual(app.events.map(event => event.name), ['campaign_landing', 'search_submitted']);
  assert.equal(app.timers.size, 0);
});

test('startup buffering is bounded when analytics is missing or disabled', () => {
  const app = load({ ready: false });
  for (let index = 0; index < 50; index++) app.track('campaign_landing', { landing_mode: 'cars' });
  assert.equal(app.timers.size, 1);
  app.window.va = () => {};
  app.advance(50);
  assert.equal(app.events.length, 20);
  const missing = load({ ready: false });
  missing.track('campaign_landing', { landing_mode: 'parts' });
  missing.advance(5000);
  assert.equal(missing.events.length, 0);
  assert.equal(missing.timers.size, 0);
  missing.window.va = () => {};
  missing.track('search_submitted', { search_type: 'parts', search_method: 'part_number' });
  assert.equal(missing.events.length, 1);
  assert.equal(missing.events[0].name, 'search_submitted');
});

test('SDK failures and server execution remain optional and never throw', () => {
  const failed = load({ trackError: true, ready: false });
  assert.doesNotThrow(() => failed.track('campaign_landing', { landing_mode: 'cars' }));
  failed.window.va = () => {};
  assert.doesNotThrow(() => failed.advance(50));
  assert.doesNotThrow(() => failed.track('search_submitted', { search_type: 'cars', marketplace: 'all' }));
  const server = load({ server: true });
  assert.doesNotThrow(() => server.track('campaign_landing', { landing_mode: 'cars' }));
  assert.equal(server.events.length, 0);
  assert.equal(server.timers.size, 0);
});

test('excluded visits never emit events or retain campaign attribution', () => {
  const app = load({ query: paidCampaign, audience: 'excluded' });
  app.track('campaign_landing', { landing_mode: 'cars' });
  app.track('marketplace_outbound', { marketplace: 'ebay', search_type: 'cars', destination: 'listing' });
  assert.equal(app.events.length, 0);
  assert.equal(app.storage.size, 0);
  assert.equal(app.timers.size, 0);
});

test('owner resolution discards pending events even when the SDK was already loaded', () => {
  const app = load({ audience: 'pending' });
  app.track('campaign_landing', { landing_mode: 'cars' });
  app.advance(3000);
  assert.equal(app.events.length, 0);
  app.setAudience('excluded');
  app.advance(50);
  app.setAudience('included');
  app.track('search_submitted', { search_type: 'cars', marketplace: 'all' });
  assert.deepEqual(app.events.map(event => event.name), ['search_submitted']);
});

test('customer identity resolution has a separate deadline from SDK startup', () => {
  const app = load({ audience: 'pending', ready: false });
  app.track('campaign_landing', { landing_mode: 'cars' });
  app.advance(7000);
  app.setAudience('included');
  app.advance(1000);
  app.window.va = () => {};
  app.advance(50);
  assert.deepEqual(app.events.map(event => event.name), ['campaign_landing']);
  const uncertain = load({ audience: 'pending' });
  uncertain.track('campaign_landing', { landing_mode: 'cars' });
  uncertain.advance(12000);
  assert.equal(uncertain.events.length, 0);
  assert.equal(uncertain.timers.size, 0);
});

test('opting out clears SDK startup events instead of sending them later', () => {
  const app = load({ ready: false });
  app.track('campaign_landing', { landing_mode: 'cars' });
  app.setAudience('excluded');
  app.window.va = () => {};
  app.advance(50);
  assert.equal(app.events.length, 0);
  assert.equal(app.timers.size, 0);
});
