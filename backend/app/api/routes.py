import os
import time
import asyncio
import logging
import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Header, Request, Response, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.services.ml_service import ml_service, validate_image_payload
from app.services.chat_service import chat_service
from app.services.gee_service import gee_service
from app.services.surge_service import surge_service
from app.services.report_service import report_service
from app.services.best_tracks import get_cyclone_trajectory
from app.services.live_ingestion import live_ingestion_service
from app.core.database import get_db
from app.models.domain import CycloneArchive, ClassificationHistory
from app.core.auth import (
    verify_admin_key,
    get_current_user,
    require_authenticated_user,
    require_operator_user,
    require_admin_user
)
from app.core.rate_limit import enforce_rate_limit

logger = logging.getLogger(__name__)
MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB threshold

router = APIRouter()

class TrackPoint(BaseModel):
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lon: float = Field(ge=-180, le=180, allow_inf_nan=False)
    time_offset_hours: int
    category: str
    intensity_knots: Optional[int] = Field(None, ge=0, le=350)
    is_forecast: bool = False
    is_landfall: bool = False
    is_observed: Optional[bool] = None
    origin_type: Optional[str] = None
    label: Optional[str] = None

class SystemResponse(BaseModel):
    id: str
    name: str
    basin: str
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lon: float = Field(ge=-180, le=180, allow_inf_nan=False)
    intensity_knots: Optional[int] = Field(None, ge=0, le=350)
    central_pressure_hpa: Optional[float] = Field(None, ge=800, le=1100, allow_inf_nan=False)
    movement_speed_kmph: Optional[float] = Field(None, ge=0, le=200, allow_inf_nan=False)
    movement_direction: Optional[str] = None
    observation_time_utc: Optional[datetime.datetime] = None
    retrieved_at: Optional[datetime.datetime] = None
    source_id: Optional[str] = None
    source_url: Optional[str] = None
    data_state: Optional[str] = None
    reconciliation_status: Optional[str] = None
    is_stale: bool = False
    is_simulation: bool = False
    category: str
    dvorak_t: Optional[str] = None
    dvorak_derivation_method: Optional[str] = None
    dvorak_is_empirical_estimate: Optional[bool] = None
    track_generation_method: Optional[str] = None
    telemetry_attribution: Optional[Dict[str, Any]] = None
    telemetry_badge: Optional[str] = None
    telemetry_type: Optional[str] = None
    source: Optional[str] = None
    track_forecast: List[TrackPoint] = Field(default_factory=list)
    landfall_info: Optional[Dict[str, Any]] = None
    is_landfall_completed: Optional[bool] = None

class IngestStatusResponse(BaseModel):
    status: str
    last_sync: Optional[str]
    is_syncing: bool
    active_systems_count: int
    sources_status: Dict[str, str]
    last_error: Optional[str] = None
    basin_status: str = 'STATUS_UNCERTAIN'

class ChatMessageRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = None
    ui_context: Optional[Dict[str, Any]] = None

class ChatMessageResponse(BaseModel):
    response: str
    category: str
    sources: List[str]
    timestamp: str

@router.get("/ingest/status", response_model=IngestStatusResponse)
async def get_ingest_status():
    """Returns the current real-time status of the automated meteorological ingestion worker."""
    return {
        "status": "healthy" if getattr(live_ingestion_service, 'basin_status', '') == 'ACTIVE_VERIFIED' else "degraded",
        "basin_status": getattr(live_ingestion_service, 'basin_status', 'STATUS_UNCERTAIN'),
        "last_sync": live_ingestion_service.last_sync.isoformat() + "Z" if live_ingestion_service.last_sync else None,
        "is_syncing": live_ingestion_service.is_syncing,
        "active_systems_count": len(live_ingestion_service.live_systems),
        "sources_status": live_ingestion_service.sources_status,
        "last_error": live_ingestion_service.last_error
    }

@router.post("/ingest/sync")
async def trigger_live_ingest_sync(_: bool = Depends(verify_admin_key)):
    """Triggers an on-demand immediate synchronization pass across IMD, NOAA, and satellite feeds."""
    result = await live_ingestion_service.sync_all_sources()
    return result

@router.post("/ingest/test-inject")
async def inject_live_test_system(
    name: str = "Shakti", 
    basin: str = "Bay of Bengal", 
    category: str = "Very Severe Cyclonic Storm", 
    knots: int = 75,
    _: bool = Depends(verify_admin_key)
):
    """Injects a simulated live cyclone detection for end-to-end verification."""
    system = live_ingestion_service.inject_test_system(name=name, basin=basin, category=category, knots=knots)
    return {
        "status": "success",
        "message": f"Simulated live detection for Cyclone {name} injected successfully.",
        "system": system
    }

@router.post("/ingest/clear-test")
async def clear_live_test_systems(_: bool = Depends(verify_admin_key)):
    """Clears injected test systems back to normal quiet state."""
    live_ingestion_service.clear_live_systems()
    return {
        "status": "success",
        "message": "Live systems cleared."
    }

@router.get("/active-systems", response_model=List[SystemResponse])
async def get_active_systems(simulate: bool = False, cyclone_id: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Returns currently active cyclonic systems in the North Indian Ocean basin.
    When simulate is False and no cyclone_id is passed:
      - Returns live systems if any are currently detected by the live ingestion worker.
      - Returns empty list when the basin is calm.
    When simulate is True or cyclone_id is passed:
      - Returns real historical best-track data from IBTrACS/IMD for tracking & forecast analytics.
      - Returns 404 if cyclone_id is passed but not found (DATA-03).
    """
    if not simulate and not cyclone_id:
        # Check if the live ingestion worker has discovered any live active systems
        if live_ingestion_service.live_systems:
            return live_ingestion_service.live_systems
        return []

    target = None
    if cyclone_id:
        for sys in live_ingestion_service.live_systems:
            if sys.get("id") == cyclone_id or sys.get("name", "").lower() == cyclone_id.lower():
                return [sys]
        target = db.query(CycloneArchive).filter(
            (CycloneArchive.id == cyclone_id) | (func.lower(CycloneArchive.name) == cyclone_id.lower())
        ).first()
        if not target:
            raise HTTPException(
                status_code=404,
                detail=f"Cyclone '{cyclone_id}' not found in active telemetry or historical archives."
            )
    elif simulate:
        target = db.query(CycloneArchive).filter_by(id="BOB05-2026").first()
        if not target:
            target = db.query(CycloneArchive).filter_by(id="ARB01-2023").first()

    name = target.name if target else "Biparjoy"
    c_id = target.id if target else "ARB01-2023"
    basin = target.basin if target else "Arabian Sea"
    cat = target.max_category if target else "Extremely Severe Cyclonic Storm"

    result = get_cyclone_trajectory(c_id, name, basin, cat)
    return [result]

@router.get("/cyclones")
async def get_cyclones_catalog(db: Session = Depends(get_db)):
    """
    Returns complete cyclone catalog including active live systems and historical database entries.
    Fixes Problem LIVE-03 (nonexistent /api/cyclones endpoint).
    """
    catalog = []
    for sys in live_ingestion_service.live_systems:
        catalog.append({
            "id": sys.get("id"),
            "name": sys.get("name"),
            "year": str(datetime.datetime.utcnow().year),
            "maxCategory": sys.get("category"),
            "basin": sys.get("basin"),
            "dates": "Current Active",
            "is_live": True,
            "is_simulation": sys.get("is_simulation", False)
        })
    cyclones = db.query(CycloneArchive).all()
    for c in cyclones:
        catalog.append({
            "id": c.id,
            "name": c.name,
            "year": str(c.year) if c.year else "",
            "maxCategory": c.max_category,
            "basin": c.basin,
            "dates": c.dates or str(c.year),
            "is_live": False,
            "is_simulation": "2026" in c.id or "SIM" in c.id
        })
    return catalog

@router.post("/classify")
async def classify_image(
    req: Request,
    response: Response,
    file: UploadFile = File(...),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Classifies an uploaded satellite frame using ML and stores result in DB."""
    enforce_rate_limit(req, endpoint_type="classify", user=current_user, response=response)
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    image_bytes = await file.read(MAX_IMAGE_SIZE_BYTES + 1)
    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File size exceeds maximum allowable limit (15 MB).")
    
    try:
        validate_image_payload(image_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    try:
        result = ml_service.predict(image_bytes)
        
        # Log classification request scoped to user (SEC-13)
        user_id = current_user.get("id") if current_user else None
        new_record = ClassificationHistory(
            filename=file.filename or "uploaded_satellite_frame.jpg",
            predicted_category=result.get("category", "Unknown"),
            confidence=float(result.get("confidence", "0").replace("%", "")) if isinstance(result.get("confidence"), str) else float(result.get("confidence", 0.0)),
            user_id=user_id
        )
        db.add(new_record)
        db.commit()

        return {
            "status": "success",
            "filename": file.filename,
            "prediction": result
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Satellite classification error: %s", e)
        raise HTTPException(status_code=500, detail="Internal processing error during satellite classification.")

@router.get("/history/search")
async def search_history(
    query: str = Query("", max_length=100),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Fetches historical cyclones from SQLite database populated via imdtrack."""
    q = db.query(CycloneArchive)
    if query.strip():
        term = f"%{query.strip()}%"
        q = q.filter(
            CycloneArchive.name.ilike(term) | 
            CycloneArchive.basin.ilike(term) |
            CycloneArchive.id.ilike(term) |
            CycloneArchive.dates.ilike(term)
        )
    cyclones = q.offset(offset).limit(limit).all()
    
    MONTHS_MAP = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    
    def get_sort_key(c):
        y = c.year or 0
        m = 0
        d = 0
        parts = (c.dates or '').split('-')[0].strip().split()
        for p in parts:
            p_clean = p.lower()[:3]
            if p_clean in MONTHS_MAP:
                m = MONTHS_MAP[p_clean]
            elif p.isdigit():
                d = int(p)
        return (y, m, d)
        
    cyclones_sorted = sorted(cyclones, key=get_sort_key, reverse=True)
    return [
        {
            "id": c.id,
            "name": c.name,
            "year": str(c.year),
            "maxCategory": c.max_category,
            "basin": c.basin,
            "dates": c.dates or str(c.year)
        } for c in cyclones_sorted
    ]

@router.get("/history/classifications")
async def get_classification_history(
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
    db: Session = Depends(get_db)
):
    """Fetches past AI image classifications isolated to the authenticated user (SEC-13)."""
    user_id = current_user["id"]
    records = db.query(ClassificationHistory).filter(
        ClassificationHistory.user_id == user_id
    ).order_by(ClassificationHistory.timestamp.desc()).limit(50).all()
    return [
        {
            "id": r.id,
            "filename": r.filename,
            "predicted_category": r.predicted_category,
            "confidence": r.confidence,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None
        } for r in records
    ]

@router.post("/chat", response_model=ChatMessageResponse)
async def chat_with_cyclonet(
    request: ChatMessageRequest,
    req: Request,
    response: Response,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """AI chatbot endpoint for answering questions on tropical cyclones, Dvorak analysis, and platform data."""
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    
    enforce_rate_limit(req, endpoint_type="chat", user=current_user, response=response)
    result = await asyncio.to_thread(chat_service.ask, request.message, history=request.history, db=db, ui_context=request.ui_context)
    return result

# ── Meteorological Alerts & Reports System Endpoints ─────────────────────────

from app.services.report_service import report_service

class BroadcastRequest(BaseModel):
    system_id: Optional[str] = None
    alert_type: str = "EVACUATION_WARNING"
    channels: List[str] = ["sms", "siren", "vhf", "sachet"]

@router.get("/reports/bulletins")
async def get_cyclone_bulletins(cyclone_id: Optional[str] = None, simulate: bool = False, db: Session = Depends(get_db)):
    """Experimental report from explicitly selected telemetry; no implicit demo fallback."""
    system = next((s for s in live_ingestion_service.live_systems
                   if not cyclone_id or s.get("id") == cyclone_id), None)
    mode = "EXPERIMENTAL_ANALYSIS"
    if simulate:
        from app.fixtures.demo_report import DEMO_SYSTEM
        system = dict(DEMO_SYSTEM)
        mode = "DEMO_REPORT"
    elif system is None and cyclone_id:
        target = db.query(CycloneArchive).filter(
            (CycloneArchive.id == cyclone_id) | (func.lower(CycloneArchive.name) == cyclone_id.lower())).first()
        if not target:
            raise HTTPException(404, "Cyclone not found")
        system = get_cyclone_trajectory(target.id, target.name, target.basin, target.max_category)
        system["is_simulation"] = True
        system["source"] = "CycloNet historical replay (experimental reconstruction)"
        mode = "HISTORICAL_REPLAY"
    if system is None:
        raise HTTPException(503, "Report unavailable: no verified active source data")
    system = SystemResponse.model_validate(system).model_dump(mode="json")
    return {
        "status": "success", "mode": mode, "system": system,
        "provenance": {"source": system.get("source"), "source_issue_time": system.get("observation_time_utc"),
                       "retrieved_at": system.get("retrieved_at"), "is_simulation": system.get("is_simulation", False)},
        "alert_level": report_service.get_alert_level(system.get("intensity_knots")),
        "port_signals": [], "affected_districts": [], "official_bulletins": [],
        "bulletins": report_service.generate_experimental_analysis(system),
        "cap_xml": report_service.generate_cap_xml(system)
    }

class AlertDispatchRequest(BaseModel):
    region: str = Field("Sundarbans Coastal Belt", max_length=120)
    risk_level: str = Field("CRITICAL", max_length=30)
    surge: float = Field(3.4, ge=-5.0, le=25.0)
    wind: float = Field(125.0, ge=0.0, le=400.0)
    channels: List[str] = ["CAP", "SMS", "SACHET", "SIREN", "VHF"]
    cyclone_name: Optional[str] = Field("Active Cyclone", max_length=100)

@router.post("/alerts/dispatch")
async def dispatch_advisory(
    req: AlertDispatchRequest,
    request: Request,
    response: Response,
    current_user: Dict[str, Any] = Depends(require_operator_user)
):
    """
    Executes early warning advisory dispatch (SEC-04, AI-04: requires authorized operator).
    """
    enforce_rate_limit(request, endpoint_type="admin", user=current_user, response=response)
    result = report_service.dispatch_multi_channel_advisory(
        region=req.region,
        risk_level=req.risk_level,
        surge=req.surge,
        wind=req.wind,
        channels=req.channels,
        cyclone_name=req.cyclone_name or "Active Cyclone"
    )
    try:
        from app.api.websocket import ws_manager
        await ws_manager.broadcast_alert(result)
    except Exception:
        pass
    return result

@router.post("/alerts/broadcast-test")
async def broadcast_emergency_alert(
    req: BroadcastRequest,
    request: Request,
    response: Response,
    current_user: Dict[str, Any] = Depends(require_operator_user),
    db: Session = Depends(get_db)
):
    """Simulates multi-channel NDMA CAP-CP emergency broadcast dispatch in sandbox (SEC-04: requires operator)."""
    enforce_rate_limit(request, endpoint_type="admin", user=current_user, response=response)
    target = None
    if req.system_id:
        target = db.query(CycloneArchive).filter(
            (CycloneArchive.id == req.system_id) | (func.lower(CycloneArchive.name) == req.system_id.lower())
        ).first()
        if not target:
            raise HTTPException(
                status_code=404,
                detail=f"System '{req.system_id}' was not found in catalog for broadcast test."
            )
    
    if not target:
        target = db.query(CycloneArchive).filter_by(id="BOB05-2026").first()
        if not target:
            target = db.query(CycloneArchive).filter_by(id="ARB01-2023").first()
    
    sys_dict = {
        "name": target.name if target else "Biparjoy",
        "basin": target.basin if target else "Arabian Sea",
        "intensity_knots": 85,
        "category": target.max_category if target else "Very Severe Cyclonic Storm",
        "lat": 19.5,
        "lon": 67.5
    }

    dispatch_result = report_service.simulate_emergency_broadcast(sys_dict, req.alert_type, req.channels)
    try:
        from app.api.websocket import ws_manager
        await ws_manager.broadcast_alert(dispatch_result)
    except Exception:
        pass
    return dispatch_result

# ─────────────────────────────────────────────────────────────────────────────
# Track 5: Google Earth Engine (GEE) & Satellite Feeds Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/gee/layers")
async def get_gee_layers():
    """Returns catalogue of Google Earth Engine (GEE) multispectral observation layers."""
    return {
        "status": "success",
        "gee_project": gee_service.gee_project_id,
        "is_cloud_initialized": gee_service.is_initialized,
        "layers": gee_service.get_available_layers()
    }

@router.get("/gee/flood-inundation")
async def get_gee_flood_inundation(
    req: Request,
    response: Response,
    lat: float = Query(18.2, ge=-90.0, le=90.0),
    lon: float = Query(84.8, ge=-180.0, le=180.0),
    knots: int = Query(85, ge=0, le=350)
):
    """Generates Sentinel-1 SAR coastal flood extent GeoJSON."""
    enforce_rate_limit(req, endpoint_type="simulation", user=None, response=response)
    return gee_service.get_flood_inundation_zones(lat, lon, knots)

@router.get("/gee/rainfall-pathways")
async def get_gee_rainfall_pathways(
    req: Request,
    response: Response,
    lat: float = Query(18.2, ge=-90.0, le=90.0),
    lon: float = Query(84.8, ge=-180.0, le=180.0),
    rain_mm: float = Query(280.0, ge=0.0, le=2500.0)
):
    """Generates DEM-informed catchment runoff pathway simulation and critical drainage choke points."""
    enforce_rate_limit(req, endpoint_type="simulation", user=None, response=response)
    return {
        "status": "success",
        "mode": "DEM_INFORMED_RUNOFF_SIMULATION",
        "method": "DEM-informed catchment runoff pathway simulation",
        "center": [lat, lon],
        "rain_accumulation_mm": rain_mm,
        "pathways": gee_service.get_catchment_rainfall_pathways(lat, lon, rain_mm)
    }

# ─────────────────────────────────────────────────────────────────────────────
# Track 5: Hydrodynamic Storm Surge & Compound Flooding Simulator Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/surge/calculate")
async def calculate_storm_surge(
    req: Request,
    response: Response,
    knots: float = Query(85.0, ge=0.0, le=350.0),
    pressure_hpa: float = Query(965.0, ge=800.0, le=1050.0),
    forward_speed: float = Query(18.0, ge=0.0, le=150.0),
    angle_deg: float = Query(75.0, ge=0.0, le=360.0),
    tide_m: float = Query(1.2, ge=-5.0, le=15.0),
    basin: str = Query("Bay of Bengal", max_length=50)
):
    """Calculates peak hydrodynamic storm surge and inland inundation using the Jelesnianski parametric formulation."""
    enforce_rate_limit(req, endpoint_type="simulation", user=None, response=response)
    return surge_service.calculate_surge(
        intensity_knots=knots,
        central_pressure_hpa=pressure_hpa,
        forward_speed_kmh=forward_speed,
        approach_angle_deg=angle_deg,
        astronomical_tide_m=tide_m,
        basin=basin
    )

@router.get("/surge/profile")
async def get_coastal_surge_profile(
    name: str = Query("Cyclone", max_length=100),
    lat: float = Query(18.2, ge=-90.0, le=90.0),
    lon: float = Query(84.8, ge=-180.0, le=180.0),
    knots: int = Query(85, ge=0, le=350)
):
    """Generates quadrant-by-quadrant coastal surge profiles and critical asset risk ratings."""
    return {
        "status": "success",
        "cyclone_name": name,
        "sectors": surge_service.generate_coastal_surge_profile(name, lat, lon, knots)
    }

# ─────────────────────────────────────────────────────────────────────────────
# Track 5: Gemini Multimodal AI & Pre-Landfall Briefings
# ─────────────────────────────────────────────────────────────────────────────

class BriefingRequest(BaseModel):
    storm_data: Dict[str, Any]
    infrastructure_data: Optional[Dict[str, Any]] = None
    language: str = Field("en", max_length=10)

@router.post("/ai/analyze-multimodal")
async def analyze_multimodal_satellite(
    req: Request,
    response: Response,
    file: UploadFile = File(...),
    prompt: Optional[str] = Query(None, max_length=500),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Performs multimodal Dvorak and convective structural analysis using Gemini."""
    enforce_rate_limit(req, endpoint_type="multimodal", user=current_user, response=response)
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a satellite/radar image")
    
    image_bytes = await file.read(MAX_IMAGE_SIZE_BYTES + 1)
    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File size exceeds maximum allowable limit (15 MB).")
    
    try:
        validate_image_payload(image_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    analysis = await asyncio.to_thread(
        chat_service.analyze_satellite_image,
        image_bytes=image_bytes,
        mime_type=file.content_type,
        prompt=prompt
    )
    return {
        "status": "success",
        "filename": file.filename,
        "analysis": analysis
    }

@router.post("/ai/pre-landfall-briefing")
async def generate_pre_landfall_briefing(
    req_body: BriefingRequest,
    req: Request,
    response: Response,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Generates an authoritative executive pre-landfall briefing for disaster magistrates."""
    enforce_rate_limit(req, endpoint_type="briefing", user=current_user, response=response)
    briefing = await asyncio.to_thread(
        chat_service.generate_pre_landfall_briefing,
        storm_data=req_body.storm_data,
        infrastructure_data=req_body.infrastructure_data or {},
        language=req_body.language
    )
    return {
        "status": "success",
        "briefing": briefing
    }


