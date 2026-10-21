# Backup and recovery

Status checked on 21 October 2026: **a live logical database backup has not yet been created or verified**. It remains pending access with the existing database password; no password reset or credential change is authorized for this work. The existing Supabase Free project’s dashboard states that project backups are not included. No backup schedule, paid backup service or production restore was added.

## What is covered

| Item | What it can recover | Current evidence and limits |
| --- | --- | --- |
| Git history and a verified Git bundle | Committed application source, tracked assets and SQL | Source and SQL are present. A separately verified bundle must have its own receipt; Git does not contain live database rows or untracked configuration. |
| Repository schema and migrations | Application database definitions | These describe intended tables, functions and access rules. They are not a copy of the live database and do not establish that production has no schema drift. |
| Synthetic schema/fixture rehearsal | The tested application schema, synthetic rows and access-rule behaviour in its test engine | Seventeen checks passed after restoring a PostgreSQL 18.6 / PGlite 0.5.10 fixture into a fresh isolated engine. Platform authentication was mocked. This is a matching-engine fixture archive, not a native database dump or a recovery of real accounts. |
| Synthetic native dump and restore rehearsal | The tested source schema, synthetic rows and selected security metadata through native PostgreSQL tools | Thirteen checks passed using PostgreSQL 17.11, a custom-format dump, a separate roles export and restoration into a second isolated cluster. Both owned clusters were removed. Authentication dependencies were mocked; no live data, hosted authentication or Vault recovery was tested. |
| Live logical database archive | The original database objects and data actually included in a successful export | **Incomplete.** No live dump, archive-content verification or restore of that dump has been completed. |
| Storage files and hosted configuration | File bytes and the settings needed to reconnect hosted services | Separate scope. Database metadata is not Storage object bytes, and a database dump is not a complete hosted Supabase project backup. |

Keep backup artifacts and private operational receipts outside Git, public assets and shared attachments. A custom-format database archive or compressed fixture is not automatically encrypted. Do not claim encryption, an off-machine copy, retention or an automatic schedule unless each has been implemented and verified separately.

## Prepare an original database backup

1. **Confirm the scope and destination.** Record the current release, available disk space, database version, schemas, extensions, roles and Storage inventory. Use a private destination with restrictive permissions. Agree and verify encryption and key recovery before retaining real account data there. Do not place database dumps or credentials in the repository.
2. **Use the existing database password securely.** The password is still a prerequisite; a public application key or an authenticated website session does not replace it. Obtain it through a private prompt or an ephemeral credential file readable only by the owner. Never put it in chat, command arguments, a logged connection string or a committed environment file. Do not reset the production password, create another project or purchase an add-on to bypass this prerequisite.
3. **Use compatible native tools through an explicit private path.** The live server was PostgreSQL 17.6 when inventoried. Use a compatible PostgreSQL 17 `pg_dump`, `pg_restore`, `pg_dumpall` and `psql`, and record their actual versions. An isolated downloaded tool bundle is acceptable after its origin and integrity are checked; no global installation, app startup service or system PATH change is required. Tool availability alone is not a successful backup.
4. **Connect through the project’s TLS session pooler.** Use the existing dashboard’s session-pooler details, normally port 5432, rather than a transaction-pooling connection. Follow the provider’s certificate/hostname verification instructions, require TLS and stop on connection or certificate errors. Do not disable TLS or print the password. Apply bounded connection and lock timeouts; the export must not write application data.
5. **Export the original approved scope.** Include the required `auth` and `public` schema definitions and data, plus the other inventoried schemas needed for the chosen recovery target. Preserve application functions, triggers, sequences, constraints, indexes, ownership, grants and row-level security policies. Inventory extension-owned and managed objects explicitly. Do not silently omit inaccessible schemas and label the result complete. A default public-schema-only export is not an account backup.
6. **Record roles separately.** Database role definitions are separate from a per-database `pg_dump`. Use the approved roles-only export without role passwords, or equivalent verified role/grant metadata. Document any credentials or platform-managed roles that require a separate recovery procedure; do not alter production roles or passwords.
7. **Validate the archive before calling it a backup.** Require a successful exit and inspect all warnings. Inspect the archive table of contents and confirm the intended schema, data and security sections, including account identities and application tables. Record private row counts, archive size and a cryptographic checksum without copying customer rows or secrets into public reports. Remove only owned temporary credential files when finished.

The documented Supabase CLI dump defaults can exclude managed schemas and do not by themselves provide data and roles. Verify the exact command’s inclusion/exclusion behaviour and actual archive contents. Do not substitute a source-schema export, a customer-facing data export or the synthetic fixture for the original database snapshot.

## Rehearse restoration safely

Restore only into an owned, isolated local database using local-only connections. Keep production credentials, outbound integrations and production writes out of the rehearsal. Do not restore over the live project, reset its password or create a paid project/branch. A production restore needs a separately reviewed plan and explicit approval because it can replace current data and interrupt service.

The live inventory includes `pgcrypto`, `uuid-ossp`, `pg_stat_statements` and `supabase_vault`. A plain local PostgreSQL instance may not provide the same extensions, managed roles, encryption material or Supabase services. Stop on unsupported objects and report the gap; do not remove them silently or claim that mocked replacements prove full platform recovery.

For the scope the target supports, restore with stop-on-error behaviour, then compare object definitions, row counts, sequences, constraints, functions, triggers, grants and RLS policies with the captured source. Exercise isolation and ownership rules using controlled test identities and rolled-back tests. Record what passed, what was omitted and whether the result is an application-schema rehearsal or a faithful restoration of the original archive. Shut down and remove only the rehearsal’s owned resources.

## Storage and platform recovery

Check actual bucket and object inventory rather than relying on rounded usage figures. If objects exist, preserve their file bytes separately from database metadata and verify that files can be recovered. Record any current zero-object finding as a dated observation, not a promise that later backups can omit files.

Maintain a separate private inventory of the configuration required to reconnect authentication, mail, allowed callback URLs, external providers, hosted extensions and encryption/signing material. A role export without passwords, database rows or Vault ciphertext does not independently recover those secrets or the hosted services. Do not claim that restored password hashes, sessions or MFA work until the relevant platform recovery has been exercised safely.

For every real backup, record its date, release, tool versions, included/excluded scope, successful validation, storage location, retention and any restore test. Mark encryption, off-machine copying and scheduling as incomplete until verified. The current work is a bounded manual preparation and synthetic rehearsal, with no added service or spending.

## References

- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase logical backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase CLI database dump](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [PostgreSQL logical backups](https://www.postgresql.org/docs/17/backup-dump.html)
- [PostgreSQL pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)
- [PostgreSQL pg_dumpall](https://www.postgresql.org/docs/17/app-pg-dumpall.html)
