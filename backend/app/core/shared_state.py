"""Database fencing is the final authority for every production state write."""
import json
from datetime import datetime
from sqlalchemy import update
from app.core.database import SessionLocal
from app.models.domain import ActiveCycloneState

STATE_ID = 'CURRENT_ACTIVE_SYSTEMS'

class StaleLeaderError(RuntimeError):
    pass

def generation_floor():
    with SessionLocal() as db:
        state = db.get(ActiveCycloneState, STATE_ID)
        if state is None:
            raise RuntimeError('Shared state missing; run migrations')
        return state.fencing_generation

def claim_generation(generation, token):
    with SessionLocal.begin() as db:
        result = db.execute(update(ActiveCycloneState).where(
            ActiveCycloneState.id == STATE_ID,
            ActiveCycloneState.fencing_generation < generation
        ).values(fencing_generation=generation, leader_token=token))
        if result.rowcount != 1:
            raise StaleLeaderError('Generation was already claimed or superseded')

def commit_systems(systems, generation, token, lease_valid):
    with SessionLocal.begin() as db:
        # Row lock orders writes against promotion; lease check happens after waiting.
        state = db.query(ActiveCycloneState).filter_by(id=STATE_ID).with_for_update().one()
        if state.fencing_generation != generation or state.leader_token != token or not lease_valid():
            raise StaleLeaderError('Worker lease expired or generation superseded')
        state.systems_json = json.dumps(systems, allow_nan=False)
        state.active_count = len(systems)
        state.last_sync = datetime.utcnow()
