from sqlalchemy import Column, Integer, String, Float, DateTime, BigInteger, Date, Index, event, text
from datetime import datetime
from app.core.database import Base

class ClassificationHistory(Base):
    __tablename__ = "classification_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=True) # SEC-13: Owner identity
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
    start_date = Column(Date, nullable=False, server_default=text("'0001-01-01'"))
    __table_args__ = (Index("ix_archive_chronology", "start_date", "id"),)

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
    fencing_generation = Column(BigInteger, nullable=False, default=0, server_default='0')
    leader_token = Column(String, nullable=True)

@event.listens_for(CycloneArchive, 'before_insert')
@event.listens_for(CycloneArchive, 'before_update')
def normalize_archive_date(mapper, connection, target):
    from app.core.archive_dates import archive_start_date
    target.start_date = archive_start_date(target.year, target.dates)
