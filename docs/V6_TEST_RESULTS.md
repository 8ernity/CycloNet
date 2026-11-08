# V6 verification results

Review date: 8 November 2026. Starting main commit: `93c8827b45a04f42c177209d8114bb3965c68b8b`. Requested historical baseline: `0cf561b8ec82bf11b4b7270c8edd1fccfd346ef3`. Branch: `codex/v6-production-remediation`.

Final implementation revision: `b3d14cf8ade437bd60435674700839f0ef2b5581`. Release status: **ENGINEERING_READY_DEPLOYMENT_BLOCKED**. Locally achievable gates pass; live V6 staging and hosted CI are not verified. This report is committed separately as evidence only. No deployment or operational readiness is claimed.

## Verification environment

Windows, Python 3.11 CPU verification environment, local Node 26.12, production Next.js build and installed Google Chrome. CI uses Ubuntu and Node 22; hosted V6 verification is still required. PostgreSQL 17 and Redis 7 run in disposable localhost-only test containers. Tests use isolated database schemas, Redis key prefixes, temporary SQLite data and a temporary leader-lock file so they do not alter the running development server.

The initial workspace already contained edits to database startup, archive, comparison and API-origin behavior. Additional local edits to BackendWarmup and start_all.bat appeared during verification. The unrelated API-origin, BackendWarmup and launcher edits are preserved and excluded from the remediation commit. Database development auto-migration remains supported, but production startup cannot migrate automatically. These tests exercise the combined working tree; this is not a claim of a clean hosted checkout run.

## Final gates

| Gate | Final result |
|---|---|
| Full backend suite | **216 passed**, 0 failures/errors/skips |
| Real PostgreSQL / Redis | **8 passed**, included in the full suite; migrations, rollback/history, fencing, atomic quotas, 20,000-row indexed pagination and concurrent inference |
| Frontend unit tests | **14 passed** |
| Production browser tests | **10 passed**, 0 failures/skips |
| TypeScript | Passed |
| ESLint | 0 errors; 172 warnings |
| Next.js production build | Passed |
| npm audit | 0 known vulnerabilities |
| Python Windows/Linux lock audits | 0 known vulnerabilities in each |
| Gitleaks history | 56 commits including the implementation commit, 0 leaks |
| Gitleaks current files | 19.94 MB complete copied snapshot, 0 leaks; exit 0 |
| Scientific training gate | Expected exit 1, BLOCKED_EXTERNAL_DATASET; no model produced |

The secret scan uses a copied container filesystem to avoid host bind-mount I/O errors. The history scan includes the final implementation commit. No dependencies changed after the recorded audits. TypeScript passed; ESLint had zero errors and 172 warnings. The Next.js production build passed. All 14 frontend unit tests passed. Python locks and npm dependency audits reported zero known vulnerabilities. The scientific training CLI exited 1 with BLOCKED_EXTERNAL_DATASET, which is the required fail-closed behavior rather than a trained model.

## Before and after evidence

| Regression | Before | Final coverage |
|---|---|---|
| UI-driven weather context / null briefing / client certification | [3 failures](v6-ai-before.xml) | `test_v6_ai.py` |
| Oversized and nested request bodies | [2 failures of 4](v6-limits-before.xml) | `test_v6_limits.py` |
| Public operator-draft leak / fabricated delivery | [3 failures](v6-events-before.xml) | `test_v6_events.py` |
| Movement knots and mixed advisory parsing | [3 failures of 6](v6-units-before.xml) | `test_v6_units.py` |
| Production SQLite / automatic migration / unbounded archive query | [3 failures](v6-database-before.xml) | `test_v6_database.py`, real PostgreSQL tests |
| Vision output inventing intensity and evacuation | [1 failure](v6-vision-before.xml) | `test_unvalidated_vision_cannot_issue_evacuation_orders` |
| Empty-body administrative auth regression introduced during remediation | [2 failures in full suite](v6-body-auth-before.xml) | Existing auth regressions retained; middleware corrected |
| Unsupported stable/steering/official forecast claims | [1 browser failure](v6-forecast-claims-before.xml) | Empty/stale track browser regression |

Infrastructure and service-worker regressions were also reproduced during implementation; no machine-readable before artifact was retained for those early frontend runs. Do not interpret added post-fix coverage as a captured baseline failure. The runoff provenance and training CLI follow-up have executable coverage; the first authorization-matrix attempt had a test-fixture method typo, which was corrected without changing authorization expectations.

The legacy exercise test was updated to assert the intentionally changed draft-only contract, empty actual deliveries and absent tower/latency measurements. The old runoff test now asserts assumed terrain and scientific-validation false; retaining its old DEM label would endorse the defect. No failing behavior test was skipped or disabled.

Browser test corrections scope provenance assertions to page content rather than the navigation's Historical Archive link, allow the documented shared-client retry window, and wait for DOM content followed by actual UI assertions rather than unrelated external resource completion. The empty-track crash and stable-condition claims were fixed in the implementation.

## Runtime interruptions

Intermediate runs encountered concurrently stopped test containers, a development-server leader-lock collision, exhausted host memory, and Docker bind-mount I/O errors. The V6 containers were recreated with verified localhost port mappings; the test lock was isolated; heavy gates were run sequentially. Interrupted scans are not passing evidence. Final artifacts replace incomplete results only after successful completion.

## Reproduction

From `backend/`, with TEST_POSTGRES_URL and TEST_REDIS_URL pointing only to disposable test services:

```text
python -m pytest -q --junitxml=../docs/v6-backend-results.xml
python train_classifier.py data/manifests/cyclonet_ni_scientific_v1.csv
```

From `frontend/`, with the matching Clerk test-instance configuration:

```text
npm run typecheck
npm run lint -- --format json --output-file ../docs/v6-eslint.json
npm test
npm run build
npx playwright test --reporter=line,junit
npm audit --json
```

Use PLAYWRIGHT_CHROME_PATH for installed Chrome or install Playwright Chromium. Python audits use `pip-audit --no-deps --disable-pip -r` against each checked-in lock. Gitleaks uses the repository's exact-fixture allowlist; no test directory or Git commit is broadly excluded.

Supporting evidence: [backend](v6-backend-results.xml), [real services](v6-integration-results.xml), [browser](v6-browser-results.xml), [build](v6-build.txt), [ESLint](v6-eslint.json), [npm audit](v6-npm-audit.json), [Windows Python audit](v6-python-audit.json), [Linux Python audit](v6-python-linux-audit.json), [history secret scan](v6-gitleaks-history.json), [working-files secret scan](v6-gitleaks-working.json), [training gate](v6-scientific-training-gate.txt).

The security, safety and remaining external requirements are in [V6_SECURITY_REVIEW.md](V6_SECURITY_REVIEW.md), [V6_SAFETY_AND_DATA_INTEGRITY.md](V6_SAFETY_AND_DATA_INTEGRITY.md) and [V6_REMAINING_BLOCKERS.md](V6_REMAINING_BLOCKERS.md). Exact issue/file mappings are in [ENGINEERING_PROGRESS_V6.json](ENGINEERING_PROGRESS_V6.json).
