"""Primary API router assembling modular CycloNet domain routers."""

from fastapi import APIRouter

from app.api.routers import ai, cyclones, hazards, ingestion, reports
from app.api.schemas import (
    AlertDispatchRequest,
    BroadcastRequest,
    ChatMessageResponse,
    IngestStatusResponse,
    Provenance,
    SystemResponse,
    TrackPoint,
)

__all__ = [
    "AlertDispatchRequest",
    "BroadcastRequest",
    "ChatMessageResponse",
    "IngestStatusResponse",
    "Provenance",
    "SystemResponse",
    "TrackPoint",
    "router",
]

router = APIRouter()
router.include_router(ingestion.router)
router.include_router(cyclones.router)
router.include_router(ai.router)
router.include_router(reports.router)
router.include_router(hazards.router)
