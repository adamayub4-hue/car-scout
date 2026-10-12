import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const repo = fileURLToPath(new URL('../', import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const plain = 'https://www.ebay.co.uk/itm/123456789012';
// Synthetic provider payload; never opened and not a genuine referral.
const affiliate = `${plain}?hash=item4abc&campid=5339201924&mkevt=1&customid=provider-reference&opaque=a%2Fb%2Bc`;

function harness(items = []) {
  const calls = [], modules = new Map();
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const exports = {};
    modules.set(filename, exports);
    vm.runInNewContext(code, {
      exports, URL, URLSearchParams, Buffer, AbortController, Date, setTimeout, clearTimeout,
      process: { env: { EBAY_CLIENT_ID: 'fixture-client', EBAY_CLIENT_SECRET: 'fixture-secret' } },
      console: { error() {} },
      fetch: async (url, options) => {
        if (String(url).includes('/oauth2/')) return Response.json({ access_token: 'fixture-token', expires_in: 7200 });
        calls.push({ url: new URL(url), headers: options.headers });
        return Response.json({ itemSummaries: items });
      },
      require(name) {
        if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
        if (name.startsWith('node:')) return nativeRequire(name);
        if (name.startsWith('.')) return load(resolve(dirname(filename), `${name}.ts`));
        throw new Error(`Unexpected import: ${name}`);
      },
    }, { filename });
    return exports;
  }
  const helpers = load(resolve(repo, 'app/lib/search.ts'));
  const { GET } = load(resolve(repo, 'app/api/ebay/search/route.ts'));
  return { calls, helpers, get: query => GET({ nextUrl: new URL(`https://mekivo.uk/api/ebay/search?${query}`) }) };
}

test('native Browse affiliate link reaches the buyer href intact and uses the existing campaign', async () => {
  const h = harness([{ itemId: 'v1|123456789012|0', title: 'OEM Oil Filter 06J115403Q',
    itemWebUrl: plain, itemAffiliateWebUrl: affiliate, buyingOptions: ['FIXED_PRICE'],
    price: { value: '9.50', currency: 'GBP' } }]);
  const response = await h.get('type=parts&q=06J115403Q');
  assert.equal(response.status, 200);
  assert.equal(h.calls[0].headers['X-EBAY-C-ENDUSERCTX'], 'affiliateCampaignId=5339201924,affiliateReferenceId=mekivo-parts-live');
  const { items } = await response.json();
  assert.equal(items[0].url, plain, 'canonical item identity remains unchanged');
  assert.equal(items[0].affiliateUrl, affiliate);
  assert.equal(h.helpers.ebayListingHref(items[0], 'mekivo-parts-shortlist'), affiliate, 'provider custom ID and opaque tracking payload are not overwritten');
});

test('cars and motorbikes request the existing route-specific references without caller data', async () => {
  const h = harness();
  for (const [query, reference] of [
    ['type=cars&q=Ford+Fiesta', 'mekivo-cars-live'],
    ['type=cars&vehicleType=motorbikes&q=Honda+CBR', 'mekivo-motorbikes-live'],
  ]) {
    await h.get(query);
    assert.equal(h.calls.at(-1).headers['X-EBAY-C-ENDUSERCTX'], `affiliateCampaignId=5339201924,affiliateReferenceId=${reference}`);
  }
});

test('unsafe, different-item, different-campaign or malformed native links cannot replace a known item', async () => {
  const { helpers } = harness();
  for (const unsafe of [
    null, {}, 'javascript:alert(1)', affiliate.replace('https:', 'http:'),
    affiliate.replace('www.ebay.co.uk', 'www.ebay.co.uk.evil.test'),
    affiliate.replace('www.ebay.co.uk', 'user@www.ebay.co.uk'),
    affiliate.replace('www.ebay.co.uk', 'www.ebay.co.uk:444'),
    affiliate.replace('123456789012', '123456789013'),
    affiliate.replace('5339201924', '5339999999'),
    `${affiliate}&campid=5339201924`, `${affiliate}#redirect`,
    affiliate.replace('/itm/', '/sch/'), 'x'.repeat(4097),
  ]) {
    assert.equal(helpers.safeNativeEbayAffiliateUrl(unsafe, plain), null);
    const fallback = helpers.ebayListingHref({ url: plain, affiliateUrl: unsafe }, 'mekivo-parts-live');
    assert.equal(new URL(fallback).hostname, 'www.ebay.co.uk');
    assert.equal(new URL(fallback).pathname, '/itm/123456789012');
    assert.equal(new URL(fallback).searchParams.get('campid'), '5339201924');
  }
});

test('API rejects mismatched native payload while preserving older and missing-field behavior', async () => {
  const h = harness([
    { title: 'Correct', itemWebUrl: plain, itemAffiliateWebUrl: affiliate },
    { title: 'Different', itemWebUrl: plain, itemAffiliateWebUrl: affiliate.replace('123456789012', '123456789013') },
    { title: 'No native value', itemWebUrl: plain },
  ]);
  const { items } = await (await h.get('type=parts&q=oil+filter')).json();
  assert.deepEqual(items.map(item => item.affiliateUrl), [affiliate, null, null]);
  assert.equal(new URL(h.helpers.ebayListingHref({ url: plain }, 'old-saved-listing')).searchParams.get('customid'), 'old-saved-listing');
});
