# SQLite migration rehearsal

`backend/scripts/rehearse_sqlite_migration.py` prepares the data-transfer step locally. It does **not** migrate a live service or accept a cloud database. Obtain explicit authorization and a protected offline export before using real user records. Do not restart the existing SQLite-backed Render service to obtain an export: its ephemeral filesystem may be lost.

The command accepts only the disposable `cyclonet-v7` Compose PostgreSQL container on localhost port 55432, database/user `cyclonet_test`. It creates a unique isolated schema, never imports into `public`, and refuses target URL overrides. Backup output must be a new directory under the ignored `.verification` folder. On Windows, verify that directory's inherited access permissions before placing user data there; no encryption guarantee is implied.

## What it verifies

1. Open the offline source read-only and create a consistent SQLite backup, including committed WAL records. Never overwrite an existing backup. Check SQLite integrity.
2. Retain that backup unchanged; upgrade a second disposable copy with the real Alembic migrations. Legacy schema normalization happens only on this second copy.
3. Migrate a fresh, unique PostgreSQL schema. Refuse unknown tables/columns, existing application records, or a modified active-state seed rather than silently dropping fields or overwriting records.
4. Copy in bounded batches inside one transaction. Compare exact typed records, including IDs, owner IDs, nullable measurements, timestamps and saved active-state/fencing fields. Refuse any mismatch. A failed copy rolls back all tables.
5. Advance the classification ID sequence so the next insert cannot collide with imported history. Leave the isolated schema available for inspection.

The report contains counts and an export checksum, not raw records, owner IDs or connection strings. Backup files contain sensitive source data when real records are used and must stay outside version control. Retention/removal should follow the approved data-handling plan.

## Reproduce with authorized offline input

Start `docker compose -f compose.test.yml -p cyclonet-v7 up -d --wait`. From `backend`, set `TEST_POSTGRES_URL` to the disposable Compose connection using the test-only credentials in `compose.test.yml`, then run:

```powershell
..\.verification\backend-venv\Scripts\python.exe -m scripts.rehearse_sqlite_migration --source <authorized-offline-export.sqlite> --output-dir ..\.verification\migration-review-unique
```

This command never switches application configuration, restarts the public app, or merges records into a populated database. A real migration still requires a protected live export, independent record/ownership reconciliation, an approved maintenance window, managed backup/restore verification and deliberate service cutover. Do not point live workers at the rehearsal schema.

## Evidence

`v7-sqlite-migration-rehearsal.json` records a successful complete command run using **synthetic local legacy-schema fixtures**, not user data. `backend/tests/test_v7_sqlite_migration.py` covers consistent backup, WAL records, refused destinations, record preservation, sequence continuity, unknown-schema refusal and rollback. The initial missing-tool failure is retained in `v7-sqlite-migration-before.xml`.
