# V7 remaining blockers

The local working tree is uncommitted on main. No deployment or scientific certification is implied by local tests.

| Requirement | Exact missing resource / authorization / evidence |
|---|---|
| FIX-001–003 staging infrastructure | Approval to provision the paid architecture in `render.staging.yaml`, approval of Oregon region, and permission to configure/deploy it. Current workspace has no managed PostgreSQL or Key Value. Existing Free Singapore services do not match the proposed architecture. |
| Actual environment configuration | Available Render read-only tools do not expose environment variable presence/values. Verify DATABASE_URL, REDIS_URL, ENVIRONMENT, runtime versions, public API origin and Clerk settings in the authorized dashboard/secret store. Never paste secrets into chat. |
| Existing data migration | Protected backup of current ephemeral SQLite before another restart/redeploy; isolated import, record/ownership reconciliation and restore verification. No live data was accessed or migrated. |
| FIX-004 Clerk acceptance | Correct Clerk test-instance issuer/JWKS or valid RSA PEM, authorized parties/audience and frontend keys in staging secret stores; real login/logout/expiry/revocation and role matrix tests. |
| FIX-008/009 reviewed dataset | Independent review of authentic image/label joins and QC, approved training images, independent negatives and OOD corpus, held-out evaluation and calibration, acceptance thresholds and external review. Training remains blocked. |
| FIX-010 satellite validation | Authorized Earth Engine project/service identity, suitable Sentinel-1 pre/post acquisitions, validated processing and independent flood-reference masks. Observation output remains unavailable. |
| FIX-011 provider acceptance | Additional supported agency bulletins and actual timely observations. Current read-only check returned degraded IMD/JTWC and failed GDACS; no all-clear was inferred. |
| FIX-012 monitoring | Actual receiver/dashboard/subscriber setup and verified failure/recovery notifications. Local workflow and structured logging are prepared. |
| FIX-013 recovery | Selected plan backup retention/encryption verification and full staging restore/rollback under an approved maintenance plan. Local fixture restore is not production backup evidence. |
| FIX-014 / staging gate | Real deployed frontend/API/WebSockets/authentication, sustained load/soak, restart and multi-instance acceptance on the final revision. Local browser fixtures do not establish those results. |
| Institutional operations | Authorized shelter/road feeds, emergency-service integration, approved operating procedures and institutional review. No real emergency dispatch is enabled. |
| Independent final review | Engineering/security review by a reviewer independent of the implementation; native screen-reader acceptance. Automated accessibility-tree and keyboard tests do not substitute for an auditory Narrator/NVDA review. Native automation could not initialize locally. |

The user's instruction prohibits commits/pushes. The current local changes cannot reach hosted CI or Render until that instruction is explicitly revised. Paid/live infrastructure operations also require separate approval under the V7 prompt. Approval of a workspace for read-only inspection did not authorize deployment.

The concrete scope is in [the staging proposal](V7_STAGING_APPROVAL.md). The owner declined publication and paid provisioning on 2026-11-09: **keep all changes local**. The proposal includes disabling automatic deployment on the existing public services before any future approved main-branch push, to avoid an unintended restart of the ephemeral SQLite deployment. Both latest Render read-only calls returned `Unknown tool` although plugin discovery reports Render installed/enabled. The in-app dashboard fallback could not initialize (`failed to write kernel assets`). No current staging price quote has been verified. No more cloud mutations or publishing will be attempted under the current authorization.

The SQLite transfer itself now has a tested [local rehearsal](V7_SQLITE_MIGRATION_REHEARSAL.md), including legacy-schema upgrade on a copy, exact record/ownership comparison, sequence continuity and transactional rollback. That preparation does not replace authorization to export live records or evidence from the actual deployed data.

Additional local runtime, export-integrity, interaction and performance work is documented in [the follow-up review](V7_LOCAL_FOLLOWUP.md). Two actual local servers now pass socket authorization/origin checks, shared quotas and a bounded one-minute HTTP exercise using fixture identities. These results narrow the local gap but leave the hosted acceptance requirements above unchanged.
