# CycloNet V5 readiness record

Verification date: 7 November 2026. Baseline: `e097c977e5ad2334670420c4d62ebd9de3efac14`.

**Production deployment is not certified.** Local engineering checks are recorded in
`ENGINEERING_PROGRESS.json`. CycloNet remains experimental decision support, with no
official warning authority and no independently validated model bundled in this repository.
Earlier V4 readiness assertions are superseded by this record.

**Engineering disposition: `ENGINEERING_READY_DEPLOYMENT_BLOCKED`.** All locally
verifiable gates pass. Scientific training and satellite observation readiness remain
blocked separately; this is not a production-release or scientific certification.
The authentic NOAA inventory, proposed service names, and access blockers are recorded
in [Scientific data and staging verification](SCIENTIFIC_DATA_AND_STAGING.md).

## Verified behavior

- Missing measurements remain null through the API, maps, reports and PDFs. A measured zero is distinct from unavailable data.
- Report outages display an error and retry control. Demonstrations require explicit selection. Reports and CAP documents identify experimental/exercise status; the backend owns the CAP serializer.
- Model loading requires complete, consistent metadata, matching classes, and a tensor checksum. Scientific trust additionally requires a deployment checksum allowlist. High confidence never makes a demo reliable.
- Manifest training performs optimization, validation selection, early stopping and independent test evaluation. The synthetic smoke test proves execution and export/reload compatibility, not scientific accuracy.
- Feed failures preserve source-specific observations as stale. Empty or undated source documents cannot establish calm. RSS refresh time is not used as a storm observation time. The JTWC fixture preserves the distinction between regional warning sections.
- PostgreSQL fencing rejects obsolete generations and wrong owners. Redis acquisition is atomic; production writes require a valid lease. Tests use real PostgreSQL and Redis.
- Alembic owns schema changes. Production startup checks the migration revision and requires PostgreSQL and Clerk configuration. Expensive endpoints fail closed when Redis is unavailable.
- Browser credentials stay on explicitly trusted origins and are not persisted. Clerk tokens are acquired for API calls. Dependency locks and CI security checks are included.

## Verification evidence

| Check | Evidence |
|---|---|
| Full backend suite, exact Windows dependency lock | 137 passed; `v5-backend-locked-results.xml` |
| Clean Linux hash-verified installation and full backend suite | 131 passed; `v5-linux-install.txt`, `v5-linux-results.xml` |
| Real PostgreSQL schema parity, history preservation, rollback, fencing and Redis contention | Included in the backend suite; no integration skips |
| Report outage, nullable wind, empty-feed uncertainty in a real browser | `v5-browser-results.xml` |
| Credential isolation and generated PDF provenance | `npm test` |
| TypeScript and production build | `npm run typecheck`, `npm run build` |
| ESLint | `v5-eslint-summary.json`; warnings remain and are not represented as errors |
| npm audit | `v5-npm-audit.json` |
| Python vulnerability audit | `v5-python-audit.json`, `v5-python-base-audit.json` |
| Portable before/after behavioral evidence | `v5-regression-matrix.json`; 5 failures on baseline, all corrected |
| NOAA manifest/source integrity and fixed storm splits | `v5-scientific-results.xml`; 4 passed; Git-index hashes verified |
| Render Blueprint schema | `v5-render-schema-results.json`; both candidates valid |
| Repository and history secret scans | `v5-secret-scan.json`, `v5-secret-history-scan.json`; no unexcluded findings |

The Linux CPU lock includes hashes. The CPU suffix is absent from PyPI vulnerability
records, so base PyTorch/torchvision versions were audited separately. Backend application
compatibility passed on Windows and in a clean Linux Python 3.11 container with the hashed CPU lock.
The frontend production build passed locally. Hosted CI run 42387677571, attempt 2,
passed on staging commit `84750d1c6a3208d633600127058f24096ccd4c61`: backend tests,
Python audits, secret scanning, frontend audit/lint/typecheck/unit checks, Clerk
configuration, production build, and browser checks. The missing CI secrets blocker
is resolved. See `v5-hosted-ci-results.json`. These checks do not establish live
Render availability or a successful deployed Clerk login.
The unit test suite reports a Starlette/httpx deprecation and an intentional short-HMAC
warning from a rejection test. Next.js warns that the middleware filename is deprecated.

## Deployment procedure

1. Configure a dedicated PostgreSQL database and non-evicting Redis. Set `ENVIRONMENT=production`,
   `DATABASE_URL`, `REDIS_URL`, `CLERK_ISSUER`, HTTPS `CLERK_JWKS_URL` (or a PEM key), and
   `CLERK_AUTHORIZED_PARTIES` and/or `CLERK_AUDIENCE`. Clerk roles must be server-managed.
   Set frontend Clerk keys and the exact HTTPS API origin. Do not expose an admin key in browser storage.
2. Install the backend using `pip install --require-hashes --extra-index-url https://download.pytorch.org/whl/cpu -r requirements-linux.lock`.
   Install the frontend using `npm ci`. CI must pass before release.
3. Take a managed backup and restore it to a separate staging database. Compare migration
   revision, archive/history row counts and representative records. Record recovery duration
   and verify retention, monitoring, and access controls against the operator's requirements.
4. Run `alembic upgrade head` as the pre-deploy job. A PostgreSQL advisory lock serializes
   migration jobs. Never replace a failed migration with `create_all` or blindly stamp a legacy schema.
   For an unversioned existing database, first compare it against the initial migration in a restored copy;
   only stamp a matching schema after review, then upgrade and verify preserved data.
5. Start the API and test `/health/live`, `/health/ready`, `/health/ml`, `/api/ingest/status`,
   authenticated operator actions, invalid tokens, and unavailable-source behavior from the deployed frontend.
6. `REQUIRE_VALIDATED_ML=false` means the API can be ready while ML remains unavailable or experimental.
   A service promising validated inference must set it to `true`, supply an approved checkpoint,
   and configure `VALIDATED_MODEL_CHECKSUMS`. `/health/ml` remains 503 otherwise.

For migration rollback, stop ingestion and all application writers first. On a restored
copy, test `alembic downgrade 7ebcad6e592b`; this removes fencing columns and must never run
while V5 workers are active. Prefer a forward fix; restoring a backup can lose later writes.
Local migration tests preserve history through downgrade/re-upgrade. A separate local pg_dump/pg_restore rehearsal also preserved the migration revision and historical probe record (v5-recovery-results.txt). Managed production
backup recovery and failover have not been exercised in this session.

`render.yaml` now describes paid, always-on candidate services, locked installs and a separate
migration step. It has not been applied. Paid single-instance hosting is not high availability;
provider plan availability, capacity, backup policy, failover and monitoring require staging verification.

## External gates and limits

- `BLOCKED_EXTERNAL_DATASET`: authentic NOAA metadata and a raw HURSAT sample are now present,
  but no complete reviewed image dataset, independent non-cyclone examples, or scientific
  evaluation are available. The inventory deliberately has zero training-eligible rows.
  The bundled legacy checkpoint is rejected; generate an explicitly marked
  demo artifact with `train_demo_classifier.py MANIFEST`, or train research weights with
  `train_classifier.py MANIFEST`. Neither script certifies a model.
- `BLOCKED_EXTERNAL_GEE`: satellite flood detection is explicitly disabled and returns
  `SATELLITE_DATA_UNAVAILABLE` with no polygons. The separate parametric simulation remains available.
- Official feeds can be blocked or change format. GDACS rejected the live request in this session.
  The JTWC feed was accessible. Current parsers conservatively retain unknown dates and do not infer
  basin-wide calm from an empty feed. Completeness must be verified against actual agency documents
  before enabling automatic retirement based on new source formats.
- No live Render deployment, production Clerk login, production Redis failover, or managed recovery
  test was performed. Hosted CI passes; verify staging and its configured dependencies before release.

See `V5_REMEDIATION_REPORT.md` for changed files, regression coverage and final disposition.
