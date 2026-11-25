"""Persistent DB / shared state read-write helpers for active cyclone telemetry."""

import datetime
import json
import os
from typing import Any, Dict, List, Optional

from app.core.database import SessionLocal
from app.core.observability import logger as event_logger
from app.models.domain import ActiveCycloneState


def read_live_systems(in_memory_fallback: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Load persisted active cyclone systems, failing closed in production when missing."""
    try:
        db = SessionLocal()
        try:
            rec = db.query(ActiveCycloneState).filter(ActiveCycloneState.id == "CURRENT_ACTIVE_SYSTEMS").first()
            if rec and rec.systems_json:
                return json.loads(rec.systems_json)
            if os.getenv("ENVIRONMENT", "").lower() == "production":
                raise RuntimeError("Shared active state is missing; migration required")
        finally:
            db.close()
    except Exception as exc:
        if os.getenv("ENVIRONMENT", "development").lower() == "production":
            raise
        event_logger.debug("Shared active state read fell back to memory: %s", type(exc).__name__)
    return in_memory_fallback


def write_live_systems(
    systems: List[Dict[str, Any]],
    sync_generation: Optional[int],
) -> None:
    """Persist active cyclone systems using fenced leader commits in production."""
    if os.getenv("ENVIRONMENT", "development").lower() == "production":
        from app.core import process_lock
        from app.core.shared_state import commit_systems

        generation = sync_generation if sync_generation is not None else process_lock.get_leader_generation()
        commit_systems(systems, generation, process_lock.WORKER_TOKEN, process_lock.update_worker_heartbeat)
        return

    try:
        db = SessionLocal()
        try:
            rec = db.query(ActiveCycloneState).filter(ActiveCycloneState.id == "CURRENT_ACTIVE_SYSTEMS").first()
            now_utc = datetime.datetime.utcnow()
            if not rec:
                rec = ActiveCycloneState(
                    id="CURRENT_ACTIVE_SYSTEMS",
                    active_count=len(systems),
                    systems_json=json.dumps(systems),
                    last_sync=now_utc,
                )
                db.add(rec)
            else:
                rec.active_count = len(systems)
                rec.systems_json = json.dumps(systems)
                rec.last_sync = now_utc
            db.commit()
        finally:
            db.close()
    except Exception as exc:
        event_logger.warning("Local active system persistence skipped: %s", type(exc).__name__)
