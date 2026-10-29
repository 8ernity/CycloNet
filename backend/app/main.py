from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.api.websocket import ws_router, ws_manager
from app.core.database import engine, Base, SessionLocal
from app.models import domain

# Create database tables
domain.Base.metadata.create_all(bind=engine)

# Seed database on startup
try:
    from app.services.data_ingestion import seed_historical_data
    db = SessionLocal()
    seed_historical_data(db)
    db.close()
except ImportError:
    pass # In case data_ingestion is not fully implemented yet

app = FastAPI(
    title="CycloNet Prediction API",
    description="API for identifying, classifying, and predicting tropical cyclones using ML.",
    version="1.0.0"
)

import os
from sqlalchemy import text

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
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
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.include_router(ws_router, prefix="/api")
app.include_router(ws_router, prefix="")

@app.on_event("startup")
async def startup_event():
    import asyncio
    from app.services.live_ingestion import live_ingestion_service
    # Spawn background periodic ingestion worker (every 15 mins)
    asyncio.create_task(live_ingestion_service.start_periodic_worker(interval_seconds=900))
    # Spawn WebSocket live telemetry broadcaster worker
    asyncio.create_task(ws_manager.start_telemetry_broadcaster())

@app.get("/")
def root():
    return {"status": "ok", "message": "CycloNet API is running"}

@app.get("/health")
def health():
    db_ok = False
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception:
        db_ok = False

    from app.services.live_ingestion import live_ingestion_service
    from app.services.ml_service import ml_service

    status_str = "healthy" if db_ok else "degraded"
    return {
        "status": status_str,
        "database": "connected" if db_ok else "unreachable",
        "model_loaded": getattr(ml_service, "has_model", False),
        "ingestion_sources": live_ingestion_service.sources_status
    }
