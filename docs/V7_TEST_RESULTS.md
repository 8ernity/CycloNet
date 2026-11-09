# V7 test results

Date: 2026-11-09. Tests exercise the local main working tree, including preserved earlier chat/settings changes. Final backend provenance verification completed successfully.

| Gate | Evidence / result |
|---|---|
| Backend full suite | **288 passed**, zero failures/errors/skips; `v7-backend-results.xml`, `v7-backend.txt`; includes real PostgreSQL/Redis checks and 11 migration/backup safeguards |
| Frontend unit tests | 24 passed; `v7-frontend-unit.txt` |
| TypeScript | Passed |
| ESLint | 0 errors, 165 warnings; `v7-eslint.json` |
| Production frontend build | Passed; `v7-build.txt` |
| Browser regressions | **32 passed**, no skips; `v7-browser-results.xml`, `v7-browser.txt` |
| Accessibility | Automated WCAG A/AA checks across eight main pages in both themes during unavailable data; sample selection by keyboard and missing-basin regressions pass. Manual assistive-technology review remains external acceptance. |
| Desktop/tablet/mobile | All eight main pages exercised at 1440, 820 and 390 pixels during a mocked provider outage; no horizontal overflow or uncaught page errors |
| Python locked dependencies | No known vulnerabilities; `v7-python-linux-audit.json`, `v7-python-windows-audit.json` |
| npm | No known vulnerabilities; `v7-npm-audit.json` |
| Gitleaks | Working snapshot and 63-commit history reports: `v7-gitleaks-working.json`, `v7-gitleaks-history.json`; no findings |
| Blueprint structure | Both valid against downloaded Render schema; `v7-blueprint-validation.json` |
| Local backup/recovery | Restore/checksums, restart persistence and migration round trip passed; `v7-local-recovery.json` |
| Legacy SQLite import rehearsal | Complete local command passed against synthetic legacy-schema fixtures; source backup unchanged, exact typed records/ownership/nulls/state and sequence continuity verified; `v7-sqlite-migration-rehearsal.json` |
| CI configuration | PostgreSQL host port aligned with the guarded disposable migration endpoint (55432); YAML mapping verified locally. Hosted CI was not executed or claimed. |
| README restoration | Restored visual structure from `93c8827` in README.md only, with current-code claims and safeguards. Eight badges, four Mermaid diagrams and six expandable sections; local links/anchors and diagram rendering pass. Desktop/mobile preview has no page overflow; GitHub's own rendering was not published or tested. |
| Scientific training | Expected blocked exit 1, no checkpoint produced; `v7-training-gate.txt` |
| Public deployment probes | Failed, not acceptance evidence; `v7-live-readiness.json` |

## Reproductions and iterations

- Twelve initial production regressions failed before correction (`v7-production-before.xml`); focused production checks then passed.
- Three catalog/feed regressions failed (`v7-catalog-feed-before.xml`); category-derived wind regressions also failed (`v7-catalog-before.txt`).
- Two initial browser regressions failed for HTTP readiness failures and mobile navigation (`v7-browser-before.xml`).
- A revision-only incomplete schema was reproduced (`v7-schema-before.xml`).
- Final review reproduced two registered-drill provenance failures (`v7-drill-provenance-before.xml`). One was introduced while replacing the broad year-based simulation heuristic; the other existed in trajectory metadata. Both require explicit demonstration metadata, not a heuristic or disabled test.
- The old /health test expected the former DB-only `healthy` response. It now checks the deliberately changed full-readiness contract; it was not removed.
- Feed fixtures now patch the bounded FeedClient seam; parser/outage expectations remain unchanged. Separate HTTP stream tests exercise the actual download bound and retries.
- Alembic's default logging setup disabled the new logger. The logging regression exposed this; `disable_existing_loggers=False` fixes application logging instead of weakening the test.
- One full run encountered Windows socket-buffer exhaustion (WinError 10055). It was not counted as a pass or skipped. Subsequent sequential verification is recorded separately.
- Recovery-script iterations corrected a SQL fixture bind and normalized its derived archive date before comparing migration round trips. No source records or failing production checks were bypassed.
- New accessibility checks reproduced unnamed selects, non-keyboard sample controls, insufficient dark-theme primary-button contrast and color-only map attribution links in `v7-accessibility-before.xml`. All were corrected without disabling scan rules; 32 final browser tests pass.
- The first expanded browser run timed out in the existing chat-cancellation test while other verification ran. `v7-browser-timeout.xml` retains that failure. The isolated test passed, followed by the entire 32-test suite passing without changing timeouts, assertions or retries.
- The local migration helper initially did not exist (`v7-sqlite-migration-before.xml`). Its tests exposed a fixture bind typo and a Windows partial-backup handle leak (`v7-backup-cleanup-before.xml`); explicit connection closure fixed cleanup. The full backend run includes all 11 final safeguards. A restricted-network run could not reach localhost PostgreSQL; real-service verification was repeated successfully with normal execution approval, not skipped.

Reproduction commands: run pytest from backend with TEST_POSTGRES_URL and TEST_REDIS_URL pointing only to the disposable `compose.test.yml` services; run frontend typecheck, lint, unit, build and Playwright gates; run `backend/scripts/verify_disposable_recovery.py` only against its fixed `cyclonet-v7` local project. The local Node runtime differs from the proposed Node 22 deployment; hosted verification remains required.
