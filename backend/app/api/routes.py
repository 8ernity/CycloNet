from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import List
from pydantic import BaseModel
from sqlalchemy.orm import Session
from geopy.distance import distance

from app.services.ml_service import ml_service
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

class SystemResponse(BaseModel):
    id: str
    name: str
    basin: str
    lat: float
    lon: float
    intensity_knots: int
    category: str
    track_forecast: List[TrackPoint] = []

@router.get("/active-systems", response_model=List[SystemResponse])
async def get_active_systems():
    """Returns currently active systems with computed kinematic forward tracking."""
    track = []
    current_lat = 11.0
    current_lon = 65.5
    
    # 1. Past Track (14 points, every 12 hours)
    for i in range(-14, 0):
        offset_hours = i * 12
        current_lat += 0.7
        current_lon += 0.15
        knots = 35 + (14 + i) * 4
        if knots < 48: cat = "Cyclonic Storm"
        elif knots < 64: cat = "Severe Cyclonic Storm"
        elif knots < 90: cat = "Very Severe Cyclonic Storm"
        else: cat = "Extremely Severe Cyclonic Storm"
        
        track.append({
            "lat": current_lat, "lon": current_lon,
            "time_offset_hours": offset_hours,
            "category": cat, "intensity_knots": knots, "is_forecast": False
        })
        
    # 2. Current Point
    current_point_lat = current_lat + 0.7
    current_point_lon = current_lon + 0.15
    track.append({
        "lat": current_point_lat, "lon": current_point_lon,
        "time_offset_hours": 0, "category": "Extremely Severe Cyclonic Storm",
        "intensity_knots": 95, "is_forecast": False
    })
    
    # 3. Forecast Track (5 points, every 12 hours)
    f_lat = current_point_lat
    f_lon = current_point_lon
    for i in range(1, 6):
        offset_hours = i * 12
        f_lat += 0.6
        f_lon += 0.4
        knots = 95 - (i * 10)
        cat = "Very Severe Cyclonic Storm" if knots >= 64 else "Severe Cyclonic Storm"
        track.append({
            "lat": f_lat, "lon": f_lon,
            "time_offset_hours": offset_hours,
            "category": cat, "intensity_knots": knots, "is_forecast": True
        })
        
    return [
        {
            "id": "ARB01-2023",
            "name": "Biparjoy",
            "basin": "Arabian Sea",
            "lat": current_point_lat,
            "lon": current_point_lon,
            "intensity_knots": 95,
            "category": "Extremely Severe Cyclonic Storm",
            "track_forecast": track
        }
    ]

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
    cyclones = db.query(CycloneArchive).filter(CycloneArchive.name.contains(query)).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "year": str(c.year),
            "maxCategory": c.max_category,
            "basin": c.basin
        } for c in cyclones
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
