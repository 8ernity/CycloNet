<div align="center">

<img src="frontend/public/logo.svg" width="84" height="84" alt="CycloNet logo" />

# CycloNet

### Explore cyclone data. Trace its sources. Understand its limits.

**An experimental workspace for cyclone observations, historical tracks, geospatial exploration and clearly labeled impact scenarios.**

[![Next.js](https://img.shields.io/badge/Next.js-16-111827?style=for-the-badge&logo=nextdotjs)](frontend/package.json)
[![React](https://img.shields.io/badge/React-19-20232a?style=for-the-badge&logo=react)](frontend/package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](frontend/package.json)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-0f172a?style=for-the-badge&logo=tailwindcss)](frontend/package.json)

[![FastAPI](https://img.shields.io/badge/FastAPI-Python_API-009688?style=for-the-badge&logo=fastapi&logoColor=white)](backend/app/main.py)
[![Python](https://img.shields.io/badge/Python-3.11-3776ab?style=for-the-badge&logo=python&logoColor=white)](backend/requirements-linux.lock)
[![PyTorch](https://img.shields.io/badge/PyTorch-Gated_inference-ee4c2c?style=for-the-badge&logo=pytorch&logoColor=white)](backend/app/services/ml_service.py)
[![Leaflet](https://img.shields.io/badge/Leaflet-Interactive_maps-199900?style=for-the-badge&logo=leaflet&logoColor=white)](frontend/package.json)

[**Features**](#explore-the-workspace) · [**Architecture**](#architecture) · [**Science**](#scientific-honesty-by-design) · [**Quickstart**](#run-locally) · [**Verification**](#verification) · [**Release evidence**](#evidence-and-release-status)

</div>

> [!IMPORTANT]
> **Experimental software, not an authorized emergency warning or evacuation system.** Follow official local advisories and instructions from responsible authorities. No scientifically validated cyclone model or satellite flood detector is bundled. Scenario outputs cannot establish safe routes, shelter availability, utility-switching instructions or emergency readiness.

> [!NOTE]
> **Current assessment: `ENGINEERING_READY_DEPLOYMENT_BLOCKED`.** V7 evidence describes the local working tree, not a verified hosted deployment. Managed staging, real authentication, recovery and operational acceptance remain incomplete. See [readiness](docs/V7_PRODUCTION_READINESS.md) and [remaining blockers](docs/V7_REMAINING_BLOCKERS.md). Badges identify technologies, not certifications or passing hosted checks.

---

## Explore the workspace

CycloNet brings source status, maps, historical records and experimental analysis into one interface. The distinction between **observations**, **historical records** and **scenarios** is part of the product: selecting a storm does not establish that it is active, and a failed feed is not an all-clear.

| Workspace | What you can explore | What the result means |
|:---|:---|:---|
| 📡 **Live monitoring** | Source status, available observations, freshness, maps and sanitized telemetry. **Refresh live data** reads backend state. | Provider availability varies. Refresh does not grant administrator ingestion privileges or establish current conditions by itself. |
| 🗂️ **Historical archive** | Search, indexed chronological pagination and storm records. | Missing measurements remain unavailable. Curated track excerpts require independent source verification. |
| 🧭 **Tracks & comparison** | Compare selected storms and inspect historical, observed, demonstration or experimental tracks. | No independently calibrated CycloNet forecasting skill or confidence cone is claimed. |
| 🧪 **Image classification** | Upload checks, illustrative samples and a checkpoint-gated PyTorch interface. | No validated checkpoint is bundled. Sample images do not establish cyclone intensity. |
| 🌊 **Infrastructure & scenarios** | Explicitly selected flood, surge and infrastructure scenarios with geospatial overlays. | Assets and assumed terrain parameters are illustrative. Authorized occupancy, generator and road-condition feeds are not connected. |
| 📄 **Reports & exercises** | Source summaries, report exports and role-restricted exercise drafts. | CAP payloads use **Exercise** status. No siren, cell broadcast, VHF or government warning delivery is connected. |
| 💬 **CycloNet assistant** | Informational questions, backend-resolved source status and optional Gemini-assisted responses. | Provider responses are bounded; meteorological vision estimates are disabled. Deterministic briefings currently use English. |
| ⚙️ **Settings & accessibility** | Dark/light themes, responsive navigation, keyboard controls, display preferences and a custom backend option. | Agency preferences do not convert wind averaging periods. Browser notification tests do not create live alert subscriptions. |

<details>
<summary><strong>Reading the data: missing, stale and simulated values</strong></summary>

- **Observation time differs from retrieval time.** Downloading an old bulletin does not make its measurements current.
- **Zero is a value; missing is not.** Unavailable winds are not replaced with category-derived estimates.
- **Outages preserve uncertainty.** Empty or failed feeds cannot justify basin-wide calm or destructive retirement of stored observations.
- **Simulation is explicit.** Demonstration records and selected scenarios carry provenance labels. A year in an identifier is insufficient to infer live or simulated status.
- **GeoJSON uses longitude, latitude.** Map components handle their own coordinate conventions. Scenario polygons are not satellite-measured flood boundaries.
- **Source names are attribution.** They do not establish affiliation, endorsement or authorized operational integration.

</details>

---

## Architecture

### A modular application with explicit trust boundaries

The backend is one FastAPI application with service modules, not independently deployed microservices. PostgreSQL and Redis are the required production design; SQLite is a development convenience. This diagram describes the code and proposed architecture, **not verified live infrastructure**.

```mermaid
flowchart TB
    classDef ui fill:#172554,stroke:#60a5fa,color:#eff6ff
    classDef api fill:#083344,stroke:#22d3ee,color:#ecfeff
    classDef data fill:#064e3b,stroke:#34d399,color:#ecfdf5
    classDef gate fill:#451a03,stroke:#fbbf24,color:#fffbeb
    classDef ext fill:#3b0764,stroke:#c084fc,color:#faf5ff

    subgraph Browser["Browser · Next.js / React"]
        UI["Dashboard · Archive · Tracks<br/>Classification · Reports · Scenarios"]:::ui
        Maps["Leaflet · Recharts<br/>Themes · Accessible controls"]:::ui
        UI --- Maps
    end
    Clerk["Clerk<br/>Sessions and signed tokens"]:::ext
    UI <-->|"Sign-in"| Clerk
    UI -->|"HTTPS REST / WebSocket"| API

    subgraph Backend["FastAPI application · Python 3.11"]
        API["Request bounds · CORS / Origin checks<br/>JWT verification · Route authorization"]:::api
        Services["Observations · Archive · Tracks<br/>Reports · Chat · Scenarios"]:::api
        Ingest["Bounded feed ingestion<br/>Provenance and freshness checks"]:::api
        ML["Checkpoint integrity + validation gate<br/>No validated model bundled"]:::gate
        Satellite["Satellite observation interface<br/>Unavailable pending validation"]:::gate
        API --> Services
        API --> ML
        Services --> Satellite
        Ingest --> Services
    end
    Agencies["IMD · JTWC · GDACS<br/>External availability varies"]:::ext
    Gemini["Optional Gemini provider<br/>Informational assistant"]:::ext
    Agencies --> Ingest
    Services -.-> Gemini
    PG[("PostgreSQL<br/>Archive · Owned history · Fenced state")]:::data
    Redis[("Redis / Key Value<br/>Quotas · Admission · Leadership leases")]:::data
    Services --> PG
    Ingest -->|"Generation and ownership checked writes"| PG
    API --> Redis
    Ingest --> Redis
```

### From bulletin to displayed observation

```mermaid
flowchart LR
    A["Agency response"] --> B["Bounded download<br/>Size · Deadline · Retries"]
    B --> C{"Supported format<br/>and usable provenance?"}
    C -->|Yes| D["Normalize values and units<br/>Retain observation time"]
    D --> E["Freshness and basin-state policy"]
    E --> F["Fenced persistence<br/>Sanitized public data"]
    F --> G["Map · Status · Report"]
    C -->|No| H["Failed / degraded source<br/>Preserve uncertainty"]
    H --> G
    style H fill:#451a03,stroke:#fbbf24,color:#fffbeb
    style F fill:#064e3b,stroke:#34d399,color:#ecfdf5
```

Feed downloads are bounded to **4 MiB of decoded content**, a **20-second total deadline** and **at most two attempts**. These reliability controls do not validate a forecast.

<details>
<summary><strong>Production correctness and security mechanisms</strong></summary>

| Boundary | Implemented behavior |
|:---|:---|
| **Runtime** | Explicit production mode on Render; PostgreSQL required in production; invalid mandatory auth configuration prevents startup. |
| **Schema lifecycle** | Alembic before deployment. Production startup validates revision and required tables/columns without modifying schema. |
| **Authentication** | Verified JWT signature, issuer, expiry and configured audience/authorized parties; privileged roles enforced server-side. |
| **Owned records** | Classification history filtered by authenticated owner identity. |
| **Resource control** | Body limits, image signature/dimension checks, rate limits, inference admission and bounded provider responses. |
| **Multiple workers** | Redis leases coordinate leadership; database fencing rejects stale-owner writes. A lease is not exactly-once processing. |
| **Cache and logs** | Private/no-store API responses; generated request IDs and route-template logging instead of raw sensitive requests. |
| **WebSockets** | Sanitized public telemetry and a separately authorized operator channel, with Origin and resource checks. Radar animation is synthetic. |
| **Health** | `/health/live` is process liveness; `/health/ready` checks dependencies; `/health` delegates to readiness; `/health/ml` reports model availability. |

These controls have local regression evidence. They do not establish certification or successful deployed authentication, networking, backup or multi-instance operation.

</details>

## Scientific honesty by design

### A classifier pipeline with an admission gate

The implementation uses a **ResNet-50 feature extractor** and a **2048 → 512 → 128 → 5** classifier head. Images are resized to **224 × 224** and normalized. The mapping `NOT_A_CYCLONE`, `CS`, `SCS`, `VSCS`, `ESCS` defines the model schema; it does not prove reliable class separation.

```mermaid
flowchart LR
    Data["Authentic imagery + best tracks"] --> QC["Provenance, acquisition-time<br/>and image-quality review"]
    QC --> Split["Storm-disjoint splits<br/>Duplicate / leakage checks"]
    Split --> Gate{"Independent dataset approval<br/>Negatives + separate OOD corpus"}
    Gate -->|Required before training| Train["Training<br/>Validation-only calibration"]
    Train --> Eval["Untouched final test<br/>Predeclared acceptance criteria"]
    Eval --> Artifact["Versioned checkpoint<br/>Checksums + evaluation evidence"]
    Gate -->|Currently incomplete| Block["Training blocked<br/>No fabricated metrics"]
    style Block fill:#451a03,stroke:#fbbf24,color:#fffbeb
    style Artifact fill:#064e3b,stroke:#34d399,color:#ecfdf5
```

The recorded NOAA inventory contains **12,275 observations across 363 storms**, with frozen storm-disjoint partitions. The HURSAT sample review covers **98 frames**, but **zero are independently approved for training**. See [scientific validation](docs/V7_SCIENTIFIC_VALIDATION.md) and [source acquisition evidence](docs/SCIENTIFIC_DATA_AND_STAGING.md).

Checkpoint loading verifies metadata, class mapping and weight checksums. No random-weight fallback is accepted as a trained model. Evaluation code supports calibration, abstention and OOD analysis; unit tests are not model-performance results. `scientifically_validated=false` remains in force until independent validation passes.

### Flood and surge: scenarios are not measurements

| Output | Current behavior | Missing scientific evidence |
|:---|:---|:---|
| **Satellite flood observations** | `SATELLITE_DATA_UNAVAILABLE`, with no measured features. A project name alone cannot activate detection. | Authorized Earth Engine access, suitable Sentinel-1 acquisitions, validated processing and independent flood references. |
| **Flood / rainfall scenarios** | Explicitly labeled illustrative geospatial calculations. | Real terrain, hydrology, observations and independent spatial validation. |
| **Surge scenarios** | Simplified pressure and wind setup using assumed shelf geometry, slope, approach, speed and tide. | Surveyed inputs, appropriate physical modeling and independent validation. |
| **Infrastructure scenarios** | Explicitly selected illustrative assets and risk calculations. | Authorized field feeds, verified conditions and institutional procedures. |

<details>
<summary><strong>Inside the surge calculation</strong></summary>

The code combines pressure response, simplified wind setup, a speed multiplier and an input tide:

```text
pressure component = max(0, 1013.25 − central pressure in hPa) × 0.0101
wind stress        = air density × drag coefficient × wind speed in m/s squared
wind setup         = wind stress × assumed shelf width
                     / (water density × gravity × assumed depth) × approach factor
scenario storm tide = (pressure component + wind setup) × speed factor + input tide
```

Wind enters in knots and is converted to metres per second. Shelf geometry and inland slope are constants; **no measured DEM or bathymetry is sampled**. Output separates meteorological surge from total storm tide and supplies no validated uncertainty range. This is not NOAA SLOSH, an operational flood forecast or an evacuation model. See [the implementation](backend/app/services/surge_service.py).

</details>

---

## API explorer

Run the backend and open [interactive API documentation](http://localhost:8000/docs). These are key routes; the generated schema and route dependencies are the implementation reference.

| Method | Endpoint | Behavior / access |
|:---|:---|:---|
| `GET` | `/api/ingest/status`, `/api/active-systems` | Public source state and available observations, with failure and simulation semantics. |
| `GET` | `/api/cyclones`, `/api/history/search` | Bounded catalog and historical search. |
| `POST` | `/api/ingest/sync` | Administrator-protected ingestion; the dashboard refresh does not call it. |
| `POST` | `/api/classify` | Bounded image processing with checkpoint/validation availability checks. |
| `GET` | `/api/history/classifications` | Authenticated, owner-filtered history. |
| `POST` | `/api/chat`, `/api/ai/pre-landfall-briefing` | Informational chat and deterministic source/scenario summaries. |
| `POST` | `/api/ai/analyze-multimodal` | Meteorological image estimation remains disabled pending validation. |
| `GET` | `/api/gee/flood-inundation`, `/api/gee/rainfall-pathways` | Observation-unavailable or explicit scenario behavior; inspect provenance. |
| `GET` | `/api/surge/calculate`, `/api/surge/profile` | Rate-limited illustrative calculations, not observed water levels. |
| `GET` | `/api/reports/bulletins` | Source-aware report data with visible outage handling. |
| `POST` | `/api/alerts/dispatch`, `/api/alerts/broadcast-test` | Operator/admin-restricted exercise drafts; no real delivery. |
| `WS` | `/api/ws/cyclone-stream` | Sanitized public telemetry. |
| `WS` | `/api/ws/operator-events` | Separately authenticated operator events. |
| `GET` | `/health/live`, `/health/ready`, `/health/ml` | Distinct process, dependency and model checks. |

## Technology and repository map

| Layer | Components | Explore |
|:---|:---|:---|
| **Interface** | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 | [`app`](frontend/src/app) · [`components`](frontend/src/components) |
| **Maps, charts, motion** | Leaflet / React-Leaflet, Recharts, Framer Motion, GSAP | [`frontend/package.json`](frontend/package.json) |
| **API and identity** | FastAPI, Pydantic, Clerk JWT verification | [`api`](backend/app/api) · [`auth`](backend/app/core/auth.py) |
| **Persistence** | SQLAlchemy, Alembic, PostgreSQL in production; SQLite in development | [`database`](backend/app/core/database.py) · [`migrations`](backend/alembic) |
| **Coordination** | Redis / Key Value, quotas, admission and leader fencing | [`core`](backend/app/core) |
| **Science** | PyTorch, Torchvision, NumPy, Pillow; manifest and evaluation gates | [`services`](backend/app/services) · [`manifests`](backend/data/manifests) |
| **Assistant** | Optional Gemini HTTP integration; configurable model | [`chat_service.py`](backend/app/services/chat_service.py) |
| **Verification** | pytest, real PostgreSQL/Redis, Playwright, axe-core and security scans | [`backend tests`](backend/tests) · [`frontend tests`](frontend/tests) · [CI](.github/workflows/ci.yml) |
| **Proposed hosting** | Render backend, frontend, PostgreSQL and Key Value | [`staging`](render.staging.yaml) · [`production proposal`](render.yaml) |

Exact versions belong to the checked-in lockfiles. The assistant's current code default is `gemini-2.5-flash`; provider/account availability must be checked separately. No “Gemini 3.7” capability is asserted here.

## Run locally

Use **Python 3.11**, **Node 22** as used by CI, and the dependency locks. Configure a Clerk **test instance** shared by frontend and backend. Keep real credentials out of Git, logs and browser-exposed variables.

<details open>
<summary><strong>1 · Start the backend</strong></summary>

From `backend/`, using Windows PowerShell:

```powershell
python -m venv .venv
.venv/Scripts/Activate.ps1
pip install --require-hashes -r requirements.lock
$env:ENVIRONMENT = "development"
$env:DATABASE_URL = "sqlite:///./cyclone_tracker.db"
$env:CORS_ORIGINS = "http://localhost:3000"
# Set matching Clerk configuration in this process before starting.
python -m alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

On Linux, activate with `source .venv/bin/activate` and install the Linux lock:

```bash
pip install --require-hashes --extra-index-url https://download.pytorch.org/whl/cpu -r requirements-linux.lock
```

The backend reads process environment variables; creating `.env` alone does not load them. [`.env.example`](backend/.env.example) is a variable inventory, not evidence that its placeholders, model names or proposed projects are valid. Gemini is optional; omit an unavailable model override. SQLite is for local development only.

</details>

<details open>
<summary><strong>2 · Configure and start the frontend</strong></summary>

Create the ignored `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/login?mode=signup
```

Add the actual test-instance `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` securely to that file. Never prefix a secret with `NEXT_PUBLIC_`. Set backend `CLERK_ISSUER`, `CLERK_JWKS_URL` and `CLERK_AUTHORIZED_PARTIES=http://localhost:3000` for the same instance.

From `frontend/`:

```powershell
npm ci
npm run dev
```

Open [the local interface](http://localhost:3000) and [API docs](http://localhost:8000/docs). Configure `127.0.0.1` separately if you use it instead of `localhost`.

</details>

<details>
<summary><strong>3 · Production configuration checklist</strong></summary>

| Variable | Purpose |
|:---|:---|
| `ENVIRONMENT=production` | Mandatory production checks; explicitly required on Render. |
| `DATABASE_URL` | Managed PostgreSQL connection from a secret store. |
| `REDIS_URL`, `REDIS_FAIL_CLOSED=true` | Shared coordination and quotas. |
| `CLERK_ISSUER` + `CLERK_JWKS_URL` or `CLERK_PEM_PUBLIC_KEY` | Issuer and signature-verification configuration. |
| `CLERK_AUDIENCE` / `CLERK_AUTHORIZED_PARTIES` | Intended audience and/or permitted application origins. |
| `CORS_ORIGINS` | Explicit frontend HTTPS origins. |
| `NEXT_PUBLIC_API_URL` | Public HTTPS backend URL, not a private Render hostname. |
| `REQUIRE_VALIDATED_ML` | When `true`, startup requires a validated checkpoint. `false` does not bypass inference safeguards or validate a model. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional provider credentials and an actually available model. |
| `GEE_PROJECT_ID` | Identifier only; cannot activate the disabled observation pipeline. |

Migrations belong in the pre-deploy step. A successful build or a `live` label does not establish readiness, authentication, persistence or recovery.

</details>

## Verification

From the repository root, start the disposable test services:

```powershell
docker compose -f compose.test.yml -p cyclonet-v7 up -d --wait
```

From `backend/`, with its virtual environment activated:

```powershell
$env:TEST_POSTGRES_URL = "postgresql://cyclonet_test:local-test-only@localhost:55432/cyclonet_test"
$env:TEST_REDIS_URL = "redis://localhost:56379/0"
python -m pytest tests/ -q
```

These are **test-only credentials** from [`compose.test.yml`](compose.test.yml). Tests use isolated schemas and Redis keys. Never point them at production; skipped infrastructure checks do not satisfy that gate.

From `frontend/`, using the same Clerk test configuration:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser checks use the production build at port **3100**. They cover unavailable-data behavior, desktop/tablet/mobile layouts, keyboard interactions and automated accessibility across both themes. Automated checks complement manual assistive-technology review; they do not certify universal accessibility.

[CI](.github/workflows/ci.yml) also runs dependency and secret checks. Hosted frontend checks need Actions secrets for the matching Clerk test instance. See the [recovery runbook](docs/V7_DEPLOYMENT_VERIFICATION.md) and [SQLite migration rehearsal](docs/V7_SQLITE_MIGRATION_REHEARSAL.md). Local fixture restores are not production recovery evidence.

## Evidence and release status

V7 reports describe current local remediation. V6 reports preserve the safeguards introduced earlier. Historical design documents may contain superseded language and do not certify the current release.

| Review | Evidence |
|:---|:---|
| **Release** | [Readiness](docs/V7_PRODUCTION_READINESS.md) · [Blockers](docs/V7_REMAINING_BLOCKERS.md) |
| **Engineering ledger** | [Issue-by-issue progress](docs/V7_ENGINEERING_PROGRESS.json) |
| **Security & infrastructure** | [Security audit](docs/V7_SECURITY_AUDIT.md) · [Infrastructure audit](docs/V7_INFRASTRUCTURE_AUDIT.md) |
| **Tests & recovery** | [Test results](docs/V7_TEST_RESULTS.md) · [Deployment verification](docs/V7_DEPLOYMENT_VERIFICATION.md) |
| **Science** | [Validation status](docs/V7_SCIENTIFIC_VALIDATION.md) · [Data provenance](docs/SCIENTIFIC_DATA_AND_STAGING.md) |
| **V6 safeguards** | [Security](docs/V6_SECURITY_REVIEW.md) · [Data integrity](docs/V6_SAFETY_AND_DATA_INTEGRITY.md) · [Tests](docs/V6_TEST_RESULTS.md) |

```mermaid
flowchart LR
    A["Engineering not ready"] --> B["Engineering ready<br/>Deployment blocked · CURRENT"]
    B -->|"Approved staging + real acceptance"| C["Experimental production ready"]
    C -->|"Independent science + authorized operations<br/>Institutional approval"| D["Operational disaster system ready"]
    style B fill:#451a03,stroke:#fbbf24,stroke-width:3px,color:#fffbeb
    style C fill:#172554,stroke:#60a5fa,color:#eff6ff
    style D fill:#1e293b,stroke:#94a3b8,color:#f8fafc
```

Render files are **proposals**, not proof of deployed PostgreSQL, Redis or runtime settings. Paid provisioning, production configuration changes, publishing and live migration require explicit authorization. Current changes remain local and uncommitted; no production promotion is claimed.

## Sources, attribution and license

- [NOAA HURSAT-B1 v06](https://www.ncei.noaa.gov/data/hurricane-satellite-hursat-b1/archive/v06/) and [IBTrACS](https://www.ncei.noaa.gov/products/international-best-track-archive) are scientific source references. Retain provenance and review source usage terms.
- IMD, JTWC and GDACS references identify source feeds, not guaranteed availability, affiliation or endorsement. Map attribution remains visible.
- No verified ISRO imagery integration, government-authorized dispatch, insurance funding, payout capability, ISO certification or availability SLA is claimed.
- **No repository license file is currently present.** Confirm licensing before redistribution; this README does not grant an MIT license.

<div align="center">

**Explore carefully. Keep provenance visible. Use official guidance for real-world decisions.**

[Back to top](#cyclonet)

</div>
