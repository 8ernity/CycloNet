# V6 remaining blockers

Reviewed 8 November 2026. Release state: **ENGINEERING_READY_DEPLOYMENT_BLOCKED**. Local application gates pass; scientific and operational status remain unvalidated. See [V6_TEST_RESULTS.md](V6_TEST_RESULTS.md) for the actual release state and test revision.

| Blocker | Evidence / required completion |
|---|---|
| V6 staging deployment | No live Render deployment, ingress, real Clerk login/roles, cross-service access, WebSockets, recovery/restore or load verification was completed for this revision. Per the user's instruction, blocked Render troubleshooting was skipped. Proposed resource names do not prove they exist. |
| Hosted CI for V6 | V6 c24c03f hosted backend/frontend passed; secret scan reported a checksum false positive, corrected locally. Follow-up f35d1a0 remains local at user request after Git authentication failed. Complete hosted verification before promotion; Clerk configuration passed the earlier run. |
| V6-011 independent dataset and evaluation | Authentic NOAA inventory exists; prepared, reviewed imagery/labels and independent non-cyclone negatives are incomplete. Training intentionally halts. Complete QC, event-disjoint/near-duplicate checks, training, held-out metrics, calibration, OOD/abstention evaluation and independent review before enabling validated inference. |
| V6-012 satellite and surge validation | Earth Engine project/access and genuine Sentinel-1 processing remain unverified. Observed flood mapping is disabled. Independent flood references and historical water-level comparisons are missing. Assumed terrain and simplified surge stay explicitly experimental. |
| Authorized infrastructure data | No current authorized shelter occupancy, medical, generator, destination-approval or road-condition feed is connected. Real operational fields remain unavailable; examples require scenario opt-in. |
| Institutional operating authority | No emergency-provider authorization, operational procedures or real delivery/recovery exercises were verified. All communication outputs remain exercises/drafts. |

The proposed staging target remains branch `staging`, region Oregon, with `cyclonet-backend-staging`, `cyclonet-frontend-staging`, `cyclonet-db-staging`, `cyclonet-redis-staging` and proposed Earth Engine project `cyclonet-ee-staging-8ernity`. The configuration is not a deployment record. Provide credentials only through the appropriate service secret store, never repository files or chat.

Repository licensing also needs owner confirmation before redistribution: the old README asserted MIT but no license file was found. No license was invented during remediation.

Non-blocking local tool warnings include the Next.js middleware-to-proxy migration notice, existing ESLint warnings, the Starlette/httpx test-client deprecation, and the intentionally weak HMAC fixture used to prove rejection. These are documented rather than hidden. The local Node runtime differs from CI's Node 22, so hosted verification remains necessary.

The local follow-up adds per-class, calibration and abstention diagnostics and decoded/near-image leakage admission. These improve the training machinery but do not resolve the missing independent dataset or scientific review. See [scientific pipeline follow-up](V6_SCIENTIFIC_PIPELINE_FOLLOWUP.md).

The continued local audit now includes all 98 authentic sample frame joins and IR pixel checks. This reduces the outstanding data-preparation work but does not approve those frames: acquisition/nominal-time offsets, older embedded tracks, wind convention, missing pixels and unsupported labels require independent review. The independent negative/OOD corpus and full independent evaluation remain absent. Later continuation changes are also local only; earlier hosted passes do not certify them. Details and reproduction are in [V6_CONTINUATION_REVIEW.md](V6_CONTINUATION_REVIEW.md).
