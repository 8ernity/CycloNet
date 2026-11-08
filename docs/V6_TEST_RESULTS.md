# V6 verification results

Review date: 8 November 2026. Starting main commit: `93c8827b45a04f42c177209d8114bb3965c68b8b`. Requested historical baseline: `0cf561b8ec82bf11b4b7270c8edd1fccfd346ef3`. Branch: `codex/v6-production-remediation`.

Final implementation revision: `856b5f22b3a813074901fb5612ff713707ea78b1` (local continuation from `c5643f08d3cd4a2ad056313531b663f5a55fe3d2`). Release status: **ENGINEERING_READY_DEPLOYMENT_BLOCKED**. Local gates pass. Earlier V6 hosted backend/frontend jobs passed; the secret-scan checksum false positive is corrected locally. Hosted CI for this follow-up and live staging remain unverified. This report is committed separately as evidence only. No deployment or operational readiness is claimed.

## Verification environment

Windows, Python 3.11 CPU verification environment, local Node 26.12, production Next.js build and installed Google Chrome. CI uses Ubuntu and Node 22; hosted V6 verification is still required. PostgreSQL 17 and Redis 7 run in disposable localhost-only test containers. Tests use isolated database schemas, Redis key prefixes, temporary SQLite data and a temporary leader-lock file so they do not alter the running development server.

The initial workspace already contained edits to database startup, archive, comparison and API-origin behavior. Additional local edits to BackendWarmup and start_all.bat appeared during verification. The unrelated API-origin, BackendWarmup and launcher edits are preserved and excluded from the remediation commit. Database development auto-migration remains supported, but production startup cannot migrate automatically. These tests exercise the combined working tree; this is not a claim of a clean hosted checkout run.

## Final gates

| Gate | Final result |
|---|---|
| Full backend suite | **253 passed**, 0 failures/errors/skips |
| Real PostgreSQL / Redis | **8 passed**, included in the full suite; migrations, rollback/history, fencing, atomic quotas, 20,000-row indexed pagination and concurrent inference |
| Frontend unit tests | **14 passed** |
| Production browser tests | **12 passed**, 0 failures/skips |
| TypeScript | Passed |
| ESLint | 0 errors; 172 warnings |
| Next.js production build | Passed |
| npm audit | 0 known vulnerabilities |
| Python Windows/Linux lock audits | 0 known vulnerabilities in each |
| Gitleaks history | 60 commits through 856b5f2; 0 findings |
| Gitleaks current files | Continuation working-file snapshot, 0 findings; exit 0 |
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

Supporting evidence: [backend follow-up](v6-followup-backend-results.xml), [real services](v6-integration-results.xml), [browser](v6-browser-results.xml), [build](v6-build.txt), [ESLint](v6-eslint.json), [npm audit](v6-npm-audit.json), [Windows Python audit](v6-python-audit.json), [Linux Python audit](v6-python-linux-audit.json), [follow-up history secret scan](v6-followup-gitleaks-history.json), [follow-up working-files secret scan](v6-followup-gitleaks-working.json), [training gate](v6-scientific-training-gate.txt).

The security, safety and remaining external requirements are in [V6_SECURITY_REVIEW.md](V6_SECURITY_REVIEW.md), [V6_SAFETY_AND_DATA_INTEGRITY.md](V6_SAFETY_AND_DATA_INTEGRITY.md) and [V6_REMAINING_BLOCKERS.md](V6_REMAINING_BLOCKERS.md). Exact issue/file mappings are in [ENGINEERING_PROGRESS_V6.json](ENGINEERING_PROGRESS_V6.json).

## Scientific follow-up

The 231-test full suite includes 17 evaluation/training/content-screen tests. Three regression failures were reproduced before correction. Hand-computed metric checks, unavailable selective accuracy when all predictions abstain, malformed inputs, re-encoded copies, near duplicates and fail-closed comparison budgets are covered. See [follow-up report](V6_SCIENTIFIC_PIPELINE_FOLLOWUP.md), [before](v6-evaluation-before.xml), and [after](v6-evaluation-after.xml). These fixtures establish implementation behavior, not real cyclone prediction skill.

Hosted run [42462779811](https://github.com/8ernity/CycloNet/actions/runs/42462779811) on c24c03f passed backend and frontend, but its secret job flagged the exact regression-report checksum. The later implementation commit was not pushed after the user requested local-only work. No current hosted pass is claimed.

Machine-readable hosted evidence: [observed run](v6-hosted-ci-observed.json). The combined hosted run is failure because of the documented checksum finding; backend/frontend success alone is not reported as a fully passing hosted run.

## Continued full audit

The continued audit at local starting commit c5643f08d3cd4a2ad056313531b663f5a55fe3d2 closed further resource-admission, source-parser, generated-guidance and frontend fallback defects. See [full findings and actual NOAA review](V6_CONTINUATION_REVIEW.md). The new captured failures are [resource admission](v6-resource-before.xml), [IMD parser](v6-parser-before.xml), [generated advice](v6-guidance-before.xml), [source status](v6-basin-before.xml), [opened chat](v6-chat-ui-before.xml), [offline classification](v6-classification-before.xml) and [landing details](v6-landing-detail-before.xml).

Final application evidence: [253 backend tests](v6-continuation-backend-results.xml), [12 browser tests](v6-continuation-browser-results.xml), [14 unit tests](v6-continuation-unit.txt), [production build](v6-continuation-build.txt), [lint](v6-continuation-eslint.json), [npm audit](v6-continuation-npm-audit.json), [Windows Python audit](v6-continuation-python-audit.json), [Linux Python audit](v6-continuation-python-linux-audit.json) and [optional scientific-review audit](v6-data-review-audit.json). All pass; lint retains 172 warnings and no errors. Production dependency versions are unchanged.

The first extended browser run had 11 passing tests and one test-selector failure: the actual tab is named Road scenario exposure, not Routes or Corridors. The selector was corrected and all 12 tests passed without changing safety expectations. No application regression was hidden. Existing unrelated local frontend/launcher changes remain included in workspace verification but excluded from remediation commits.

Final continuation secret evidence: [all 60 commits through the implementation revision](v6-continuation-gitleaks-history.json) and [working deliverable files](v6-continuation-gitleaks-working.json). The exact historical checksum exception remains narrow. Deployment, hosted CI for the local commits and independent scientific validation remain unverified.
