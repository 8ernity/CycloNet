# CycloNet Production Deployment & Operations Guide

This guide describes how to configure, provision, and deploy CycloNet to a production environment using Render and managed database/cache infrastructure.

---

## 1. Architecture Overview

```
                     ┌──────────────────────────────────┐
                     │         End User Browser         │
                     └─────────────────┬────────────────┘
                                       │ HTTPS / WSS
                                       ▼
                     ┌──────────────────────────────────┐
                     │   Next.js 16 Frontend (Render)   │
                     │  (cyclonet-frontend.onrender.com)│
                     └─────────────────┬────────────────┘
                                       │ HTTPS API / Auth JWT
                                       ▼
                     ┌──────────────────────────────────┐
                     │   FastAPI Backend (Render Web)   │
                     │  (cyclonet-backend.onrender.com) │
                     └───────┬───────────────────┬──────┘
                             │                   │
                             ▼                   ▼
           ┌────────────────────────┐    ┌────────────────────────┐
           │ Managed PostgreSQL 16  │    │      Managed Redis     │
           │ (Relational Data & GIS)│    │ (Rate Limits & Leases) │
           └────────────────────────┘    └────────────────────────┘
```

---

## 2. Infrastructure Specification (`render.yaml`)

The platform is provisioned declaratively via the root [render.yaml](../render.yaml):

1. **`cyclonet-backend` (Web Service):**
   - **Runtime:** Python 3.11.9
   - **Build Command:** `pip install --upgrade pip && pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
2. **`cyclonet-frontend` (Web Service):**
   - **Runtime:** Node.js 20.11.0
   - **Build Command:** `npm install --no-audit --no-fund && npm run build`
   - **Start Command:** `npm run start`
3. **`cyclonet-db` (Managed PostgreSQL):**
   - **Version:** PostgreSQL 16
   - **Database Name:** `cyclonet`
   - **User:** `cyclonet`
4. **`cyclonet-redis` (Managed Redis):**
   - **Max Memory Policy:** `volatile-lru`
   - **Security:** Private VPC networking (internal host)

---

## 3. Environment Variables Reference

### Backend Service (`cyclonet-backend`)
| Variable Name | Required | Default / Format | Description |
|---|---|---|---|
| `ENVIRONMENT` | Yes | `production` | Enables strict authentication and fail-closed policies |
| `DATABASE_URL` | Yes | `postgresql://...` | Connection URI to managed PostgreSQL |
| `REDIS_URL` | Yes | `redis://...` | Connection URI to managed Redis instance |
| `REDIS_FAIL_CLOSED` | No | `false` | If `true`, rejects API calls when Redis is unreachable |
| `CORS_ORIGINS` | Yes | `https://cyclonet-frontend.onrender.com` | Comma-delimited list of trusted client origins |
| `GEMINI_API_KEY` | Optional | `<api-key>` | Google Gemini API key for automated bulletin synthesis |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | LLM model identifier |
| `DB_POOL_SIZE` | No | `10` | SQLAlchemy connection pool size |
| `DB_MAX_OVERFLOW` | No | `20` | SQLAlchemy maximum temporary overflow connections |

### Frontend Service (`cyclonet-frontend`)
| Variable Name | Required | Default / Format | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | `https://cyclonet-backend.onrender.com` | Root URL for first-party backend REST requests |
| `NEXT_PUBLIC_WS_URL` | Yes | `wss://cyclonet-backend.onrender.com/ws/live` | WebSocket URL for live radar stream |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | `<your-clerk-publishable-key>` | Clerk Client Authentication Key |
| `CLERK_SECRET_KEY` | Yes | `<your-clerk-backend-api-secret>` | Clerk Backend Secret Key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | No | `/login` | Auth redirect route |

---

## 4. Database Migrations & Initial Setup

CycloNet uses SQLAlchemy with auto-table registration and Alembic compatibility.

1. When deploying to a new PostgreSQL instance, the backend automatically runs table creation in `init_db()` during container startup.
2. Initial seed historical cyclones (Amphan, Fani, Mocha, Biparjoy) are seeded idempotently if the archive table is empty.
3. For custom migrations, run Alembic within the backend directory:
   ```bash
   alembic revision --autogenerate -m "migration_description"
   alembic upgrade head
   ```

---

## 5. Health Probes & Monitoring

The backend exposes two monitoring endpoints:

- **Liveness Probe (`GET /health`):**
  - Returns `200 OK` with JSON `{ "status": "healthy", "service": "cyclonet-backend" }`.
  - Used by Render to detect process death.
- **Readiness Probe (`GET /ready`):**
  - Verifies that:
    1. PostgreSQL connection can execute `SELECT 1`.
    2. Redis responds to `PING`.
    3. PyTorch classifier weights are loaded in memory.
  - Returns `200 OK` when ready; returns `503 Service Unavailable` if an essential dependency has failed.
