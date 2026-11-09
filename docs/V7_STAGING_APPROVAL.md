# Proposed staging release — not authorized

This is a proposal only. No resources have been purchased and no local changes have been committed or pushed.

**Owner decision, 2026-11-09:** Keep changes local; no paid resources or publishing. The proposal below is retained for review only. No deployment, production configuration change, commit or push is authorized. Do not treat the proposed spending ceiling as an approved budget.

## Exact scope

Use the confirmed Render **My Workspace** (`tea-d9u9ulu1egvs739fb9q0`) and `render.staging.yaml` to create four separate **Oregon** resources:

| Resource | Configuration |
| --- | --- |
| cyclonet-backend-staging | Standard / 1 CPU, 2 GB; Python 3.11.15; production configuration; PostgreSQL migrations before deploy; readiness probe |
| cyclonet-frontend-staging | Starter / 0.5 CPU, 512 MB; Node 22.22.0; locked build; public HTTPS staging API |
| cyclonet-db-staging | Basic 256 MB PostgreSQL; verify storage, backup retention and encryption in the creation quote |
| cyclonet-redis-staging | Starter / 256 MB Key Value; no eviction; private access |

Manual deployments, main branch, separate staging URLs. Experimental inference and satellite observations remain gated. Do not import live user data for initial acceptance: use explicitly identified staging fixtures.

Current plan specifications were checked at https://render.com/docs/compute-plans on 2026-11-09. The pricing page did not return its actual price table through the available reader. **No current dollar estimate is verified.** Proposed approval ceiling: **USD 60/month total recurring staging cost**, including database storage. Confirm the creation quote before purchasing; stop if it exceeds the ceiling. This ceiling is a spending limit, not a price quote or a capacity guarantee. Do not enable automatic scaling or paid plan upgrades. Additional costs, live migration and public production deployment need separate approval.

## Publication and existing services

The user prohibited commits and pushes. A separate explicit, one-time exception is needed to publish the reviewed local changes to `main` for hosted CI and staging deployment. Existing public services were previously observed with automatic deploys enabled. **Before any push**, disable automatic deployment on those two services, but do not restart them or deploy to them. This production configuration change also requires approval. Otherwise a main-branch push could unexpectedly redeploy the existing SQLite-backed service and lose ephemeral data.

Publish only the reviewed application/configuration/tests and non-sensitive evidence; exclude `.env` files, database copies, image data, local tooling and generated build directories. Perform a final secret scan and review the exact staged diff before the one approved commit/push. Return to the standing no-commit/no-push rule after this release.

## Access and acceptance gates

- On the latest attempt, the Render connector returned `Unknown tool` even for read-only service listing. Restore that connection before any cloud action; recheck inventory, quote and service settings.
- Clerk credentials must belong to the same staging test instance. Configure keys only through secure stores; do not paste them into chat. Verify actual assigned service URLs before setting origins.
- Before approval for public promotion: demonstrate real login/roles, persistence, Redis recovery/fencing, API/WebSockets, provider outage handling, load/soak, backup restore, rollback and failure/recovery notifications.
- Preserve and verify a protected backup of existing SQLite separately before any later approved migration or public-service redeploy.
- Scientific dataset approval, independent negative/OOD corpora, Earth Engine authorization and independent flood references remain separate dependencies. Deployment does not satisfy these gates.
