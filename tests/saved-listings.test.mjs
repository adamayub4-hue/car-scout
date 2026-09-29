import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
function load(relative, modules = new Map()) {
  const filename = resolve(root, relative.endsWith('.ts') ? relative : `${relative}.ts`);
  if (modules.has(filename)) return modules.get(filename);
  const exports = {};
  modules.set(filename, exports);
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, URL, URLSearchParams, Date, setTimeout, clearTimeout, crypto: webcrypto, require: name => load(resolve(dirname(filename), name), modules) }, { filename });
  return exports;
}
const h = load('app/lib/saved-listings.ts');
const listing = changes => ({ id: 'v1|123456789012|0', title: 'Ford Fiesta brake discs', url: 'https://www.ebay.co.uk/itm/Ford-Fiesta/123456789012?campid=other&customid=test#fragment', image: 'https://i.ebayimg.com/images/g/123/s-l640.jpg', price: '24.95', currency: 'GBP', condition: 'New', location: 'GB', postage: { price: '0.00', currency: 'GBP' }, itemEndDate: '2026-10-20T12:00:00Z', ...changes });
const saved = changes => h.createSavedListing(listing(changes), 'parts', '/?restore=1&mode=parts&make=Ford&model=Fiesta&part=Brake+Disc');
const plain = value => JSON.parse(JSON.stringify(value));
function memory() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function db({ rows = [], readError = null, insertError = null, concurrent = false, returnedRow, emptyInsert = false } = {}) {
  const state = { rows: [...rows], inserts: 0, filters: [] };
  const client = { from(table) {
    assert.equal(table, 'saved_items');
    let inserted = null, filters = [];
    const query = {
      select() { return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      maybeSingle: async () => {
        state.filters.push(filters);
        const match = state.rows.find(row => filters.every(([key, value]) => (key === 'data->>id' ? row.data.id : row[key]) === value));
        return { data: match ?? null, error: readError };
      },
      insert(value) { inserted = value; state.inserts++; return query; },
      single: async () => {
        if (concurrent) { state.rows.push({ id: 'concurrent-save', ...inserted }); return { data: null, error: { code: '23505' } }; }
        if (insertError) return { data: null, error: insertError };
        const row = { id: 'new-save', ...inserted };
        if (!emptyInsert) state.rows.push(row);
        return { data: emptyInsert ? null : returnedRow ?? row, error: null };
      },
    };
    return query;
  } };
  return { client, state };
}

test('car and part saves preserve a bounded snapshot and original canonical eBay destination', () => {
  const item = saved();
  assert.equal(item.kind, 'part_listing');
  assert.equal(item.data.id, '123456789012');
  assert.equal(item.data.url, 'https://www.ebay.co.uk/itm/123456789012');
  assert.equal(item.data.price, '24.95');
  assert.equal(item.data.postage.price, '0.00');
  assert.equal(item.data.itemEndDate, '2026-10-20T12:00:00.000Z');
  assert.equal(item.data.searchUrl, '/?restore=1&mode=parts&make=Ford&model=Fiesta&part=Brake+Disc&part_method=search&search_method=vehicle');
  assert.equal(h.createSavedListing(listing(), 'cars').kind, 'car_listing');
  assert.deepEqual(plain(h.parseSavedListing(item)), plain(item));
});

test('listing identity is stable across title paths, trackers and API ids but preserves variations', () => {
  assert.equal(saved({ id: 'some-search-id', url: 'https://m.ebay.com/itm/123456789012?foo=bar' }).data.id, saved().data.id);
  const variation = saved({ url: 'https://www.ebay.co.uk/itm/123456789012?var=998877665544&redirect=https://evil.test' });
  assert.equal(variation.data.id, '123456789012:998877665544');
  assert.equal(variation.data.url, 'https://www.ebay.co.uk/itm/123456789012?var=998877665544');
  assert.equal(saved({ id: 'v1|123456789012|998877665544' }).data.id, variation.data.id);
  assert.equal(saved({ id: 'v1|999999999999|998877665544' }).data.id, saved().data.id);
  assert.equal(saved({ url: 'https://www.ebay.co.uk/itm/123456789012?var=javascript:alert(1)' }).data.id, saved().data.id);
  assert.equal(h.parseSavedListing({ ...variation, data: { ...variation.data, id: '123456789012' } }), null);
});

test('untrusted listing URLs cannot become account links', () => {
  for (const url of ['javascript:alert(1)', '//www.ebay.co.uk/itm/123456789012', 'http://www.ebay.co.uk/itm/123456789012', 'https://ebay.co.uk.evil.test/itm/123456789012', 'https://www.ebay.co.uk@evil.test/itm/123456789012', 'https://user:pass@www.ebay.co.uk/itm/123456789012', 'https://www.ebay.co.uk:8443/itm/123456789012', 'https://www.ebay.co.uk/sch/i.html?q=part', 'https://www.ebay.co.uk/itm/not-a-listing']) {
    assert.equal(saved({ url }), null, url);
  }
  for (const value of [null, [], {}, { kind: 'vehicle', title: 'A', data: saved().data }, { ...saved(), data: { ...saved().data, version: 2 } }, { ...saved(), title: ' ' }]) assert.equal(h.parseSavedListing(value), null);
});

test('invalid images, dates, prices and return destinations are discarded without trusting stored snapshots', () => {
  const item = saved({ image: 'https://user:pass@i.ebayimg.com/images/a.jpg', price: '-20', currency: 'gbp', itemEndDate: 'tomorrow', postage: { price: 'NaN', currency: 'GBP' } });
  assert.equal(item.data.image, null); assert.equal(item.data.price, null); assert.equal(item.data.currency, null); assert.equal(item.data.itemEndDate, null); assert.equal(item.data.postage, null);
  for (const searchUrl of ['https://evil.test/', '//evil.test/', '/admin', '/?analytics=on', '/?restore=1&mode=parts&redirect=https://evil.test']) {
    const parsed = h.parseSavedListing({ ...item, data: { ...item.data, searchUrl } });
    assert.ok(parsed.data.searchUrl.startsWith('/?'));
    assert.ok(!parsed.data.searchUrl.includes('evil'));
  }
  assert.equal(saved({ title: '\u0000' + 'x'.repeat(200) }).title.length, 160);
  assert.equal(saved({ image: 'https://evil.test/photo.jpg' }).data.image, null);
});

test('account persistence is user-filtered and confirms the inserted row', async () => {
  const { client, state } = db();
  const result = await h.saveListingToAccount(client, 'user-a', saved());
  assert.deepEqual(plain(result), { id: 'new-save', alreadySaved: false });
  assert.equal(state.inserts, 1);
  assert.deepEqual(plain(state.filters[0]), [['user_id', 'user-a'], ['kind', 'part_listing'], ['data->>id', '123456789012']]);
  assert.equal(state.rows[0].user_id, 'user-a');
  assert.equal(state.rows[0].title, 'Ford Fiesta Brake Disc');
  assert.deepEqual(Object.keys(state.rows[0].data).sort(), ['id', 'searchUrl', 'url', 'version']);
  const parsed = h.parseSavedListing(state.rows[0]);
  assert.equal(parsed.data.image, null); assert.equal(parsed.data.price, null);
});

test('repeated saves return the existing snapshot without an insert or update', async () => {
  const existing = { id: 'first-save', user_id: 'user-a', ...saved() };
  const { client, state } = db({ rows: [existing] });
  const result = await h.saveListingToAccount(client, 'user-a', saved({ price: '20.00' }));
  assert.deepEqual(plain(result), { id: 'first-save', alreadySaved: true });
  assert.equal(state.inserts, 0);
  assert.equal(state.rows[0].data.price, '24.95', 'a saved snapshot is not silently replaced');
});

test('concurrent duplicate inserts re-read the winning row without UPDATE permission', async () => {
  const { client, state } = db({ concurrent: true });
  assert.deepEqual(plain(await h.saveListingToAccount(client, 'user-a', saved())), { id: 'concurrent-save', alreadySaved: true });
  assert.equal(state.inserts, 1); assert.equal(state.filters.length, 2);
});

test('account errors, unreadable rows and unconfirmed writes never report saved', async () => {
  for (const scenario of [{ readError: new Error('offline') }, { insertError: { code: '42501', message: 'RLS' } }, { emptyInsert: true }]) {
    await assert.rejects(h.saveListingToAccount(db(scenario).client, 'user-a', saved()));
  }
  await assert.rejects(h.saveListingToAccount(db({ rows: [{ id: 'bad', user_id: 'user-a', ...saved(), data: { ...saved().data, url: 'https://evil.test' } }] }).client, 'user-a', saved()));
  // An unrelated/malformed insert response is not accepted; a fresh scoped
  // SELECT must still find the actual saved row.
  const response = db({ returnedRow: { id: 'other', user_id: 'user-b', ...saved() } });
  assert.equal((await h.saveListingToAccount(response.client, 'user-a', saved())).id, 'new-save');
  assert.equal(response.state.filters.length, 2);
});

test('a pending save survives sign-in only with its token and expires after 24 hours', () => {
  const storage = memory(), now = 1_000_000;
  const token = h.stagePendingListing(saved(), storage, now);
  assert.ok(token);
  assert.equal(h.getPendingListingToken(storage, now + 1), token);
  assert.equal(h.getPendingListingExpiresAt(token, storage, now + 1), now + h.PENDING_LISTING_TTL);
  assert.equal(h.getPendingListingExpiresAt('old-token', storage, now + 1), null);
  assert.equal(h.readPendingListing('another-token', storage, now + 1), null);
  assert.equal(h.readPendingListing(token, storage, now + 1).data.id, saved().data.id);
  assert.equal(h.readPendingListing(token, storage, now + h.PENDING_LISTING_TTL), null);
  assert.equal(h.getPendingListingExpiresAt(token, storage, now + h.PENDING_LISTING_TTL), null);
  assert.equal(storage.values.size, 0);
});

test('pending marketplace details expire after six hours while the bookmark can still be saved', () => {
  const storage = memory(), now = 1_000_000;
  const token = h.stagePendingListing(saved(), storage, now);
  const expiry = h.getPendingListingSnapshotExpiresAt(token, storage, now);
  assert.equal(expiry, now + 6 * 60 * 60 * 1_000);
  assert.equal(h.readPendingListing(token, storage, expiry - 1).data.price, '24.95');
  const expired = h.readPendingListing(token, storage, expiry);
  assert.equal(expired.title, 'Ford Fiesta Brake Disc');
  assert.equal(expired.data.price, null); assert.equal(expired.data.image, null);
  assert.equal(expired.data.id, '123456789012');
  assert.equal(h.getPendingListingToken(storage, expiry), token);
  assert.ok(!storage.getItem('mekivo:pending-listing:v1').includes('24.95'));
  assert.equal(h.getPendingListingSnapshotExpiresAt('old-token', storage, expiry), null);
});

test('an older tab cannot clear a replacement pending listing', () => {
  const storage = memory(), now = 1_000_000;
  const first = h.stagePendingListing(saved(), storage, now);
  const next = h.stagePendingListing(saved({ url: 'https://www.ebay.co.uk/itm/999999999999' }), storage, now + 1);
  h.clearPendingListing(first, storage, now + 2);
  assert.equal(h.getPendingListingToken(storage, now + 2), next);
  h.clearPendingListing(next, storage, now + 2);
  assert.equal(h.getPendingListingToken(storage, now + 2), null);
});

test('blocked, corrupt, oversized and future-dated browser storage fail closed', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(h.stagePendingListing(saved(), blocked), null);
  assert.equal(h.readPendingListing('token', blocked), null);
  assert.doesNotThrow(() => h.clearPendingListing('token', blocked));
  const storage = memory(), now = 1_000_000;
  const token = h.stagePendingListing(saved(), storage, now);
  assert.equal(h.readPendingListing(token, storage, now - 1), null);
  for (const invalid of ['{oops', 'x'.repeat(20_000), JSON.stringify({ version: 1, token, createdAt: now, item: { ...saved(), data: { ...saved().data, url: 'https://evil.test' } } })]) {
    storage.setItem('mekivo:pending-listing:v1', invalid);
    assert.equal(h.getPendingListingToken(storage, now), null);
  }
});

test('database migration scopes identity uniqueness to new kinds and preserves existing saves', () => {
  const migration = readFileSync(new URL('../supabase/migrations/202609290200_saved_listings.sql', import.meta.url), 'utf8');
  assert.match(migration, /create unique index if not exists saved_items_listing_identity_idx/);
  assert.match(migration, /\(user_id, kind, \(data->>'id'\)\)/);
  assert.match(migration, /where kind in \('car_listing', 'part_listing'\)/);
  assert.match(migration, /'vehicle', 'car_search', 'part_search', 'car_listing', 'part_listing'/);
  assert.doesNotMatch(migration, /delete\s+from|update\s+public\.saved_items|create\s+policy[\s\S]*for\s+update/i);
});
