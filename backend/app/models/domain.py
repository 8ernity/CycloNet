"""SQLAlchemy ORM models for classification history, historical catalog, and shared active state."""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import BigInteger, Date, DateTime, Float, Index, Integer, String, event, func, text
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.database import Base


class ClassificationHistory(Base):
    __tablename__ = "classification_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)  # SEC-13: Owner identity
    filename: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    predicted_category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)


class CycloneArchive(Base):
    __tablename__ = "cyclone_archive"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    basin: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    max_category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    dates: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=text("'0001-01-01'"))
    __table_args__ = (Index("ix_archive_chronology", "start_date", "id"),)


class ActiveCycloneState(Base):
    """
    Persisted shared state of active cyclonic systems across multi-worker deployments.
    Fixes Problem #66 (Active cyclone state stored in process memory instead of Redis/DB).
    """

    __tablename__ = "active_cyclone_state"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    active_count: Mapped[Optional[int]] = mapped_column(Integer, default=0, nullable=True)
    systems_json: Mapped[Optional[str]] = mapped_column(String, default="[]", nullable=True)
    last_sync: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)
    fencing_generation: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0, server_default="0")
    leader_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)


@event.listens_for(CycloneArchive, "before_insert")
@event.listens_for(CycloneArchive, "before_update")
def normalize_archive_date(_mapper, _connection, target):
    from app.core.archive_dates import archive_start_date

    target.start_date = archive_start_date(target.year, target.dates)


def find_archive_cyclone(db: Session, cyclone_id: str) -> Optional[CycloneArchive]:
    """Look up an archived cyclone record by exact ID or case-insensitive storm name."""
    return (
        db.query(CycloneArchive)
        .filter((CycloneArchive.id == cyclone_id) | (func.lower(CycloneArchive.name) == cyclone_id.lower()))
        .first()
    )


def find_default_exercise_cyclone(db: Session) -> Optional[CycloneArchive]:
    """Return the canonical fallback archive record for explicit drill/simulation playback."""
    return (
        db.query(CycloneArchive).filter_by(id="BOB05-2026").first()
        or db.query(CycloneArchive).filter_by(id="ARB01-2023").first()
    )
