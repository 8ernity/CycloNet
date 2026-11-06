import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.api.routes import router
from app.api.websocket import ws_router, ws_manager
from app.core.database import engine, Base, SessionLocal
from app.models import domain
from app.core.process_lock import acquire_worker_leader_lock, release_worker_leader_lock
from app.services.live_ingestion import live_ingestion_service
from app.services.ml_service import ml_service

# Background task handles for graceful shutdown (DB-04)
_background_tasks = []

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and historical seeds safely
    try:
        domain.Base.metadata.create_all(bind=engine)
        try:
            from app.services.data_ingestion import seed_historical_data
            db = SessionLocal()
            seed_historical_data(db)
            db.close()
        except ImportError:
            pass
    except Exception as e:
        print(f"[Lifespan] Database initialization warning: {e}")

    # In multi-worker deployments, ensure only one worker acts as the background ingestion leader (DB-03, DB-04)
    if acquire_worker_leader_lock():
        ingest_task = asyncio.create_task(live_ingestion_service.start_periodic_worker(interval_seconds=900))
        _background_tasks.append(ingest_task)
    else:
        print("[Worker] Multi-worker deployment detected: Ingestion background task delegated to leader process.")

    # Spawn WebSocket live telemetry broadcaster worker
    ws_task = asyncio.create_task(ws_manager.start_telemetry_broadcaster())
    _background_tasks.append(ws_task)

    try:
        yield
    finally:
        # Graceful shutdown: cancel all scheduled tasks and release leader lease
        print(f"[Lifespan] Cancelling {len(_background_tasks)} background worker tasks...")
        for task in _background_tasks:
            task.cancel()
        if _background_tasks:
            await asyncio.gather(*_background_tasks, return_exceptions=True)
        release_worker_leader_lock()
        print("[Lifespan] Worker shutdown and lock release complete.")

app = FastAPI(
    title="CycloNet Prediction API",
    description="API for identifying, classifying, and predicting tropical cyclones using ML.",
    version="1.0.0",
    lifespan=lifespan
)

# Standardize CORS between ALLOWED_ORIGINS and CORS_ORIGINS (DEV-06, SEC-10)
raw_origins = os.getenv("ALLOWED_ORIGINS") or os.getenv("CORS_ORIGINS", "")
env = os.getenv("ENVIRONMENT", "production").lower()
if raw_origins and raw_origins.strip() != "*":
    allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
elif raw_origins.strip() == "*" and env != "production":
    allowed_origins = ["*"]
else:
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://cyclonet-frontend.onrender.com"
    ]

# Restrict CORS to configured frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# SEC-10: Security Headers Middleware
from starlette.requests import Request

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

app.include_router(router, prefix="/api")
app.include_router(ws_router, prefix="/api")
app.include_router(ws_router, prefix="")

@app.get("/")
def root():
    return {"status": "ok", "message": "CycloNet API is running"}

@app.get("/health/live")
def health_live():
    """Liveness probe: verifies process is responding."""
    return {"status": "alive"}

@app.get("/health/ready")
def health_ready(response: Response):
    """Readiness probe: checks database connectivity and core services."""
    db_ok = False
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception:
        db_ok = False

    if not db_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unready", "database": "unreachable"}

    return {
        "status": "ready",
        "database": "connected",
        "model_loaded": getattr(ml_service, "has_model", False),
        "ingestion_sources": live_ingestion_service.sources_status
    }

@app.get("/health")
def health(response: Response):
    """Comprehensive health check for backward compatibility."""
    db_ok = False
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception:
        db_ok = False

    status_str = "healthy" if db_ok else "degraded"
    return {
        "status": status_str,
        "database": "connected" if db_ok else "unreachable",
        "model_loaded": getattr(ml_service, "has_model", False),
        "ingestion_sources": live_ingestion_service.sources_status
    }
