# V7 test results

Local verification completed 2026-11-10 on main, based on checkout `df21c517b1f04b7d45afc3993e17be961eea6af9` plus the current uncommitted changes. This continuation did not commit, push, publish or mutate cloud resources. Remote main was not refreshed during this local-only continuation.

| Gate | Evidence / result |
|---|---|
| Backend full suite | **293 passed**, zero failures/errors/skips; `v7-backend-results.xml`, `v7-backend.txt`; includes real PostgreSQL/Redis checks and 11 migration/backup safeguards |
| Frontend unit tests | 37 passed; `v7-frontend-unit.txt` |
| TypeScript | Passed |
| ESLint | 0 errors, 0 warnings; `v7-eslint.json` |
| Production frontend build | Passed; `v7-build.txt` |
| Browser regressions | **50 passed**, no skips; `v7-browser-results.xml`, `v7-browser.txt` |
| Accessibility | Automated WCAG A/AA checks across eight main pages in both themes during unavailable data; sample selection by keyboard and missing-basin regressions pass. Also covers assistant naming/accessibility tree, focus and Escape return, keyboard skip link, reduced motion and resizing to 320 pixels. Native screen-reader review remains unverified; automation could not initialize. |
| Desktop/tablet/mobile | All eight main pages exercised at 1440, 820 and 390 pixels during a mocked provider outage; no horizontal overflow or uncaught page errors |
| Python locked dependencies | No known vulnerabilities; `v7-python-linux-audit.json`, `v7-python-windows-audit.json` |
| npm | No known vulnerabilities; `v7-npm-audit.json` |
| Gitleaks | Clean working snapshot plus a reviewed request-follow-up delta (two verified SHA-256 checksum false positives; zero credential findings) (`v7-gitleaks-request-followup.json`, `v7-secret-followup-scope.json`), and 65-commit all-local-refs history scan (55 commits reachable from current HEAD): `v7-gitleaks-working.json`, `v7-gitleaks-history.json`; baseline/history scans had no findings |
| Blueprint structure | Both valid against downloaded Render schema; `v7-blueprint-validation.json` |
| Local backup/recovery | Restore/checksums, restart persistence and migration round trip passed; `v7-local-recovery.json` |
| Legacy SQLite import rehearsal | Complete local command passed against synthetic legacy-schema fixtures; source backup unchanged, exact typed records/ownership/nulls/state and sequence continuity verified; `v7-sqlite-migration-rehearsal.json` |
| CI configuration | PostgreSQL host port aligned with the guarded disposable migration endpoint (55432); YAML mapping verified locally. Hosted CI was not executed or claimed. |
| README restoration | Restored visual structure from `93c8827` in README.md only, with current-code claims and safeguards. Eight badges, four Mermaid diagrams and six expandable sections; local links/anchors and diagram rendering pass. Desktop/mobile preview has no page overflow; GitHub's own rendering was not published or tested. |
| Scientific training | Expected blocked exit 1, no checkpoint produced; `v7-training-gate.txt` |
| Public deployment probes | Failed, not acceptance evidence; `v7-live-readiness.json` |
| Real network runtime | Two production-mode local servers, 498 HTTP requests in 60 seconds, zero unexpected HTTP failures; median 94.0 ms, p95 1906.0 ms. Real socket origin/role/expiry/forgery checks and shared quota pass. Fixture identities only; `v7-local-network-soak.json`. |
| Export integrity and layout | Actual browser PDF/JSON downloads; source category preserved, no invented forecast/landfall, illustrative exposure labeled; short and multi-page PDF renders inspected; 60-district footer regression passes. |
| Local JavaScript delivery | Reports: 1,379,793 to 936,157 decoded bytes (32.2% reduction); 285,364 transferred bytes after deferring PDF. See before/after JSON measurements; local delivery only, not field performance or a hosted SLA. |

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

## Latest follow-up

The detailed root causes, affected files, implementations, regressions and remaining acceptance are in [V7_LOCAL_FOLLOWUP.md](V7_LOCAL_FOLLOWUP.md). Retained failures include missing WebSocket transport, PostgreSQL option replacement, PDF forecast fabrication/footer overlap and process-test startup synchronization. The complete backend and browser suites were rerun after corrections. No failed check was deleted or reported as a pass.

The final frontend pass adds three browser selection/navigation cases and three dashboard unit cases (31 unit / 44 browser total). Two dashboard provenance failures were reproduced before fixing invented coastal/landfall defaults; see `v7-dashboard-provenance-before.txt`. The full production build and browser suite were rerun after the final source-integrity changes. ESLint warnings fell from 164 to zero without disabling checks.

Request-lifecycle follow-up: six new API unit cases and one report-selection browser case brought that stage to **37 unit tests / 45 browser tests**. Five API defects and the wrong-report export were reproduced before correction; evidence is retained in `v7-api-cancellation-before.txt` and `v7-report-selection-before.xml`. Typecheck, zero-warning lint and production build were rerun for this revision.

The remaining-read follow-up adds five browser cases (current total **50**): three stalled-source deadlines, atomic scenario publication/retry, and truthful exercise draft status. No retry or skip masks a failing case. Unit tests remain **37**; the production build and static checks were rerun.

The initial 50-case run retained one classification-export timing failure (`v7-read-followup-first.xml`): its five-second UI assertion also included the sample-image download, whose deadline is ten seconds. The test now waits for the real mocked classification response and verifies its 503 status before checking export availability and unchanged scientific-safety assertions. No application deadline, assertion timeout, retry or skip was relaxed. The complete suite was rerun after this test synchronization correction.
