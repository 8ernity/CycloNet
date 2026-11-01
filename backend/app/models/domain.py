from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from app.core.database import Base

class ClassificationHistory(Base):
    __tablename__ = "classification_history"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    predicted_category = Column(String)
    confidence = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)

class CycloneArchive(Base):
    __tablename__ = "cyclone_archive"

    id = Column(String, primary_key=True, index=True) # e.g. ARB01-2023
    name = Column(String)
    year = Column(Integer)
    basin = Column(String)
    max_category = Column(String)
    dates = Column(String, nullable=True)

class ActiveCycloneState(Base):
    """
    Persisted shared state of active cyclonic systems across multi-worker deployments.
    Fixes Problem #66 (Active cyclone state stored in process memory instead of Redis/DB).
    """
    __tablename__ = "active_cyclone_state"

    id = Column(String, primary_key=True, index=True) # 'CURRENT_ACTIVE_SYSTEMS'
    active_count = Column(Integer, default=0)
    systems_json = Column(String, default="[]")
    last_sync = Column(DateTime, default=datetime.utcnow)
