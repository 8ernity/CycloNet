# CycloNet Production Architecture Specification

**Document Version:** 2.0.0 (Production Hardened)  
**System Target:** CycloNet Tropical Cyclone Monitoring, Forecast & Disaster-Intelligence Platform  
**Operational Status:** Experimental Decision Support System (Non-Operational Sandbox)

---

## 1. High-Level System Architecture

The CycloNet platform is architected as a decoupled, multi-tier system composed of a Next.js (App Router, Turbopack, React 19) frontend client, a FastAPI asynchronous Python backend, a PyTorch computer vision inference engine, a background meteorological ingestion worker, a Redis distributed cache/broker, and a relational database (PostgreSQL on Render, SQLite in local development).

```mermaid
flowchart TD
    subgraph ClientTier ["Client Tier (Next.js 16 + React 19)"]
        UI["Web Dashboard, Forecast, Archive & Reports"]
        State["Zustand / React Context (useDataSource, useActiveCyclone)"]
        WSClient["WebSocket Client (Auto-Reconnect + Heartbeat)"]
    end

    subgraph Gateway ["Edge & Gateway Tier"]
        CORS["CORS Origin Filter"]
        SecHeaders["HTTP Security Headers Middleware"]
        RateLimiter["Sliding-Window Rate Limiter (Redis / In-Memory)"]
        AuthMid["Cryptographic Auth Verifier (Clerk JWKS / HMAC)"]
    end

    subgraph BackendTier ["FastAPI Application Backend (Python 3.11)"]
        Router["APIRouter (40+ Endpoints)"]
        WSManager["WebSocket Connection Manager"]
        DBEngine["SQLAlchemy 2.0 Engine (QueuePool)"]
    end

    subgraph ComputeServices ["Analytical & Intelligence Engines"]
        MLService["PyTorch ResNet-50 + Grad-CAM + Entropy OOD"]
        GEEService["Earth Engine Sentinel-1 / DEM Hydrology"]
        SurgeService["Jelesnianski Parametric Surge Simulator"]
        ReportService["OASIS CAP-CP 1.2 & Multi-Channel Advisory"]
        ChatService["Gemini Multimodal Reasoning Engine"]
    end

    subgraph DataTier ["Persistence & Distributed State Tier"]
        RedisCluster["Redis (Rate Limits, Distributed Locks, Pub/Sub)"]
        RelationalDB["PostgreSQL / SQLite (Archives & Classification History)"]
    end

    subgraph BackgroundWorker ["Automated Ingestion Worker"]
        WorkerLeader["Worker Leader (Redis Distributed Lock)"]
        Sources["IMD RSMC / IBTrACS / NOAA Satellite Feeds"]
    end

    UI --> Gateway
    WSClient <--> Gateway
    Gateway --> Router
    Gateway --> WSManager
    Router --> ComputeServices
    Router --> DBEngine
    ComputeServices --> MLService
    ComputeServices --> GEEService
    ComputeServices --> SurgeService
    ComputeServices --> ReportService
    ComputeServices --> ChatService
    DBEngine --> RelationalDB
    RateLimiter <--> RedisCluster
    WorkerLeader <--> RedisCluster
    WorkerLeader --> Sources
    WorkerLeader --> DBEngine
```

---

## 2. Authentication & Authorization Architecture

### 2.1 Role-Based Access Control (RBAC) Hierarchy
Authentication enforces strict cryptographic identity verification with zero fallback to insecure test secrets in production. Roles are strictly enumerated and enforced using dependency injection.

```mermaid
classDiagram
    class Role {
        <<enumeration>>
        PUBLIC_VIEWER
        AUTHENTICATED_ANALYST
        AUTHORIZED_OPERATOR
        ADMINISTRATOR
    }

    class AuthorizationDependency {
        +require_authenticated_user()
        +require_role(minimum_role: Role)
        +require_operator_user()
        +require_admin_user()
        +verify_admin_key()
    }

    Role <.. AuthorizationDependency : enforces hierarchy
```

### 2.2 JWT Verification & JWKS Key Rotation Flow
For Clerk authenticated sessions, asymmetric RS256 token verification is executed against Clerk's published JSON Web Key Set (JWKS), supporting automated key rotation without application downtime.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Frontend Client
    participant Auth as FastAPI Auth Module
    participant JWKSCache as JWKS Key Cache (TTL 1h)
    participant Clerk as Clerk JWKS Endpoint
    participant Route as Protected Route Handler

    Client->>Auth: Request with Bearer Token (RS256)
    Auth->>Auth: Extract 'kid' header from unverified token
    alt Key found in local cache
        Auth->>JWKSCache: Retrieve RSA Public Key by 'kid'
    else Key not found in cache
        Auth->>Clerk: Fetch latest JWKS keys
        Clerk-->>Auth: Return JWKS set
        Auth->>JWKSCache: Cache RSA Public Keys
    end
    Auth->>Auth: Cryptographically verify RS256 signature, exp, nbf, iss, aud
    alt Signature or claims invalid
        Auth-->>Client: HTTP 401 Unauthorized
    else Valid claims
        Auth->>Auth: Map claims to strict Role enum
        Auth->>Route: Inject verified user dictionary
        Route-->>Client: Protected API Response
    end
```

---

## 3. Distributed Concurrency & Process Locking

In multi-replica deployments (e.g. multiple container instances on Render or Kubernetes), only one leader instance must run the scheduled meteorological synchronization loop.

```mermaid
flowchart TD
    Start["Worker Start / Interval Trigger"] --> CheckRedis{"Is Redis Configured?"}
    
    CheckRedis -- Yes --> AcquireRedisLock["Attempt Redis Lock (SET NX PX 60000)<br/>Key: 'cyclonet:worker_leader_lock'"]
    AcquireRedisLock -- Lock Acquired --> RunSync["Execute live_ingestion_service.sync_all_sources()"]
    AcquireRedisLock -- Lock Busy --> Standby["Skip Sync Cycle (Follower Standby)"]
    
    CheckRedis -- No --> FallbackFileLock["Local File Lock (fcntl / msvcrt)<br/>Path: tempfile.gettempdir()/cyclonet_worker_leader.lock"]
    FallbackFileLock -- File Acquired --> RunSync
    FallbackFileLock -- File Locked --> Standby
    
    RunSync --> ReleaseLock["Renew or Release Lock on Completion"]
```

---

## 4. Machine Learning Inference Pipeline

The PyTorch computer vision pipeline processes uploaded satellite imagery to evaluate cyclonic convective signatures while strictly rejecting out-of-distribution noise through predictive entropy estimation.

```mermaid
flowchart LR
    Upload["Satellite Image Upload"] --> Validate["Magic Byte & Dimension Validation<br/>(15 MB max, <=4096px, JPEG/PNG)"]
    Validate --> Preprocess["PyTorch Transform<br/>(Resize 224x224, ImageNet Normalization)"]
    Preprocess --> Backbone["ResNet-50 Feature Extractor<br/>(Layer 1 - Layer 4)"]
    Backbone --> Head["Classifier Head<br/>(Linear -> Softmax)"]
    Head --> EntropyCheck{"Normalized Shannon Entropy<br/>H_norm > 0.88 OR Conf < 35%?"}
    
    EntropyCheck -- Yes (Uncertain / OOD) --> Abstain["Abstain Prediction<br/>status: 'INSUFFICIENT_CONFIDENCE'<br/>category: 'Insufficient Confidence (Abstained)'"]
    EntropyCheck -- No (High Confidence) --> GradCAM["Compute Grad-CAM Activation Map<br/>(Layer 4 Gradients -> Heatmap PNG)"]
    GradCAM --> Success["Return Prediction & Heatmap Overlay<br/>status: 'SUCCESS'"]
```

---

## 5. Relational Data Architecture

```mermaid
erDiagram
    CYCLONE_ARCHIVE {
        string id PK "System Identifier (e.g. BOB05-2026)"
        string name "Cyclone Name"
        int year "Occurrence Year"
        string max_category "Peak Intensity Category"
        string basin "Bay of Bengal / Arabian Sea"
        string dates "Operational Dates"
        json best_track_points "Historical Trajectory Coordinates"
    }

    CLASSIFICATION_HISTORY {
        int id PK "Auto-incrementing Record ID"
        string user_id "Scoped Authenticated User Sub"
        string filename "Uploaded Frame Identifier"
        string predicted_category "Estimated Intensity Category"
        float confidence "Softmax Probability Percentage"
        datetime timestamp "Inference Timestamp"
    }

    CYCLONE_ARCHIVE ||--o{ CLASSIFICATION_HISTORY : "referenced in context"
```

---

## 6. Network Security & Header Policy

Every HTTP response from the FastAPI application passes through the security middleware, enforcing strict browser defense headers:

- `X-Content-Type-Options: nosniff` (prevents MIME type sniffing)
- `X-Frame-Options: DENY` (prevents clickjacking attacks)
- `Referrer-Policy: strict-origin-when-cross-origin` (prevents cross-origin URL leakage)
- `Permissions-Policy: geolocation=(), microphone=(), camera=()` (disables unused browser sensors)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (enforced when accessed over HTTPS)
- `Access-Control-Allow-Origin`: Explicitly restricted to `https://cyclonet-frontend.onrender.com` (wildcards eliminated).
