# CycloNet

CycloNet is an experimental cyclone-data explorer with historical archives, source-attributed observations, and explicitly selected infrastructure scenarios. It is not an authorized emergency warning or evacuation system.

The V6 engineering review and release gates are recorded in [test results](docs/V6_TEST_RESULTS.md), [security review](docs/V6_SECURITY_REVIEW.md), [data integrity](docs/V6_SAFETY_AND_DATA_INTEGRITY.md), and [remaining blockers](docs/V6_REMAINING_BLOCKERS.md). The machine-readable issue ledger is [ENGINEERING_PROGRESS_V6.json](docs/ENGINEERING_PROGRESS_V6.json). Earlier audit reports describe earlier revisions and do not certify the current release.

## What is available

| Capability | Actual behavior |
|---|---|
| Cyclone observations | Backend source ingestion with timestamps, provenance, freshness and failure states. Source availability is not guaranteed. |
| Historical archive | Search and indexed chronological pagination; missing measurements remain unavailable. |
| Forecast tracks | Explicit historical, observed, demo or experimental provenance. No independently calibrated CycloNet accuracy or confidence cone. |
| Infrastructure | No connected authorized occupancy, generator or road-condition feed. Illustrative assets require scenario opt-in and cannot authorize evacuation or utility switching. |
| Flood and surge scenarios | Simplified experimental calculations using assumed terrain parameters. Observed satellite flood mapping is unavailable pending access and validation. |
| Chat | Bounded optional provider integration for informational questions; current-condition responses use backend source state. |
| Briefings | Deterministic source summaries or explicit user scenarios. No generated emergency orders or verified shelter readiness. Output is currently English. |
| Image inference | Checkpoint integrity and validation gates remain enforced. Unvalidated vision-generated meteorological estimates are disabled. No validated checkpoint is bundled. |
| Exercise drafts | Operator-restricted, provider-neutral drafts and CAP Exercise payloads. No actual siren, cell, VHF or government warning delivery. |
| Telemetry | Public sanitized WebSocket telemetry; authenticated operator drafts use a separate channel. Radar sweep animation is synthetic. |

No institutional affiliation, ISO certification, availability SLA, forecasting skill, model accuracy, funded insurance pool, or emergency-delivery performance is claimed.

## Local development

Use Python 3.11 and a supported Node version (CI uses Node 22). Install from the checked-in dependency locks. Do not commit credentials.

Backend, from `backend/`:

```powershell
python -m venv .venv
.venv/Scripts/Activate.ps1
pip install --require-hashes -r requirements.lock
# Configure environment variables from .env.example in your process.
python -m alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Linux uses `source .venv/bin/activate` and `requirements-linux.lock`, with the CPU package index recorded in CI. SQLite is supported only for development. Production requires PostgreSQL, Redis, explicit CORS origins and verified Clerk configuration. Production database migrations are a release step; production startup only verifies the schema. Local development may initialize or upgrade its schema.

Frontend, from `frontend/`:

```powershell
npm ci
npm run dev
```

Configure `NEXT_PUBLIC_API_URL=http://localhost:8000/api` and the matching Clerk test-instance `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `frontend/.env.local`. Configure the backend `CLERK_ISSUER`, `CLERK_JWKS_URL`, and `CLERK_AUTHORIZED_PARTIES` for the same application. Never put secret keys in browser-exposed variables. Optional Gemini access is not required for deterministic source-status responses.

The frontend runs at `http://localhost:3000`; backend API documentation is at `http://localhost:8000/docs`.

## Verification

From `backend/`:

```powershell
python -m pytest tests/ -q
```

The real infrastructure tests require isolated PostgreSQL and Redis services. From the repository root, `docker compose -f compose.test.yml up -d --wait` provides test-only services on localhost ports 55432 and 56379. Set `TEST_POSTGRES_URL` and `TEST_REDIS_URL` to those test services before running pytest. The suite uses temporary database schemas and isolated Redis keys. Do not point tests at production.

From `frontend/`:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests use the production build on localhost port 3100. Build and browser checks need the same Clerk test configuration. CI additionally audits both Python locks, npm dependencies, and secrets. Passing software tests does not establish scientific or operational validity.

## Scientific data and deployment

The authentic NOAA inventory and event-disjoint splits are documented in [Scientific data and staging](docs/SCIENTIFIC_DATA_AND_STAGING.md). Raw HURSAT retrieval has been demonstrated, but reviewed model-ready image joins, independent non-cyclone negatives, calibration and independent evaluation are incomplete. Training intentionally halts rather than manufacturing results.

`render.staging.yaml` describes proposed staging resources; it is not proof of a deployment. Deployment, live authentication, recovery, external feed reliability and Earth Engine results require separate staging verification. Follow the current [blocker report](docs/V6_REMAINING_BLOCKERS.md) before release.

## License and sources

A repository license file was not found during this review; confirm licensing before redistribution. Each observation or scientific inventory must retain its original source attribution. References to NOAA, IMD, JTWC or other agencies identify data sources, not affiliation or authorization. Follow official local advisories for real-world emergency decisions.
