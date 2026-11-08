# V6 security review

Reviewed 8 November 2026. Starting main commit: `93c8827b45a04f42c177209d8114bb3965c68b8b`; requested historical audit baseline: `0cf561b8ec82bf11b4b7270c8edd1fccfd346ef3`. Final revision and gate results are recorded in [V6_TEST_RESULTS.md](V6_TEST_RESULTS.md). This is a code and local verification report, not an external penetration-test certification.

## Resolved findings

- Typed AI inputs reject unknown fields, invalid numeric ranges, non-finite values, oversized messages/history and client-supplied observation claims. JSON bodies are capped at 64 KiB, nesting at eight levels, and body reception at 15 seconds. Image endpoints have a 16 MiB multipart envelope and 15 MiB image limit plus decoder validation. Bodyless administrative calls still reach authentication.
- All four AI POST endpoints use endpoint quotas and shared inference admission. Production Redis atomically bounds global requests to 40/minute and 400/hour, eight concurrent admissions globally and two per identity. Local development uses four global/two per identity slots. Redis failures reject production expensive operations. Anonymous access is deliberate and controlled by client identity plus the global budget.
- Provider HTTP operations have bounded timeouts, token budgets and response sizes. The request-facing inference timeout is 60 seconds. A timed-out worker thread retains its slot until it finishes; production leases expire after five minutes to recover crashed workers. Staging load tests still need to verify worker sizing and failure recovery under the real process manager. These controls are not an availability SLA or a cloud billing cap.
- Client UI context cannot establish meteorological facts. Current-condition and emergency questions use backend ingestion state. Source failures cannot generate a false all-clear. Briefings are typed deterministic summaries; unvalidated vision-derived wind, pressure and emergency orders are disabled.
- Public WebSocket messages use a field allowlist. Operator exercise drafts use a separate JWT-authenticated role-restricted channel, with credentials in the first bounded frame rather than a URL. Origin, expiration, connection/message rate, idle timeout, send timeout and disconnect cleanup checks are enforced.
- Production PostgreSQL and read-only production startup schema validation preserve V5 safeguards. Migrations are a release action. Archive sorting/pagination happens in indexed SQL rather than loading every row.
- The service worker only caches allowlisted public static assets. Navigation, API, authenticated, cross-origin and private/no-store responses do not enter persistent offline caches.

## Authorization matrix

The executable matrix is `backend/tests/test_v6_review.py`. Verified-token tests elsewhere retain wrong issuer/audience/authorized-party, expiration, forged algorithm, exact role and admin-key protections.

| Endpoint | Anonymous | Member / analyst | Operator | Administrator |
|---|---|---|---|---|
| POST `/api/ingest/sync` | Reject | Reject | Reject | Allow |
| POST `/api/ingest/test-inject` | Reject | Reject | Reject | Allow |
| POST `/api/ingest/clear-test` | Reject | Reject | Reject | Allow |
| GET `/api/history/classifications` | Reject | Own history | Own history | Own history |
| POST `/api/alerts/dispatch` | Reject | Reject | Exercise only | Exercise only |
| POST `/api/alerts/broadcast-test` | Reject | Reject | Exercise only | Exercise only |
| WS `/ws/operator-events` | Reject | Reject | Allow until expiry | Allow until expiry |
| WS `/ws/cyclone-stream` | Sanitized telemetry | Same | Same | Same |

Public read-only catalog/observation routes remain public. Chat, classification, multimodal and briefing endpoints intentionally permit bounded anonymous requests; malformed or oversized requests are rejected before inference. Flood/runoff/surge scenarios have input bounds and quotas. No real emergency delivery adapter is enabled.

## Evidence and limits

The full suite includes atomic Redis concurrency, real PostgreSQL migration/index checks, role matrices, public/operator isolation, malformed payloads and source freshness regressions. Dependency and Gitleaks outputs are linked from the test report. No vulnerabilities were found by those scanners at execution time; scanners cannot prove the absence of vulnerabilities.

No production resources were modified. Hosted authentication, proxy client-IP handling, managed backups/restoration, multi-instance load, external-provider behavior and staging WebSockets require live deployment evidence. Prior V5 CI success does not certify this V6 revision.
