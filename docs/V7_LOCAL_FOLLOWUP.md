# V7 local follow-up: runtime, exports and interaction

Scope: local `main` working tree on 2026-11-09. No commit, push, paid resource or deployment was performed by this continuation. Final gate totals are recorded in [V7 test results](V7_TEST_RESULTS.md).

## Confirmed defects and changes

| Severity | Confirmed cause | Change and regression evidence |
|---|---|---|
| P1 | Neither deployment lock installed a WebSocket transport for the minimal Uvicorn package. In-process socket tests did not detect that omission. | Pin `websockets` in both locks; test Uvicorn transport discovery and actual network connections. Initial failures: `v7-runtime-dependencies-before.xml`, `v7-websocket-runtime-before.txt`. |
| P1 | The Windows lock lacked hashes although the documented installation command required them. | Regenerate both platform locks with SHA-256 hashes and retain existing package versions. Include Windows setuptools dependency. Target Python 3.11.15; document the minimum 3.11.5 requirement. |
| P1 | PostgreSQL timeout configuration replaced URL connection options, including an isolated schema's search path. | Preserve supplied options, append the enforced 15-second statement timeout, retain the connection timeout. Regression: `test_postgres_connection_retains_schema_and_enforces_timeout`; initial failure `v7-postgres-options-before.xml`. |
| P1 | Every public API process eagerly imported PyTorch and torchvision even without a model request. The second local process failed its readiness deadline. | Defer inference imports until an inference-budget worker or explicit model startup requests them. Health inspection does not load a model or imply validation. Extract the unchanged image validator so malformed uploads can be rejected without importing PyTorch. Test a fresh process, not only the already-imported test environment. |
| P1 | PDF generation created future fixes, wind increments and landfall timing from fixed offsets. Missing district risk, basin, wind convention and source could receive invented defaults. | Export supplied observations and explicit forecast unavailability. Preserve source category and convention; reject nonfinite/out-of-range numeric values; format hemispheres correctly; remove implied verification credentials. Four PDF unit cases cover provenance, failed save, numeric-record fabrication and invalid measurements. Initial failures: `v7-pdf-integrity-before.txt`. |
| P1 | JSON export replaced source category with a display-scale category and attached illustrative infrastructure as if it were established storm exposure. | Preserve the source record; name display preferences separately; label illustrative exposure and insurance thresholds explicitly. Browser regression downloads and parses the JSON. A wind threshold no longer asserts sea conditions or coastal squalls. |
| P2 | Report pages eagerly loaded the PDF library; failed PDF saves could be swallowed. | Import on demand, show a busy state, restore controls after failure and propagate download errors. Browser tests verify a real PDF download and a failed chunk request. |
| P2 | Keyboard navigation, assistant focus, narrow-screen resizing, reduced motion and closed-assistant polling needed additional checks. | Skip navigation link; named nonmodal assistant and conversation log; Escape/focus return; viewport-bounded dimensions; no screen polling while closed; reduced-motion video/animation handling. Five interaction regressions retain initial failures in `v7-interaction-before.xml`. |

## Scope of runtime verification

`backend/tests/test_v7_network_runtime.py` starts two real local Uvicorn processes using an isolated PostgreSQL schema, an empty reserved Redis test database and an ephemeral RSA fixture identity. It disables agency ingestion. It checks public socket handshake/ping/origin rejection, operator role/expiry/forgery rejection, a one-minute six-client HTTP exercise and a shared expensive-route quota across processes.

This is not hosted capacity certification, live Clerk acceptance, provider connectivity evidence or a production soak. Fixture credentials never authorize a production service. Any failed run remains a failure; a final report is written only after all assertions pass.

The initial functional readiness probe used a three-second client timeout. Under local memory pressure, the server logged successful 200 responses taking up to 7.3 seconds after the client had already abandoned them. The probe now uses the same ten-second request budget as the rest of this functional exercise; the 90-second startup deadline, response assertions and failure checks remain. This is a test-budget correction, not evidence of improved response latency. `v7-network-startup-before.xml` retains the earlier failure.

## Frontend performance and accessibility limits

`v7-local-performance-before.json` and `v7-local-performance-after.json` measure JavaScript delivery from local production builds with mocked unavailable providers. They are not field performance scores. The original report page transferred approximately 425 KB of JavaScript and decoded 1.38 MB before the PDF library was deferred. Use the final after-file for the current measured values.

Browser checks cover keyboard focus, accessibility-tree semantics, automated WCAG rules, reduced motion and responsive layouts. Native assistive-technology automation could not initialize (`failed to write kernel assets`), so no Narrator/NVDA auditory review is claimed.

## Files and remaining acceptance

Runtime changes: `backend/app/core/database.py`, `backend/app/services/ml_runtime.py`, `backend/app/services/image_validation.py`, their import sites, `backend/requirements.txt` and both locks. Export changes: `frontend/src/lib/pdfReportGenerator.ts`, `frontend/src/app/reports/page.tsx`. Regression files: `test_v7_production.py`, `test_v7_runtime_dependencies.py`, `test_v7_network_runtime.py`, `pdf.test.mjs`, `v7-pdf-loading.spec.ts` and the existing interaction/performance browser cases.

Cloud provisioning/publication remain outside the owner's authorization. Scientific dataset review, independent model evaluation, validated satellite references, live identity acceptance, managed recovery and institutional approval remain explicit dependencies in [remaining blockers](V7_REMAINING_BLOCKERS.md).
