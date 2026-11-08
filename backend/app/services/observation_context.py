"""Read-only bounded context from backend ingestion, never from browser claims."""
from app.services.feed_policy import fresh

def basin_snapshot():
    from app.services.live_ingestion import live_ingestion_service as ingestion
    try:
        systems = [s for s in ingestion.live_systems if not s.get('is_simulation')]
        current = [s for s in systems if fresh(s.get('observation_time_utc')) and not s.get('is_stale')
                   and s.get('reconciliation_status') == 'ACTIVE_VERIFIED']
        status = 'ACTIVE_VERIFIED' if current else 'FEED_STALE' if systems else 'STATUS_UNCERTAIN'
        if not systems and getattr(ingestion, 'basin_status', '') == 'NO_ACTIVE_STORMS_VERIFIED' and fresh(ingestion.last_sync):
            status = 'NO_ACTIVE_STORMS_VERIFIED'
        fields = ('id', 'name', 'lat', 'lon', 'intensity_knots', 'source', 'source_url', 'observation_time_utc')
        return {'status':status, 'systems':[{k:s.get(k) for k in fields} for s in current[:20]]}
    except Exception:
        return {'status':'FEED_UNAVAILABLE', 'systems':[]}

def source_status_text(snapshot):
    import json
    if snapshot['status'] == 'ACTIVE_VERIFIED':
        return 'Backend source observations (missing values remain unavailable): ' + json.dumps(snapshot['systems'])
    if snapshot['status'] == 'NO_ACTIVE_STORMS_VERIFIED':
        return 'Backend ingestion records a dated no-active-storm report. This is not an all-clear for other hazards.'
    return 'Current basin conditions are uncertain: ' + snapshot['status'] + '. No verified current observation is available. Consult current official agency advisories.'
