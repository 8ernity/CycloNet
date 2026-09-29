from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.services.ml_service import ml_service
from app.services.chat_service import chat_service
from app.services.gee_service import gee_service
from app.services.surge_service import surge_service
from app.services.report_service import report_service
from app.services.best_tracks import get_cyclone_trajectory
from app.services.live_ingestion import live_ingestion_service
from app.core.database import get_db
from app.models.domain import CycloneArchive, ClassificationHistory

router = APIRouter()

class TrackPoint(BaseModel):
    lat: float
    lon: float
    time_offset_hours: int
    category: str
    intensity_knots: int
    is_forecast: bool = False
    is_landfall: bool = False
    label: Optional[str] = None

class SystemResponse(BaseModel):
    id: str
    name: str
    basin: str
    lat: float
    lon: float
    intensity_knots: int
    category: str
    track_forecast: List[TrackPoint] = []
    landfall_info: Optional[Dict[str, Any]] = None
    is_landfall_completed: Optional[bool] = None

class IngestStatusResponse(BaseModel):
    status: str
    last_sync: Optional[str]
    is_syncing: bool
    active_systems_count: int
    sources_status: Dict[str, str]
    last_error: Optional[str] = None

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
        "status": "online",
        "last_sync": live_ingestion_service.last_sync.isoformat() + "Z" if live_ingestion_service.last_sync else None,
        "is_syncing": live_ingestion_service.is_syncing,
        "active_systems_count": len(live_ingestion_service.live_systems),
        "sources_status": live_ingestion_service.sources_status,
        "last_error": live_ingestion_service.last_error
    }

@router.post("/ingest/sync")
async def trigger_live_ingest_sync():
    """Triggers an on-demand immediate synchronization pass across IMD, NOAA, and satellite feeds."""
    result = await live_ingestion_service.sync_all_sources()
    return result

@router.post("/ingest/test-inject")
async def inject_live_test_system(name: str = "Shakti", basin: str = "Bay of Bengal", category: str = "Very Severe Cyclonic Storm", knots: int = 75):
    """Injects a simulated live cyclone detection for end-to-end verification."""
    system = live_ingestion_service.inject_test_system(name=name, basin=basin, category=category, knots=knots)
    return {
        "status": "success",
        "message": f"Simulated live detection for Cyclone {name} injected successfully.",
        "system": system
    }

@router.post("/ingest/clear-test")
async def clear_live_test_systems():
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
    """
    if not simulate and not cyclone_id:
        # Check if the live ingestion worker has discovered any live active systems
        if live_ingestion_service.live_systems:
            return live_ingestion_service.live_systems
        return []

    # Look up cyclone if cyclone_id passed, else default to Biparjoy
    target = None
    if cyclone_id:
        target = db.query(CycloneArchive).filter(
            (CycloneArchive.id.ilike(f"%{cyclone_id}%")) | (CycloneArchive.name.ilike(f"%{cyclone_id}%"))
        ).first()
    if not target:
        target = db.query(CycloneArchive).filter_by(id="ARB01-2023").first()

    name = target.name if target else "Biparjoy"
    c_id = target.id if target else "ARB01-2023"
    basin = target.basin if target else "Arabian Sea"
    cat = target.max_category if target else "Extremely Severe Cyclonic Storm"

    result = get_cyclone_trajectory(c_id, name, basin, cat)
    return [result]

@router.post("/classify")
async def classify_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Classifies an uploaded satellite frame using ML and stores result in DB."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    image_bytes = await file.read()
    
    try:
        result = ml_service.predict(image_bytes)
        
        # Log classification request to SQLite Database (FR-08)
        new_record = ClassificationHistory(
            filename=file.filename,
            predicted_category=result.get("category", "Unknown"),
            confidence=float(result.get("confidence", "0").replace("%", "")) if isinstance(result.get("confidence"), str) else result.get("confidence", 0.0)
        )
        db.add(new_record)
        db.commit()

        return {
            "status": "success",
            "filename": file.filename,
            "prediction": result
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/search")
async def search_history(query: str = "", db: Session = Depends(get_db)):
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
    cyclones = q.all()
    
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
async def get_classification_history(db: Session = Depends(get_db)):
    """Fetches past AI image classifications."""
    records = db.query(ClassificationHistory).order_by(ClassificationHistory.timestamp.desc()).limit(50).all()
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
async def chat_with_cyclonet(request: ChatMessageRequest, db: Session = Depends(get_db)):
    """AI chatbot endpoint for answering questions on tropical cyclones, Dvorak analysis, and platform data."""
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    
    result = chat_service.ask(request.message, history=request.history, db=db, ui_context=request.ui_context)
    return result

# ── Meteorological Alerts & Reports System Endpoints ─────────────────────────

from app.services.report_service import report_service

class BroadcastRequest(BaseModel):
    system_id: Optional[str] = None
    alert_type: str = "EVACUATION_WARNING"
    channels: List[str] = ["sms", "siren", "vhf", "sachet"]

@router.get("/reports/bulletins")
async def get_cyclone_bulletins(cyclone_id: Optional[str] = None, simulate: bool = False, db: Session = Depends(get_db)):
    """Returns official RSMC/IMD standard weather bulletins and threat matrices for active or archived cyclones."""
    system_data = None
    if not simulate and not cyclone_id:
        if live_ingestion_service.live_systems:
            system_data = live_ingestion_service.live_systems[0]
    
    if not system_data:
        target = None
        if cyclone_id:
            target = db.query(CycloneArchive).filter(
                (CycloneArchive.id.ilike(f"%{cyclone_id}%")) | (CycloneArchive.name.ilike(f"%{cyclone_id}%"))
            ).first()
        if not target:
            target = db.query(CycloneArchive).filter_by(id="ARB01-2023").first()
        
        c_id = target.id if target else "ARB01-2023"
        name = target.name if target else "Biparjoy"
        basin = target.basin if target else "Arabian Sea"
        cat = target.max_category if target else "Extremely Severe Cyclonic Storm"
        
        system_traj = get_cyclone_trajectory(c_id, name, basin, cat)
        system_data = system_traj

    # Convert to dict if pydantic model
    if hasattr(system_data, "dict"):
        sys_dict = system_data.dict()
    elif isinstance(system_data, dict):
        sys_dict = system_data
    else:
        sys_dict = {
            "name": getattr(system_data, "name", "Cyclone"),
            "basin": getattr(system_data, "basin", "North Indian Ocean"),
            "intensity_knots": getattr(system_data, "intensity_knots", 65),
            "category": getattr(system_data, "category", "Severe Cyclonic Storm"),
            "lat": getattr(system_data, "lat", 17.5),
            "lon": getattr(system_data, "lon", 84.5),
        }

    alert_info = report_service.get_alert_level(sys_dict.get("intensity_knots", 65))
    is_bob = "bengal" in sys_dict.get("basin", "").lower() or sys_dict.get("lon", 80) > 77.0
    port_signals = report_service.get_port_signals(sys_dict.get("intensity_knots", 65), is_bob)
    affected_districts = report_service.get_affected_districts(sys_dict.get("basin", ""), sys_dict.get("lat", 17.5), sys_dict.get("lon", 84.5))
    bulletins = report_service.generate_official_bulletins(sys_dict)
    cap_xml = report_service.generate_cap_xml(sys_dict)

    return {
        "status": "success",
        "system": sys_dict,
        "alert_level": alert_info,
        "port_signals": port_signals,
        "affected_districts": affected_districts,
        "bulletins": bulletins,
        "cap_xml": cap_xml
    }

class AlertDispatchRequest(BaseModel):
    region: str = "Sundarbans Coastal Belt"
    risk_level: str = "CRITICAL"
    surge: float = 3.4
    wind: float = 125.0
    channels: List[str] = ["CAP", "SMS", "SACHET", "SIREN", "VHF"]
    cyclone_name: Optional[str] = "Active Cyclone"

@router.post("/alerts/dispatch")
async def dispatch_advisory(req: AlertDispatchRequest):
    """
    Executes automated end-to-end early warning advisory dispatch across:
    - OASIS CAP-CP v1.2 XML
    - SMS Cell Broadcast
    - NDMA SACHET Mobile Push Feed
    - Coastal Acoustic Siren Array
    - Marine NAVTEX / VHF Ch 16 Broadcast
    - Municipal & District Magistrate Action Directives
    """
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
async def broadcast_emergency_alert(req: BroadcastRequest, db: Session = Depends(get_db)):
    """Simulates multi-channel NDMA CAP-CP emergency broadcast dispatch."""
    # Find system info
    target = None
    if req.system_id:
        target = db.query(CycloneArchive).filter(
            (CycloneArchive.id.ilike(f"%{req.system_id}%")) | (CycloneArchive.name.ilike(f"%{req.system_id}%"))
        ).first()
    
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
async def get_gee_flood_inundation(lat: float = 18.2, lon: float = 84.8, knots: int = 85):
    """Generates Sentinel-1 SAR synthetic aperture radar coastal flood extent GeoJSON."""
    return gee_service.get_flood_inundation_zones(lat, lon, knots)

@router.get("/gee/rainfall-pathways")
async def get_gee_rainfall_pathways(lat: float = 18.2, lon: float = 84.8, rain_mm: float = 280.0):
    """Generates DEM catchment rainfall damage pathways and infrastructure choke points."""
    return {
        "status": "success",
        "center": [lat, lon],
        "rain_accumulation_mm": rain_mm,
        "pathways": gee_service.get_catchment_rainfall_pathways(lat, lon, rain_mm)
    }

# ─────────────────────────────────────────────────────────────────────────────
# Track 5: Hydrodynamic Storm Surge & Compound Flooding Simulator Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/surge/calculate")
async def calculate_storm_surge(
    knots: float = 85.0,
    pressure_hpa: float = 965.0,
    forward_speed: float = 18.0,
    angle_deg: float = 75.0,
    tide_m: float = 1.2,
    basin: str = "Bay of Bengal"
):
    """Calculates peak hydrodynamic storm surge and inland inundation using the Jelesnianski parametric formulation."""
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
    name: str = "Cyclone",
    lat: float = 18.2,
    lon: float = 84.8,
    knots: int = 85
):
    """Generates quadrant-by-quadrant coastal surge profiles and critical asset risk ratings."""
    return {
        "status": "success",
        "cyclone_name": name,
        "sectors": surge_service.generate_coastal_surge_profile(name, lat, lon, knots)
    }

# ─────────────────────────────────────────────────────────────────────────────
# Track 5: Gemini 3.7 Flash Multimodal AI & Pre-Landfall Briefings
# ─────────────────────────────────────────────────────────────────────────────

class BriefingRequest(BaseModel):
    storm_data: Dict[str, Any]
    infrastructure_data: Optional[Dict[str, Any]] = None
    language: str = "en"

@router.post("/ai/analyze-multimodal")
async def analyze_multimodal_satellite(
    file: UploadFile = File(...),
    prompt: Optional[str] = None
):
    """Performs multimodal Dvorak and convective structural analysis using Gemini 3.7 Flash."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a satellite/radar image")
    
    image_bytes = await file.read()
    analysis = chat_service.analyze_satellite_image(
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
async def generate_pre_landfall_briefing(req: BriefingRequest):
    """Generates an authoritative executive pre-landfall briefing for disaster magistrates."""
    briefing = chat_service.generate_pre_landfall_briefing(
        storm_data=req.storm_data,
        infrastructure_data=req.infrastructure_data or {},
        language=req.language
    )
    return {
        "status": "success",
        "briefing": briefing
    }

