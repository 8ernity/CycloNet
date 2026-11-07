# V5 remediation report

Baseline: `e097c977e5ad2334670420c4d62ebd9de3efac14`. Date: 7 November 2026.
Implementation commit: `006b35a69488f7af2e02ef940dee8da86336a4bd`, local branch `staging`.
A documentation/evidence commit follows; resolve the final SHA with `git rev-parse staging`.
No push, hosted CI execution, or deployment was performed.

## Outcome

The implemented engineering fixes pass local verification. **Production release remains
ENGINEERING_READY_DEPLOYMENT_BLOCKED** pending the external gates in `PRODUCTION_READINESS.md`.
The issue-by-issue disposition and reproducible commands are in `ENGINEERING_PROGRESS.json`.
No scientific accuracy, operational disaster-warning authority, or high-availability claim is made.

## Changes

- Preserved nullable measurements end to end, removed invented report/pressure/gust/port-warning
  values, removed browser-generated CAP fallbacks, and separated explicit demo reports.
- Removed unsupported dashboard calm, zero-risk, satellite-observation and accuracy claims.
  Missing source data now displays uncertainty. PDFs retain source, times, and simulation status.
- Added strict model metadata/checksum validation and deployment trust configuration. Restored
  manifest-based training with optimization, independent validation/test splits, export and reload.
- Reconciled storms by source and identity, retaining stale observations during partial outages.
  Unknown observation times stay unknown; unrelated regional calm cannot clear Indian Ocean storms.
- Disabled unavailable satellite-derived flood results while retaining separate simulations.
- Added persisted PostgreSQL fencing, atomic Redis acquisition, lease-aware writes and worker demotion.
  Alembic now owns production schema changes and deployment performs migrations separately.
- Hardened Clerk issuer/audience/authorized-party verification and Redis outage behavior.
  Frontend API calls obtain session tokens and strip credentials from untrusted origins.
- Upgraded dependencies, added exact Python locks and a hashed Linux CPU lock, and expanded CI with
  real-service tests, browser tests, audits and secret scanning. Fixed frontend types, lifecycle
  errors and stale asynchronous responses while preserving the existing page design.

## Results

| Gate | Final result |
|---|---|
| Backend with exact upgraded lock, Windows | **131 passed**, no failures or skips |
| Clean Linux hashed CPU install and backend suite | **131 passed**, no failures or skips |
| PostgreSQL/Redis integration | Included in full suite; all pass |
| Browser regression suite | **3 passed** |
| Frontend API/PDF unit tests | **3 passed** |
| Production Next.js build | Pass; all application routes generated |
| TypeScript | Pass |
| ESLint | Zero errors; warnings recorded in `v5-eslint-summary.json` |
| npm and Python dependency audits | No known vulnerabilities; base-version audit supplements CPU wheels |
| Local backup/restore | Pass; revision, archive record and fencing state recovered |
| Git whitespace check | Pass |

Regression evidence: the six initial P0 regressions failed against baseline; five initial feed
regressions and two training regressions also failed before their corrections. All pass now.
Later contract, security and browser tests extend coverage; not every additional assertion was
individually replayed against baseline. Full machine-readable test/audit results are in `docs/v5-*`.

During verification, an initial hash-generation attempt exhausted system temporary storage,
and a later run encountered stopped Docker services. Workspace-based caches, exact dependency
installation, and restarting the dedicated test services resolved those environmental failures.
The upgraded SQLAlchemy default-driver change was fixed by explicitly selecting psycopg2.
Disposable task downloads were removed and system disk space recovered.

## Remaining gates

1. Complete reviewed image/label joins, pixel preprocessing, independent non-cyclone data and
   scientific evaluation. The authentic NOAA inventory has 12,275 observations from 363 storms,
   with 246 verified HURSAT archive links and one retrieved 98-frame sample. It has zero
   training-eligible rows. Synthetic tests do not establish cyclone classification accuracy.
2. Implement and independently evaluate an authenticated satellite flood pipeline before enabling
   that capability. It currently returns unavailable, with no fabricated observation polygons.
3. Run the configured hosted CI workflow and deploy to a configured staging environment. Verify actual
   Clerk roles/tokens, Render settings, feed availability, monitoring and production recovery/failover.
   This session did not change a hosted service or validate a production service-level objective.

The continuation added reproducible NOAA acquisition, fixed global event partitioning,
preserved frozen CSV split assignments, verified artifact hashes across Git line endings,
and configured the requested Oregon staging names and Earth Engine project target.
Both Render files pass the official schema. Gitleaks scans of current files and 48 existing
commits pass after narrow exclusions for three reviewed invalid-token rejection fixtures;
positive controls still detect other tokens. No real credential was found in these scans.

Portable regressions for FIX-007/008/009/010/011 fail on the audit baseline and pass on the
corrected implementation (`v5-regression-matrix.json`). The wrong-issuer test already passed
baseline and remains green; it is not counted as a newly reproduced defect. The global storm
split defect was independently reproduced before correction (`v5-scientific-before.xml`).
The final Windows and clean Linux backend suites each pass 131 tests with no skips.
After the final line-ending correction, all four scientific-data regressions passed again.

See [Scientific data and staging verification](SCIENTIFIC_DATA_AND_STAGING.md) for source
provenance, reproduction commands and exact external access requirements.

Live feed evidence is limited: JTWC RSS was accessible and supplied a regional-format fixture;
GDACS returned a request rejection. Source adapters conservatively report stale/uncertain data
when authoritative dates or coverage cannot be established.

## Exact changed files

The complete baseline-to-staging list is in `v5-changed-files.txt`. Raw downloads,
credentials, caches and build output are excluded.

## Source search record

Commands: `webcmd web fetch` for the supplied NOAA archive, plus primary-source web
open/click/find calls for NOAA, Earth Engine, Render and Gitleaks documentation.
Source links and data provenance are in `SCIENTIFIC_DATA_AND_STAGING.md`. No browser
fallback was used. Initial web-tool access to the HURSAT root failed; webcmd and the
linked NOAA archive succeeded. Authenticated GitHub/Render/Earth Engine access remains blocked.
