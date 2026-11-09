# V7 deployment and recovery verification

No V7 commit, push, Blueprint apply, secret update, paid provisioning or deployment was performed. Local main and fetched origin/main matched the audited commit before editing. The existing Render services therefore do not run this uncommitted V7 working tree.

## Completed locally

- Both Blueprints validate against Render's public schema.
- Real PostgreSQL migrations, schema/model comparisons, indexed pagination, preserved history and fencing tests pass in isolated schemas.
- Real Redis contention, inference admission, lease expiration, wrong-owner renewal and independent process contender tests are covered.
- A disposable PostgreSQL dump was restored to a separate database. Counts and record checksums matched for revision, archive, user-owned classification and active-state tables. The source and restored copy survived a container restart. A rollback/re-upgrade on the restored copy preserved archive and classification records.
- Evidence: [recovery report](v7-local-recovery.json); reproducible script `backend/scripts/verify_disposable_recovery.py`. The measured duration is for tiny local fixtures, not a production RTO or performance benchmark.
- A complete legacy SQLite-to-PostgreSQL rehearsal now passes using synthetic local records: [rehearsal evidence](v7-sqlite-migration-rehearsal.json), [procedure and safeguards](V7_SQLITE_MIGRATION_REHEARSAL.md). The original backup remains unchanged, ownership/nulls/active state compare exactly, and the next generated classification ID follows imported IDs. Unknown schema fields and populated destinations are refused; failed imports roll back all copied tables.

The [staging approval proposal](V7_STAGING_APPROVAL.md) identifies the four resources and deployment prerequisites. Existing public-service automatic deployments must be disabled under explicit approval before any main-branch push. The latest Render connector retry failed with `Unknown tool`; no cloud action was performed.

## Recovery runbook for approved staging

Proposed experimental-service objectives, requiring owner approval: RPO at most 24 hours; RTO at most 60 minutes. These are targets, not measured production guarantees.

1. Confirm target service/database identifiers, region, billing approval and a separate isolated restore database. Never point the local disposable exercise at production.
2. Record the currently healthy deploy revision and Alembic head. Pause writes/ingestion under an approved maintenance plan. Export SQLite before any redeployment can remove ephemeral state; protect exports as sensitive user data.
3. Enable and verify managed backup retention/encryption for the chosen plan; record restore-point age and permissions. Export a PostgreSQL custom-format backup through secure tooling; do not put connection strings or user records in reports.
4. Restore to the isolated database, migrate there, compare row counts and representative records for archive, user ownership, classification and active state. Compare schema revision and indexes. Resolve differences before switching any service.
5. Exercise backend restart, two-worker lease handover, Redis interruption/reconnection, stale-leader write rejection and readiness loss/recovery. A lock alone is not exactly-once processing.
6. Roll back application code to a known compatible revision on the restored copy. Prefer forward schema repair. The fencing downgrade discards generation/token columns and the chronology downgrade rebuilds a derived date; keep old workers stopped. Never downgrade the initial migration on live data as an application rollback.
7. Time the restore and record actual RPO/RTO. Approve promotion only after counts, ownership, schema, auth, routes and source provenance pass. Re-enable writes deliberately and verify the new leader generation.

## Monitoring and incident response

The scheduled workflow now fails on failed readiness instead of swallowing curl errors. `/health` delegates to `/health/ready`; `/health/live` is process liveness only. Request JSON logs include server-generated correlation IDs, route templates, status and duration. Ingestion logs include attempt time, outcome and duration; readiness includes last successful synchronization by source.

Suggested staging thresholds: alert immediately on sustained readiness failures across two checks; investigate 5xx rate above 1% for five minutes or p95 request latency above two seconds for five minutes; alert on missing successful source ingestion for two scheduled cycles (30 minutes at the proposed interval), distinguishing stale source data from infrastructure failure. Tune from measured workload. Model readiness is required only when validated inference is explicitly enabled.

Configure an actual monitoring receiver and workflow-failure subscribers, then demonstrate a deliberate failing check and recovery notification. No messages were sent and no receiver/dashboard was configured by this task. Synthetic traffic is not uptime evidence.

## Still required externally

Actual Clerk sign-in and roles, managed PostgreSQL persistence/redeploy, Redis authenticated transport and reconnection, production-origin API/WebSockets, load/soak, managed backup retention/encryption and restore, alert delivery, deployment rollback and healthy startup must pass on approved staging. The public probe recorded a frontend HTTP error and backend timeout; it is not a successful live acceptance run.
