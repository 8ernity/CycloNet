from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
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

# Allow frontend to access API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    import asyncio
    from app.services.live_ingestion import live_ingestion_service
    # Spawn background periodic ingestion worker (every 15 mins)
    asyncio.create_task(live_ingestion_service.start_periodic_worker(interval_seconds=900))

@app.get("/")
def root():
    return {"status": "ok", "message": "CycloNet API is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}
