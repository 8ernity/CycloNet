# V7 infrastructure audit

Follow-up: PostgreSQL URL connection options now survive the enforced statement timeout; the schema-selection regression is covered. Both deployment locks install a real WebSocket transport and hash every distribution. Public API startup defers optional PyTorch imports, while explicit validated-model startup remains gated. Two actual local production-mode servers pass HTTP, WebSocket access and shared-quota checks with isolated PostgreSQL/Redis and fixture RSA identities. See [follow-up scope](V7_LOCAL_FOLLOWUP.md) and [network measurements](v7-local-network-soak.json); these are not hosted acceptance results.

Date: 2026-11-09. Read-only Render inspection was authorized for My Workspace. No resources, environment values, live data, deployments, or billing settings were changed.

## Observed deployment

Evidence: [Render inventory](v7-render-observed.json), [public probes](v7-live-readiness.json).

| Setting | Observed services | Prepared configuration |
|---|---|---|
| Branch | main, automatic deploy on commit | main, automatic deploy disabled in the proposed files |
| Region / compute | Singapore / Free for frontend and backend | Oregon / explicitly specified paid plans |
| PostgreSQL | No managed instance in the workspace; backend logs show SQLiteImpl repeatedly | Managed PostgreSQL reference; production SQLite forbidden |
| Redis / Key Value | No managed instance in the workspace | Private Key Value, noeviction |
| Backend runtime | Logs identify PYTHON_VERSION=3.10.12 | Python 3.11.15 |
| Node runtime | Not established by available service details | Node 22.22.0 |
| Installs | Unlocked pip requirements and npm install | Hash-locked Python dependencies and npm ci |
| Readiness path | Empty on both services | Backend /health/ready; frontend /login HTTP check |
| Migration stage | Not shown in the observed service configuration; startup performs SQLite migration | alembic upgrade head before deployment |
| API origin | Actual environment value unavailable to read-only tools | Explicit public HTTPS API URL |
| Clerk configuration | Actual environment values/presence unavailable to these tools | Required secure issuer/JWKS and frontend Clerk variables |

The backend log at 2026-11-09T05:40:45Z reports SQLiteImpl. This proves SQLite was used, but does not disclose the exact DATABASE_URL or ENVIRONMENT value. Missing or non-production ENVIRONMENT was a code path that permitted this configuration; it is an inference about the cause, not a recovered environment value.

## Local corrections

- FIX-001: `backend/app/core/runtime.py` rejects missing/non-production modes on Render and invalid runtime names. `database.py` requires PostgreSQL in production, caps pool defaults at 5 persistent + 5 overflow connections per process, uses pre-ping, connection/query/pool timeouts, and validates revision plus required tables/columns without migration. Development initialization remains a separate explicit startup operation.
- FIX-002: Existing atomic Redis quotas, ownership-checked leases, database fencing and local inference semaphores are retained. Real-service tests cover contention, loss of Redis counters, lease expiration, stale writes and two independent contender processes. No exactly-once guarantee is asserted.
- FIX-003: Both Blueprints use public HTTPS frontend API origins instead of private-network host references, main branch, explicit migration/readiness configuration, bounded pools and graceful shutdown. No proposed resource name is treated as an existing deployment.
- FIX-004: Invalid mandatory authentication configuration now propagates out of startup before workers launch. Clerk issuer/JWKS/origin syntax and supplied RSA public keys are validated.

The current [Render Blueprint reference](https://render.com/docs/blueprint-spec) distinguishes private `host` values from public service addresses. Both files pass the downloaded public JSON schema: [validation](v7-blueprint-validation.json). This is structural validation, not a planned or applied Render sync. Existing resource names and region changes require explicit review before applying; resource replacement must not occur implicitly.

## Proposed staging and connection budget

`render.staging.yaml` is a reviewable, unapplied proposal for backend, frontend, PostgreSQL and non-evicting Key Value in Oregon. It uses main as requested and disables automatic deploys. The staging backend uses production enforcement while the service names/origins remain separate. Confirm allocated database connections before scaling: at most workers × 10 application connections, plus migrations, administration and recovery headroom. Increase pool settings only after measuring the selected database plan.

Required approvals/access: approved paid staging resources and region, permission to configure/deploy them, secure Clerk test-instance values, and read-only environment-presence verification through the service dashboard or another authorized interface. Redis transport/authentication must be verified against the actual private endpoint; TLS is required for any public connection. These checks are not satisfied by YAML alone.
