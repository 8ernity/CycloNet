"""Experimental meteorological report bulletins and local exercise draft dispatch endpoints."""

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.api.schemas import AlertDispatchRequest, BroadcastRequest, SystemResponse
from app.core.auth import require_operator_user
from app.core.database import get_db
from app.core.rate_limit import enforce_rate_limit
from app.models.domain import find_archive_cyclone, find_default_exercise_cyclone
from app.services.best_tracks import get_cyclone_trajectory
from app.services.live_ingestion import live_ingestion_service
from app.services.report_service import report_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/reports/bulletins")
async def get_cyclone_bulletins(
    cyclone_id: Optional[str] = None,
    simulate: bool = False,
    db: Session = Depends(get_db),
):
    """Experimental report from explicitly selected telemetry; no implicit demo fallback."""
    system = next(
        (s for s in live_ingestion_service.live_systems if not cyclone_id or s.get("id") == cyclone_id),
        None,
    )
    mode = "EXPERIMENTAL_ANALYSIS"
    if simulate:
        from app.fixtures.demo_report import DEMO_SYSTEM

        system = dict(DEMO_SYSTEM)
        mode = "DEMO_REPORT"
    elif system is None and cyclone_id:
        target = find_archive_cyclone(db, cyclone_id)
        if not target:
            raise HTTPException(404, "Cyclone not found")
        system = get_cyclone_trajectory(
            target.id,
            target.name or cyclone_id,
            target.basin or "North Indian Ocean",
            target.max_category or "Cyclonic Storm",
        )
        system["is_simulation"] = True
        system["source"] = "CycloNet historical replay (experimental reconstruction)"
        mode = "HISTORICAL_REPLAY"

    if system is None:
        raise HTTPException(503, "Report unavailable: no verified active source data")

    validated = SystemResponse.model_validate(system).model_dump(mode="json")
    return {
        "status": "success",
        "mode": mode,
        "system": validated,
        "provenance": {
            "source": validated.get("source"),
            "source_issue_time": validated.get("observation_time_utc"),
            "retrieved_at": validated.get("retrieved_at"),
            "is_simulation": validated.get("is_simulation", False),
        },
        "alert_level": report_service.get_alert_level(validated.get("intensity_knots")),
        "port_signals": [],
        "affected_districts": [],
        "official_bulletins": [],
        "bulletins": report_service.generate_experimental_analysis(validated),
        "cap_xml": report_service.generate_cap_xml(validated),
    }


@router.post("/alerts/dispatch")
async def dispatch_advisory(
    req: AlertDispatchRequest,
    request: Request,
    response: Response,
    current_user: Dict[str, Any] = Depends(require_operator_user),
):
    """Create a local exercise draft (SEC-04, AI-04: requires authorized operator)."""
    enforce_rate_limit(request, endpoint_type="admin", user=current_user, response=response)
    result = report_service.dispatch_multi_channel_advisory(
        region=req.region,
        risk_level=req.risk_level,
        surge=req.surge,
        wind=req.wind,
        channels=req.channels,
        cyclone_name=req.cyclone_name or "Active Cyclone",
    )
    try:
        from app.api.websocket import ws_manager

        await ws_manager.broadcast_alert(result)
    except Exception as exc:
        logger.debug("WebSocket alert broadcast skipped: %s", type(exc).__name__)
    return result


@router.post("/alerts/broadcast-test")
async def broadcast_emergency_alert(
    req: BroadcastRequest,
    request: Request,
    response: Response,
    current_user: Dict[str, Any] = Depends(require_operator_user),
    db: Session = Depends(get_db),
):
    """Create provider-neutral exercise communication drafts (SEC-04: requires operator)."""
    enforce_rate_limit(request, endpoint_type="admin", user=current_user, response=response)
    target = None
    if req.system_id:
        target = find_archive_cyclone(db, req.system_id)
        if not target:
            raise HTTPException(
                status_code=404,
                detail=f"System '{req.system_id}' was not found in catalog for broadcast test.",
            )

    if not target:
        target = find_default_exercise_cyclone(db)

    sys_dict = {
        "name": target.name if target else "Biparjoy",
        "basin": target.basin if target else "Arabian Sea",
        "intensity_knots": 85,
        "category": target.max_category if target else "Very Severe Cyclonic Storm",
        "lat": 19.5,
        "lon": 67.5,
    }

    dispatch_result = report_service.simulate_emergency_broadcast(sys_dict, req.alert_type, req.channels)
    try:
        from app.api.websocket import ws_manager

        await ws_manager.broadcast_alert(dispatch_result)
    except Exception as exc:
        logger.debug("WebSocket exercise broadcast skipped: %s", type(exc).__name__)
    return dispatch_result
