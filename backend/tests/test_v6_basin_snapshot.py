from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
import pytest
from app.services.observation_context import basin_snapshot


@pytest.mark.parametrize('systems,sources,expected', [
    ([{'observation_time_utc':datetime.now(timezone.utc).isoformat(), 'reconciliation_status':'STATUS_UNCERTAIN'}], {}, 'STATUS_UNCERTAIN'),
    ([], {'IMD_RSMC':'FAILED', 'JTWC_NOAA':'UNAVAILABLE'}, 'FEED_UNAVAILABLE'),
    ([{'observation_time_utc':(datetime.now(timezone.utc)-timedelta(days=2)).isoformat(), 'reconciliation_status':'ACTIVE_VERIFIED'}], {}, 'FEED_STALE'),
])
def test_basin_snapshot_distinguishes_failed_stale_and_unreconciled(monkeypatch, systems, sources, expected):
    monkeypatch.setattr('app.services.live_ingestion.live_ingestion_service', SimpleNamespace(
        live_systems=systems, sources_status=sources, basin_status='STATUS_UNCERTAIN', last_sync=None))
    result = basin_snapshot()
    assert result['status'] == expected
    assert result['systems'] == []
