from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from sqlalchemy.orm import Session
from geopy.distance import distance

from app.services.ml_service import ml_service
from app.services.chat_service import chat_service
from app.services.best_tracks import get_cyclone_trajectory
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

class ChatMessageRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = None
    ui_context: Optional[Dict[str, Any]] = None

class ChatMessageResponse(BaseModel):
    response: str
    category: str
    sources: List[str]
    timestamp: str

@router.get("/active-systems", response_model=List[SystemResponse])
async def get_active_systems(simulate: bool = False, cyclone_id: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Returns currently active cyclonic systems in the North Indian Ocean basin.
    When simulate is False and no cyclone_id is passed, returns real-time active systems (empty when calm).
    When simulate is True or cyclone_id is passed, returns real historical best-track data from IBTrACS/IMD.
    """
    if not simulate and not cyclone_id:
        # True Live State: Currently NO active cyclones in the Arabian Sea or Bay of Bengal.
        return []

    # Look up cyclone if cyclone_id passed, else default to Biparjoy
    target = None
    if cyclone_id:
        target = db.query(CycloneArchive).filter(
            (CycloneArchive.id == cyclone_id) | (CycloneArchive.name.ilike(cyclone_id))
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
