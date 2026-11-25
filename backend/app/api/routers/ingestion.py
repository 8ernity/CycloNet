"""Meteorological ingestion control and status API endpoints."""

from fastapi import APIRouter, Depends

from app.api.schemas import IngestStatusResponse
from app.core.auth import verify_admin_key
from app.services.live_ingestion import live_ingestion_service

router = APIRouter()


@router.get("/ingest/status", response_model=IngestStatusResponse)
async def get_ingest_status():
    """Return the current real-time status of the automated meteorological ingestion worker."""
    return {
        "status": "healthy" if getattr(live_ingestion_service, "basin_status", "") == "ACTIVE_VERIFIED" else "degraded",
        "basin_status": getattr(live_ingestion_service, "basin_status", "STATUS_UNCERTAIN"),
        "last_sync": live_ingestion_service.last_sync.isoformat() + "Z" if live_ingestion_service.last_sync else None,
        "is_syncing": live_ingestion_service.is_syncing,
        "active_systems_count": len(live_ingestion_service.live_systems),
        "sources_status": live_ingestion_service.sources_status,
        "last_error": live_ingestion_service.last_error,
    }


@router.post("/ingest/sync")
async def trigger_live_ingest_sync(_: bool = Depends(verify_admin_key)):
    """Trigger an immediate synchronization pass across IMD, NOAA, and satellite feeds."""
    return await live_ingestion_service.sync_all_sources()


@router.post("/ingest/test-inject")
async def inject_live_test_system(
    name: str = "Shakti",
    basin: str = "Bay of Bengal",
    category: str = "Very Severe Cyclonic Storm",
    knots: int = 75,
    _: bool = Depends(verify_admin_key),
):
    """Inject a simulated live cyclone detection for end-to-end verification."""
    system = live_ingestion_service.inject_test_system(name=name, basin=basin, category=category, knots=knots)
    return {
        "status": "success",
        "message": f"Simulated live detection for Cyclone {name} injected successfully.",
        "system": system,
    }


@router.post("/ingest/clear-test")
async def clear_live_test_systems(_: bool = Depends(verify_admin_key)):
    """Clear injected test systems back to quiet state."""
    live_ingestion_service.clear_live_systems()
    return {"status": "success", "message": "Live systems cleared."}
