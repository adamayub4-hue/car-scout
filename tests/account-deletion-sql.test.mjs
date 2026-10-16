import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../supabase/migrations/202610170100_admin_account_deletion.sql', import.meta.url), 'utf8');
// PGlite's PostgreSQL provides gen_random_uuid() in core. The application schema
// is executed unchanged apart from its unnecessary optional pgcrypto extension.
const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
  .replace(/^create extension if not exists pgcrypto;\s*/i, '');
const owner = '00000000-0000-4000-8000-000000000001';
const admin = '00000000-0000-4000-8000-000000000002';
const selected = '00000000-0000-4000-8000-000000000003';
const unrelated = '00000000-0000-4000-8000-000000000004';
const missing = '00000000-0000-4000-8000-000000000099';
const identities = [[owner, 'owner@example.test'], [admin, 'admin@example.test'], [selected, 'selected@example.test'], [unrelated, 'unrelated@example.test']];
const tables = ['auth.users', 'public.profiles', 'public.admins', 'public.saved_items', 'public.complaints', 'public.activity_events'];

test('owner account deletion runs in isolated PostgreSQL with real permissions, RLS and cascades', async t => {
  // One fresh memory-only database: no URL, filesystem persistence, credentials,
  // HTTP services, Supabase account or production records are used.
  const db = await PGlite.create();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      grant usage on schema auth, public to anon, authenticated;
    `);
    await db.exec(schema);
    await db.exec(migration);
    // Mirror Supabase's ordinary table grants; RLS still controls the rows.
    await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;
      create schema testing_storage;
      create table testing_storage.objects (id integer primary key, owner_id uuid references auth.users(id) on delete restrict);
    `);

    async function reset() {
      await db.exec('reset role; set search_path = public; truncate auth.users restart identity cascade;');
      await db.query("select set_config('request.jwt.claim.sub', '', false)");
      for (const [id, email] of identities) await db.query('insert into auth.users (id,email) values ($1,$2)', [id, email]);
      await db.query('insert into public.admins (user_id) values ($1),($2)', [owner, admin]);
      for (const id of [selected, unrelated]) {
        await db.query("insert into public.saved_items (user_id,kind,title,data) values ($1,'car_search','Fixture search','{}')", [id]);
        await db.query("insert into public.complaints (user_id,subject,message) values ($1,'Fixture report','This is a local test report.')", [id]);
        await db.query("insert into public.activity_events (user_id,event_name,metadata) values ($1,'car_search','{}')", [id]);
      }
    }
    async function snapshot() {
      const result = {};
      for (const table of tables) result[table] = (await db.query(`select to_jsonb(r) as row from ${table} r order by to_jsonb(r)::text`)).rows.map(row => row.row);
      return result;
    }
    async function asRole(role, subject, work) {
      assert.ok(['anon', 'authenticated'].includes(role));
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [subject || '']);
      await db.exec(`set role ${role}`);
      try { return await work(); }
      finally {
        await db.exec('reset role');
        await db.query("select set_config('request.jwt.claim.sub', '', false)");
      }
    }
    const remove = (target = selected, email = 'selected@example.test') => db.query('select public.delete_user_account($1::uuid,$2::text) as deleted', [target, email]);
    const rejected = (promise, code) => assert.rejects(promise, error => error.code === code);

    await t.test('the installed RPC has a definer, empty search path and authenticated-only execution', async () => {
      const { rows: [row] } = await db.query(`select p.prosecdef, p.proconfig,
        has_function_privilege('anon',p.oid,'execute') as anon_execute,
        has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
        exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute,
        pg_get_function_result(p.oid) as result_type
        from pg_proc p where p.oid='public.delete_user_account(uuid,text)'::regprocedure`);
      assert.equal(row.prosecdef, true);
      assert.ok(row.proconfig.includes('search_path=""'));
      assert.equal(row.anon_execute, false); assert.equal(row.public_execute, false);
      assert.equal(row.authenticated_execute, true); assert.equal(row.result_type, 'uuid');
    });

    await t.test('all application auth-user foreign keys are actual cascading constraints', async () => {
      const { rows } = await db.query(`select c.conrelid::regclass::text as table_name, c.confdeltype
        from pg_constraint c join pg_namespace n on n.oid=c.connamespace
        where c.contype='f' and c.confrelid='auth.users'::regclass and n.nspname='public' order by 1`);
      assert.deepEqual(rows.map(row => row.table_name), ['activity_events', 'admins', 'complaints', 'profiles', 'saved_items']);
      assert.ok(rows.every(row => row.confdeltype === 'c'));
    });

    await t.test('anonymous callers and authenticated callers with no identity are denied', async () => {
      await reset(); const before = await snapshot();
      await asRole('anon', owner, () => rejected(remove(), '42501'));
      await asRole('authenticated', null, () => rejected(remove(), '42501'));
      assert.deepEqual(await snapshot(), before);
    });

    await t.test('ordinary users cannot delete their own or another account or bypass the RPC', async () => {
      await reset(); const before = await snapshot();
      await asRole('authenticated', selected, async () => {
        await rejected(remove(), '42501');
        await rejected(remove(unrelated, 'unrelated@example.test'), '42501');
        await rejected(db.query('delete from auth.users where id=$1', [unrelated]), '42501');
        const result = await db.query('delete from public.profiles where id=$1 returning id', [unrelated]);
        assert.deepEqual(result.rows, []);
      });
      assert.deepEqual(await snapshot(), before);
    });

    await t.test('owner self-deletion and deletion of any other admin are protected by SQL', async () => {
      await reset(); const before = await snapshot();
      await asRole('authenticated', owner, async () => {
        await rejected(remove(owner, 'owner@example.test'), '42501');
        await rejected(remove(admin, 'admin@example.test'), '42501');
      });
      assert.deepEqual(await snapshot(), before);
    });

    await t.test('a selected UUID and matching authoritative auth email are both required', async () => {
      await reset();
      await db.query('update public.profiles set email=$1 where id=$2', ['stale@example.test', selected]);
      const before = await snapshot();
      await asRole('authenticated', owner, async () => {
        await rejected(remove(null, 'selected@example.test'), '22023');
        await rejected(remove(selected, null), '22023');
        await rejected(remove(selected, '   '), '22023');
        await rejected(remove(selected, 'stale@example.test'), '22023');
        await rejected(remove(unrelated, 'selected@example.test'), '22023');
      });
      assert.deepEqual(await snapshot(), before);
    });

    await t.test('a missing account is an error rather than an unconfirmed success', async () => {
      await reset(); const before = await snapshot();
      await asRole('authenticated', owner, () => rejected(remove(missing, 'missing@example.test'), 'P0002'));
      assert.deepEqual(await snapshot(), before);
    });

    await t.test('confirmed deletion returns exactly the chosen UUID and cascades only that account', async () => {
      await reset(); const before = await snapshot();
      const result = await asRole('authenticated', owner, () => remove(selected, '  SELECTED@EXAMPLE.TEST  '));
      assert.deepEqual(result.rows, [{ deleted: selected }]);
      const after = await snapshot();
      for (const table of tables) {
        const expected = before[table].filter(row => (table === 'auth.users' || table === 'public.profiles' ? row.id : row.user_id) !== selected);
        assert.deepEqual(after[table], expected, table);
      }
      await asRole('authenticated', owner, () => rejected(remove(), 'P0002'));
      assert.deepEqual(await snapshot(), after, 'a repeated call does not delete another account');
    });

    await t.test('a storage-like restrictive dependency rolls the complete operation back', async () => {
      await reset();
      await db.query('insert into testing_storage.objects (id,owner_id) values (1,$1)', [selected]);
      const before = await snapshot();
      // PostgreSQL distinguishes an explicit RESTRICT violation (23001) from
      // the generic foreign-key violation produced by a NO ACTION constraint.
      await asRole('authenticated', owner, () => rejected(remove(), '23001'));
      assert.deepEqual(await snapshot(), before, 'auth/profile/saves/reports/events remain unchanged');
      assert.deepEqual((await db.query('select owner_id from testing_storage.objects')).rows, [{ owner_id: selected }]);
    });

    await t.test('caller search paths and shadow tables cannot manufacture owner authority or redirect deletion', async () => {
      await reset();
      await db.exec('create temporary table admins (user_id uuid); create temporary table users (id uuid,email text);');
      await db.query('insert into pg_temp.admins values ($1)', [selected]);
      await db.exec('set search_path = pg_temp, public');
      const before = await snapshot();
      await asRole('authenticated', selected, () => rejected(remove(unrelated, 'unrelated@example.test'), '42501'));
      assert.deepEqual(await snapshot(), before);
      await asRole('authenticated', owner, () => remove());
      assert.equal((await db.query('select count(*)::integer as count from auth.users where id=$1', [selected])).rows[0].count, 0);
      assert.equal((await db.query('select count(*)::integer as count from auth.users where id=$1', [unrelated])).rows[0].count, 1);
    });

    await t.test('reapplying the actual migration preserves records and restricted execution', async () => {
      await reset(); const before = await snapshot();
      await db.exec(migration);
      assert.deepEqual(await snapshot(), before);
      assert.equal((await db.query("select has_function_privilege('anon','public.delete_user_account(uuid,text)','execute') as allowed")).rows[0].allowed, false);
    });
  } finally { await db.close(); }
});
