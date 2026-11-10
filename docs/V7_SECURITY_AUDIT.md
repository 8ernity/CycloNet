# V7 security audit

Scope: the initial review used `767c105c9a87b833c308004d22bbbb32311c6fcc`; the final local follow-up used main at `df21c517b1f04b7d45afc3993e17be961eea6af9` plus uncommitted changes, including retained V6/chat/settings work. This is an engineering review, not independent penetration-test certification.

## Confirmed findings and fixes

| Finding | Severity | Root cause / change | Regression evidence |
|---|---|---|---|
| Hosted development fallback | Critical | Render could inherit development defaults and SQLite. Explicit hosted production mode and PostgreSQL are now required. | `test_v7_production.py`; v7-production-before.xml |
| Startup auth exception | Critical | RuntimeError was caught; the warning path also referenced an undefined logger. Startup now propagates invalid configuration before schema work or workers. | `test_invalid_auth_aborts_startup_before_workers` |
| Incomplete schema accepted | High | Revision marker alone did not establish required application tables/columns. Read-only validation now checks both. | v7-schema-before.xml; `test_revision_marker_alone_cannot_certify_missing_domain_tables` |
| Malformed authentication configuration | High | Prefix-only issuer validation accepted malformed or insecure JWKS configuration. Validate HTTPS URL structure, origins, and RSA PEM type/size. | parameterized malformed-JWKS tests |
| Public cache ambiguity | High | API responses lacked an explicit no-store policy. API and bearer-authenticated responses now use private, no-store. | `test_api_responses_are_not_shared_cacheable`; existing service-worker tests |
| Unbounded provider downloads | High | HTTP timeouts did not bound response bytes. FeedClient bounds decoded bytes at 4 MiB, total duration at 20 seconds, and retries at two attempts. | chunked oversize, retry and content tests in `test_v7_feed_http.py` |
| Unbounded catalog query | High | /api/cyclones loaded the whole archive. SQL ordering/pagination now bounds archive retrieval at 1000 and current entries at 100. | `test_catalog_query_has_database_limit` |
| Inadequate request evidence | Medium | No reliable request correlation; Alembic logging setup disabled existing application loggers. Added structured request records, server-generated IDs and preserved logger configuration. | `test_v7_monitoring.py` |
| Missing deployed socket transport | High | Minimal Uvicorn had no WebSocket implementation in either lock. Install a pinned, hashed transport and verify real network handshakes, rejected origins, forged/expired credentials and role enforcement. | `test_v7_runtime_dependencies.py`, `test_v7_network_runtime.py` |
| Exported data fabrication | High | PDF offsets invented future positions, wind and landfall; JSON exports could recategorize source observations and imply verified exposure. Preserve source values, make forecasts unavailable, validate finite coordinates/measurements and label illustrative data. | `pdf.test.mjs`, `v7-pdf-loading.spec.ts` |

Request records exclude raw paths, query strings, headers, bodies, identities and provider exception text. Classification exception logs now expose the exception type only. Blueprint commands disable raw Uvicorn access logs. This does not retroactively redact historical platform logs; provider/platform logging needs staging review.

## Endpoint review

All HTTP route declarations and public/operator WebSocket entry points were inspected. Existing authorization, upload validation, body-size/depth/time limits, quotas, process/global inference admission, public event allowlists, WebSocket origin/authentication/expiry controls and ownership filters remain in place.

| Interface | Enforcement retained |
|---|---|
| Ingestion sync, test injection, clear-test | Administrator key or verified exact administrator JWT |
| Classification history | Authenticated identity; SQL owner filter |
| Dispatch / broadcast | Operator or administrator; exercise output only |
| Public WebSocket | Sanitized fields, origin rules, quotas and connection limits |
| Operator WebSocket | Verified operator/admin token, bounded initial frame and expiration |
| Chat, image analysis, briefing, classification | Deliberately bounded public access; inference quotas and body/decoder checks |
| Flood / surge / rainfall | Input bounds and quotas; scenario or unavailable observation labels |
| Catalog / archive / observations | Public reads; bounded archive queries and provenance |

See `test_v6_review.py`, `test_auth_production_hardening.py`, `test_v5_security.py`, `test_v6_limits.py`, `test_v6_body_concurrency.py`, `test_v6_events.py` and real-service suites for executable matrices. No operator permissions were moved into the browser.

## Scanner and scope limitations

Current npm and both locked Python audits report no known vulnerabilities. Gitleaks checks current deliverables and local history; the exact scanned revision and commit count are recorded in V7_TEST_RESULTS.md. Existing exact invalid-token/evidence-hash exceptions remain narrow; no new broad exclusion was added.

Actual Clerk login, logout/revocation timing, token rotation, real role provisioning, proxy address handling, live CORS/WebSockets and external abuse/soak testing remain staging acceptance work. Offline JWT validation does not prove immediate external session revocation. Authenticated responses cannot be treated as public cache content. No security certification or live deployment approval is claimed.

## Follow-up migration safeguards

The new migration rehearsal is a local administrative command, not an HTTP endpoint. It pins the disposable loopback database, verifies the Compose project, uses a new isolated schema and an ignored output directory, refuses populated destinations and unknown schema fields, verifies exact records and commits atomically. Reports omit row values and credentials. The source is read-only and its verified backup is retained unchanged. A Windows partial-backup cleanup regression is covered explicitly. These protections do not authorize exporting real user data or establish managed-cloud backup security.

The release plan also identifies a production risk outside the code: a main-branch push could trigger existing automatic deployments. Disabling those deployments requires explicit approval and must happen before any approved release push; no public service setting has been changed.

The frontend session boundary now uses `src/proxy.ts` and the same Clerk middleware factory/matcher. Public analysis routes remain public and privileged backend authorization is unchanged. No auth bypass, new rule suppression or secret-scan exclusion was introduced. Local checks do not substitute for real Clerk session acceptance.

The request-lifecycle follow-up retains trusted-origin credential filtering and redirect rejection. Cancellation now interrupts retry delays; JSON consumption remains within the attempt deadline. Reports use this bounded client and cancel manual requests when selection changes or the page unmounts. Existing credential-isolation tests pass alongside six new cancellation/timeout cases.

Forecast/comparison/infrastructure and catalog reads now share bounded, cancellable request handling. Exercise draft UI no longer asserts gateway, siren or delivery activity based on timers, and obsolete draft requests are cancelled. Privileged backend authorization and no-real-dispatch restrictions remain unchanged.

Final changed-file secret scan: two generic-key matches were independently recomputed SHA-256 checksums in the engineering ledger and scan-scope report, not credentials. Raw redacted findings and the exact entry reviews are retained in `v7-gitleaks-request-followup.json` and `v7-secret-followup-scope.json`; no scanner rules or files were excluded.
