import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../app/lib/lens-return.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const key = 'mekivo_lens_return', lifetime = 30 * 60 * 1000, now = 1_792_238_400_000;
function helper({ raw, blocked = false, windowAvailable = true } = {}) {
  const values = new Map(raw === undefined ? [] : [[key, raw]]), exports = {};
  const storage = {
    getItem(name) { if (blocked) throw Error('blocked'); return values.get(name) ?? null; },
    setItem(name, value) { if (blocked) throw Error('blocked'); values.set(name, value); },
    removeItem(name) { if (blocked) throw Error('blocked'); values.delete(name); },
  };
  vm.runInNewContext(code, { exports, ...(windowAvailable ? { window: { sessionStorage: storage } } : {}) });
  return { ...exports, values };
}

test('stores only a bounded part name and 30-minute expiry, including an empty pending draft', () => {
  const app = helper();
  assert.equal(app.readLensReturnDraft(now), null);
  for (const name of ['', 'Brake caliper', 'x'.repeat(150)]) {
    app.saveLensReturnDraft(name, now);
    assert.deepEqual(JSON.parse(app.values.get(key)), { name: name.slice(0, 120), expiresAt: now + lifetime });
    assert.equal(app.readLensReturnDraft(now), name.slice(0, 120));
  }
});

test('reads do not extend expiry; an edit starts a new 30-minute lifetime', () => {
  const app = helper(); app.saveLensReturnDraft('Brake caliper', now);
  assert.equal(app.readLensReturnDraft(now + lifetime - 1), 'Brake caliper');
  assert.equal(JSON.parse(app.values.get(key)).expiresAt, now + lifetime);
  app.saveLensReturnDraft('Oil filter', now + 60_000);
  assert.equal(app.readLensReturnDraft(now + lifetime), 'Oil filter');
  assert.equal(app.readLensReturnDraft(now + lifetime + 60_000), null);
  assert.equal(app.values.has(key), false, 'expired records are deleted');
});

test('malformed, invalid, oversized, expired and implausibly future drafts are removed', () => {
  const invalid = [
    'not JSON', 'null', '[]', '1', '{}',
    JSON.stringify({ name: 5, expiresAt: now + 1 }),
    JSON.stringify({ name: 'x'.repeat(121), expiresAt: now + 1 }),
    JSON.stringify({ name: '', expiresAt: String(now + 1) }),
    JSON.stringify({ name: '', expiresAt: null }),
    JSON.stringify({ name: '', expiresAt: now }),
    JSON.stringify({ name: '', expiresAt: now - 1 }),
    JSON.stringify({ name: '', expiresAt: now + lifetime + 1 }),
    '{"name":"filter","expiresAt":1e999}',
  ];
  for (const raw of invalid) {
    const app = helper({ raw });
    assert.equal(app.readLensReturnDraft(now), null, raw);
    assert.equal(app.values.has(key), false, raw);
  }
});

test('explicit clearing removes pending return without altering unrelated storage', () => {
  const app = helper(); app.values.set('unrelated', 'keep'); app.saveLensReturnDraft('filter', now);
  app.clearLensReturnDraft();
  assert.equal(app.readLensReturnDraft(now), null);
  assert.equal(app.values.get('unrelated'), 'keep');
});

test('unavailable or blocked session storage fails quietly', () => {
  for (const options of [{ blocked: true }, { windowAvailable: false }]) {
    const app = helper(options);
    assert.doesNotThrow(() => app.saveLensReturnDraft('filter', now));
    assert.equal(app.readLensReturnDraft(now), null);
    assert.doesNotThrow(() => app.clearLensReturnDraft());
  }
});
