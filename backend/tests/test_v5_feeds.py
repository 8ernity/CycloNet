from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
import pytest
from pathlib import Path
from app.models.feed_result import FeedResult, FeedStatus
from app.services.live_ingestion import LiveIngestionService

@pytest.mark.asyncio
async def test_partial_empty_does_not_erase_unrelated_storm():
    s = LiveIngestionService()
    s.live_systems = [dict(id='LIVE-JTWC-01B', source_id='JTWC_NOAA', lat=15, lon=85,
                           name='01B', basin='Bay of Bengal', category='CS', intensity_knots=None,
                           observation_time_utc='2026-11-06T00:00:00Z')]
    with patch.object(s, '_fetch_gdacs_active_systems', AsyncMock(return_value=FeedResult(source='GDACS_UN', status=FeedStatus.NO_ACTIVE_STORMS))), \
         patch.object(s, '_fetch_imd_bulletins', AsyncMock(return_value=FeedResult(source='IMD_RSMC', status=FeedStatus.FAILED))), \
         patch.object(s, '_fetch_jtwc_active_systems', AsyncMock(return_value=FeedResult(source='JTWC_NOAA', status=FeedStatus.FAILED))):
        result = await s.sync_all_sources()
    assert len(s.live_systems) == 1
    assert s.live_systems[0]['reconciliation_status'] == 'ACTIVE_STALE'
    assert s.live_systems[0]['observation_time_utc'] == '2026-11-06T00:00:00Z'
    assert result['basin_status'] == 'STATUS_UNCERTAIN'

@pytest.mark.asyncio
@pytest.mark.parametrize('method,body', [('_fetch_imd_bulletins','<html>Welcome</html>'),
                                       ('_fetch_jtwc_active_systems','<rss><channel/></rss>'),
                                       ('_fetch_gdacs_active_systems','<rss><channel/></rss>')])
async def test_generic_documents_are_not_calm(method, body):
    import httpx
    with patch('app.services.feed_http.FeedClient.get', AsyncMock(return_value=httpx.Response(200, text=body))):
        result = await getattr(LiveIngestionService(), method)()
    assert result.status not in (FeedStatus.HEALTHY, FeedStatus.NO_ACTIVE_STORMS)

def test_track_does_not_invent_observation_time_or_wind():
    s = dict(id='real', name='test', category='Unknown', lat=15, lon=85, intensity_knots=None)
    LiveIngestionService()._calibrate_system_telemetry(s)
    assert all(p['intensity_knots'] is None for p in s['track_forecast'])
    assert s['track_forecast'][0]['issue_time_utc'] is None
    assert '0KT' not in s['track_forecast'][0]['label']

@pytest.mark.asyncio
async def test_authentic_jtwc_other_hemisphere_calm_is_not_indian_ocean_calm():
    import httpx
    body=(Path(__file__).parent/'fixtures/jtwc-rss-20261107.xml').read_bytes()
    with patch('app.services.feed_http.FeedClient.get', AsyncMock(return_value=httpx.Response(200, content=body))):
        result=await LiveIngestionService()._fetch_jtwc_active_systems()
    assert result.status not in (FeedStatus.HEALTHY,FeedStatus.NO_ACTIVE_STORMS)
    assert not result.calm_evidence
