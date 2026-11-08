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
from app.core.process_lock import (
    acquire_worker_leader_lock,
    release_worker_leader_lock,
    run_worker_heartbeat_task,
    run_continuous_leader_election,
    get_leader_generation,
    is_leader
)
from app.services.live_ingestion import live_ingestion_service
from app.services.ml_service import ml_service

# Background task handles for graceful shutdown (DB-04)
_background_tasks = []

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.database import validate_schema
    from app.core.auth import validate_production_auth
    try:
        validate_production_auth()
    except RuntimeError as e:
        logger.warning("[Auth] Production auth configuration incomplete: %s. Authenticated requests will fail closed.", e)
    validate_schema()
    if os.getenv('REQUIRE_VALIDATED_ML', 'false').lower() == 'true':
        await asyncio.to_thread(ml_service.load_model)
    ingestion_task = None

    async def on_demoted():
        nonlocal ingestion_task
        if ingestion_task is not None:
            ingestion_task.cancel()
            await asyncio.gather(ingestion_task, return_exceptions=True)
            ingestion_task = None

    async def on_promoted_to_leader():
        nonlocal ingestion_task
        if ingestion_task is None or ingestion_task.done():
            ingestion_task = asyncio.create_task(live_ingestion_service.start_periodic_worker(interval_seconds=900))
            _background_tasks.append(ingestion_task)

    if acquire_worker_leader_lock():
        await on_promoted_to_leader()

    election_task = asyncio.create_task(
        run_continuous_leader_election(
            interval_seconds=15,
            on_become_leader_coro=on_promoted_to_leader,
            on_lose_leader_coro=on_demoted
        )
    )
    _background_tasks.append(election_task)

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
        _background_tasks.clear()
        release_worker_leader_lock()
        print("[Lifespan] Worker shutdown and lock release complete.")

app = FastAPI(
    title="CycloNet Prediction API",
    description="API for identifying, classifying, and predicting tropical cyclones using ML.",
    version="1.0.0",
    lifespan=lifespan
)

# HTTP and WebSocket clients use the same explicit origin configuration.
from app.core.origins import configured_origins
allowed_origins = configured_origins()

# Restrict CORS to configured frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

from app.core.request_limits import RequestLimitsMiddleware
app.add_middleware(RequestLimitsMiddleware)

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
@app.get("/ready")
def health_ready(response: Response):
    """Readiness probe: checks database connectivity, Redis, and core services."""
    db_ok = False
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    redis_ok = None
    redis_url = os.getenv("REDIS_URL", "").strip()
    if redis_url:
        try:
            import redis
            rc = redis.from_url(redis_url, socket_timeout=1.5)
            rc.ping()
            redis_ok = True
        except Exception:
            redis_ok = False

    if not db_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unready", "database": "unreachable", "redis": redis_ok}

    from app.core.auth import validate_production_auth
    auth_ok = True
    try:
        validate_production_auth()
    except RuntimeError:
        auth_ok = False
    production = os.getenv("ENVIRONMENT", "development").lower() == "production"
    require_validated_ml = os.getenv("REQUIRE_VALIDATED_ML", "false").lower() == "true"
    ml_ok = bool(ml_service.checkpoint_loaded and ml_service.scientifically_validated)
    schema_ok = True
    if production:
        try:
            from app.core.database import validate_schema
            validate_schema()
        except Exception:
            schema_ok = False
    ready = db_ok and schema_ok and auth_ok and (not production or redis_ok is True) and (not require_validated_ml or ml_ok)
    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "ready" if ready else "unready", "database": "connected",
        "schema_current": schema_ok, "authentication_configured": auth_ok,
        "redis": "connected" if redis_ok is True else "unavailable",
        "model_loaded": ml_service.checkpoint_loaded,
        "ml": {"required": require_validated_ml, "ready": ml_ok,
               "scientifically_validated": ml_service.scientifically_validated},
        "is_worker_leader": is_leader(), "leader_generation": get_leader_generation(),
        "ingestion_sources": live_ingestion_service.sources_status,
        "feed_data_status": getattr(live_ingestion_service, "basin_status", "STATUS_UNCERTAIN"),
        "operational_status": "EXPERIMENTAL"
    }

@app.get("/health/ml")
def health_ml(response: Response):
    ready = ml_service.checkpoint_loaded and ml_service.scientifically_validated
    if not ready:
        response.status_code = 503
    return {"ready": ready, "checkpoint_loaded": ml_service.checkpoint_loaded,
            "scientifically_validated": ml_service.scientifically_validated}


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
        "model_loaded": ml_service.checkpoint_loaded,
        "is_worker_leader": is_leader(),
        "ingestion_sources": live_ingestion_service.sources_status
    }
