"""Active systems, historical catalog search, and satellite Dvorak classification endpoints."""

import datetime
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from sqlalchemy.orm import Session

from app.api.schemas import SystemResponse
from app.core.auth import get_current_user, require_authenticated_user
from app.core.database import get_db
from app.core.inference_budget import run_inference
from app.core.rate_limit import enforce_rate_limit
from app.data.historical_tracks import REAL_CYCLONE_TRACKS
from app.models.domain import (
    ClassificationHistory,
    CycloneArchive,
    find_archive_cyclone,
    find_default_exercise_cyclone,
)
from app.services.best_tracks import get_cyclone_trajectory
from app.services.image_validation import MAX_IMAGE_SIZE_BYTES, read_validated_image_upload
from app.services.live_ingestion import live_ingestion_service
from app.services.ml_runtime import ml_service

logger = logging.getLogger(__name__)
_ = MAX_IMAGE_SIZE_BYTES

router = APIRouter()


@router.get("/active-systems", response_model=List[SystemResponse])
async def get_active_systems(
    simulate: bool = False,
    cyclone_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Return active cyclonic systems in the North Indian Ocean or explicit archive/simulation replay."""
    if not simulate and not cyclone_id:
        if live_ingestion_service.live_systems:
            return live_ingestion_service.live_systems
        return []

    target = None
    if cyclone_id:
        for sys_item in live_ingestion_service.live_systems:
            if sys_item.get("id") == cyclone_id or sys_item.get("name", "").lower() == cyclone_id.lower():
                return [sys_item]
        target = find_archive_cyclone(db, cyclone_id)
        if not target:
            raise HTTPException(
                status_code=404,
                detail=f"Cyclone '{cyclone_id}' not found in active telemetry or historical archives.",
            )
    elif simulate:
        target = find_default_exercise_cyclone(db)

    name = (target.name or "Biparjoy") if target else "Biparjoy"
    c_id = target.id if target else "ARB01-2023"
    basin = (target.basin or "Arabian Sea") if target else "Arabian Sea"
    cat = (target.max_category or "Extremely Severe Cyclonic Storm") if target else "Extremely Severe Cyclonic Storm"

    return [get_cyclone_trajectory(c_id, name, basin, cat)]


@router.get("/cyclones")
async def get_cyclones_catalog(
    limit: int = Query(1000, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Return complete cyclone catalog combining live systems and historical records."""
    catalog = []
    for sys_item in live_ingestion_service.live_systems[:100]:
        current = (
            sys_item.get("reconciliation_status") == "ACTIVE_VERIFIED"
            and not sys_item.get("is_stale")
            and not sys_item.get("is_simulation")
        )
        catalog.append(
            {
                "id": sys_item.get("id"),
                "name": sys_item.get("name"),
                "year": str(datetime.datetime.utcnow().year),
                "maxCategory": sys_item.get("category"),
                "basin": sys_item.get("basin"),
                "dates": sys_item.get("observation_time_utc") or "Time unavailable",
                "is_live": current,
                "is_stale": bool(sys_item.get("is_stale")),
                "source_id": sys_item.get("source_id"),
                "is_simulation": sys_item.get("is_simulation", False),
            }
        )

    cyclones = (
        db.query(CycloneArchive)
        .order_by(CycloneArchive.start_date.desc(), CycloneArchive.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    for item in cyclones:
        catalog.append(
            {
                "id": item.id,
                "name": item.name,
                "year": str(item.year) if item.year else "",
                "maxCategory": item.max_category,
                "basin": item.basin,
                "dates": item.dates or str(item.year),
                "is_live": False,
                "is_simulation": bool(REAL_CYCLONE_TRACKS.get(item.id, {}).get("is_simulation")),
            }
        )
    return catalog


@router.post("/classify")
async def classify_image(
    req: Request,
    response: Response,
    file: UploadFile = File(...),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Classify an uploaded satellite frame using ML and persist user-scoped history."""
    enforce_rate_limit(req, endpoint_type="classify", user=current_user, response=response)
    image_bytes = await read_validated_image_upload(file, content_type_error="File must be an image")

    try:
        result = await run_inference(req, current_user, ml_service.predict, image_bytes)
        user_id = current_user.get("id") if current_user else None
        raw_conf = result.get("confidence", "0")
        conf_val = float(raw_conf.replace("%", "")) if isinstance(raw_conf, str) else float(raw_conf or 0.0)
        new_record = ClassificationHistory(
            filename=file.filename or "uploaded_satellite_frame.jpg",
            predicted_category=result.get("category", "Unknown"),
            confidence=conf_val,
            user_id=user_id,
        )
        db.add(new_record)
        db.commit()
        return {"status": "success", "filename": file.filename, "prediction": result}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error("Satellite classification failed: %s", type(exc).__name__)
        raise HTTPException(status_code=500, detail="Internal processing error during satellite classification.") from None


@router.get("/history/search")
async def search_history(
    query: str = Query("", max_length=100),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Fetch a bounded page of historical catalog records."""
    q = db.query(CycloneArchive)
    if query.strip():
        term = f"%{query.strip()}%"
        q = q.filter(
            CycloneArchive.name.ilike(term)
            | CycloneArchive.basin.ilike(term)
            | CycloneArchive.id.ilike(term)
            | CycloneArchive.dates.ilike(term)
        )
    cyclones_sorted = (
        q.order_by(CycloneArchive.start_date.desc(), CycloneArchive.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": c.id,
            "name": c.name,
            "year": str(c.year),
            "maxCategory": c.max_category,
            "basin": c.basin,
            "dates": c.dates or str(c.year),
            "is_simulation": bool(REAL_CYCLONE_TRACKS.get(c.id, {}).get("is_simulation")),
        }
        for c in cyclones_sorted
    ]


@router.get("/history/classifications")
async def get_classification_history(
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """Fetch past AI image classifications isolated to the authenticated user (SEC-13)."""
    records = (
        db.query(ClassificationHistory)
        .filter(ClassificationHistory.user_id == current_user["id"])
        .order_by(ClassificationHistory.timestamp.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": r.id,
            "filename": r.filename,
            "predicted_category": r.predicted_category,
            "confidence": r.confidence,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in records
    ]
