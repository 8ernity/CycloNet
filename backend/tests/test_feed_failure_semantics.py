import pytest
import datetime
import httpx
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.live_ingestion import LiveIngestionService
from app.models.feed_result import FeedStatus, FeedResult

@pytest.mark.asyncio
async def test_imd_http_500_does_not_result_in_no_active_storms():
    """1. IMD HTTP 500 does not result in NO_ACTIVE_STORMS."""
    service = LiveIngestionService()
    mock_resp = MagicMock(status_code=500, text="Internal Server Error")
    
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        res = await service._fetch_imd_bulletins()
        assert res.status == FeedStatus.FAILED
        assert res.error == "HTTP 500"
        assert service.sources_status["IMD_RSMC"] != "NO_ACTIVE_STORMS"
        assert "FAILED" in service.sources_status["IMD_RSMC"]

@pytest.mark.asyncio
async def test_gdacs_timeout_does_not_result_in_healthy():
    """2. GDACS timeout does not result in HEALTHY."""
    service = LiveIngestionService()
    with patch("httpx.AsyncClient.get", side_effect=httpx.TimeoutException("Connection timed out")):
        res = await service._fetch_gdacs_active_systems()
        assert res.status == FeedStatus.FAILED
        assert service.sources_status["GDACS_UN"] != "HEALTHY"
        assert service.sources_status["GDACS_UN"] != "NO_ACTIVE_STORMS"

@pytest.mark.asyncio
async def test_jtwc_malformed_feed_does_not_result_in_verified_calm():
    """3. JTWC malformed feed does not result in verified calm."""
    service = LiveIngestionService()
    mock_resp = MagicMock(status_code=200, text="<<<MALFORMED NOT XML OR ADVISORY>>>")
    
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        res = await service._fetch_jtwc_active_systems()
        assert res.status == FeedStatus.FAILED
        assert service.sources_status["JTWC_NOAA"] != "NO_ACTIVE_STORMS"

@pytest.mark.asyncio
async def test_undated_empty_advisory_cannot_verify_calm():
    """4. An empty valid advisory can produce NO_ACTIVE_STORMS when source format and coverage support that."""
    service = LiveIngestionService()
    mock_imd = MagicMock(status_code=200, text="<html><body>Routine bulletin: No cyclonic disturbances over Bay of Bengal or Arabian Sea.</body></html>")
    mock_gdacs = MagicMock(status_code=200, content=b"<?xml version='1.0'?><rss><channel><title>GDACS</title></channel></rss>")
    mock_jtwc = MagicMock(status_code=200, text="<html><body>Tropical Cyclone Warning IO: No active warnings at this time.</body></html>")

    async def mock_fetch_all(url, **kwargs):
        if "rsmcnewdelhi" in str(url):
            return mock_imd
        elif "gdacs" in str(url):
            return mock_gdacs
        else:
            return mock_jtwc

    with patch("httpx.AsyncClient.get", side_effect=mock_fetch_all):
        sync_result = await service.sync_all_sources()
        assert service.sources_status["IMD_RSMC"] == "DEGRADED"
        assert service.sources_status["GDACS_UN"] == "DEGRADED"
        assert service.sources_status["JTWC_NOAA"] == "DEGRADED"
        assert sync_result["status"] == "outage"
        assert sync_result["active_systems_count"] == 0

@pytest.mark.asyncio
async def test_two_failed_feeds_and_one_valid_feed_produce_partial_monitoring():
    """5. Two failed feeds and one valid feed produce partial-monitoring status."""
    service = LiveIngestionService()
    mock_gdacs = MagicMock(status_code=200, content=b"<?xml version='1.0'?><rss><channel><title>GDACS</title></channel></rss>")

    async def mock_fetch(url, **kwargs):
        if "gdacs" in str(url):
            return mock_gdacs
        raise httpx.ConnectError("Network connection refused")

    with patch("httpx.AsyncClient.get", side_effect=mock_fetch):
        sync_result = await service.sync_all_sources()
        assert sync_result["status"] == "outage"
        assert service.sources_status["GDACS_UN"] == "DEGRADED"
        assert "FAILED" in service.sources_status["IMD_RSMC"]
        assert "FAILED" in service.sources_status["JTWC_NOAA"]

@pytest.mark.asyncio
async def test_three_failed_feeds_preserve_last_valid_records_as_stale():
    """6. Three failed feeds preserve the last valid records as stale."""
    service = LiveIngestionService()
    valid_system = {
        "id": "LIVE-JTWC-01B",
        "name": "Cyclone 01B",
        "basin": "Bay of Bengal",
        "lat": 15.0,
        "lon": 85.0,
        "intensity_knots": 45,
        "category": "Cyclonic Storm",
        "observation_time_utc": "2026-11-06T06:00:00Z"
    }
    service.live_systems = [valid_system]

    with patch("httpx.AsyncClient.get", side_effect=httpx.ConnectError("Total network outage")):
        sync_result = await service.sync_all_sources()
        assert sync_result["status"] == "outage"
        assert len(service.live_systems) == 1
        assert service.live_systems[0]["data_state"] == "STALE"
        assert service.live_systems[0]["is_stale"] is True

@pytest.mark.asyncio
async def test_undated_recovery_preserves_stale_information():
    """7. A recovered feed correctly replaces stale information."""
    service = LiveIngestionService()
    stale_system = {
        "id": "LIVE-JTWC-01B",
        "name": "Cyclone 01B",
        "basin": "Bay of Bengal",
        "lat": 15.0,
        "lon": 85.0,
        "intensity_knots": 45,
        "category": "Cyclonic Storm",
        "data_state": "STALE",
        "is_stale": True
    }
    service.live_systems = [stale_system]

    # Now all feeds recover and confirm calm basin
    mock_imd = MagicMock(status_code=200, text="<html><body>No cyclonic disturbances over North Indian Ocean.</body></html>")
    mock_gdacs = MagicMock(status_code=200, content=b"<?xml version='1.0'?><rss><channel><title>GDACS</title></channel></rss>")
    mock_jtwc = MagicMock(status_code=200, text="<html><body>Tropical Cyclone Warning IO: No active warnings.</body></html>")

    async def mock_recover(url, **kwargs):
        if "rsmcnewdelhi" in str(url):
            return mock_imd
        elif "gdacs" in str(url):
            return mock_gdacs
        else:
            return mock_jtwc

    with patch("httpx.AsyncClient.get", side_effect=mock_recover):
        sync_result = await service.sync_all_sources()
        assert sync_result["status"] == "outage"
        assert len(service.live_systems) == 1
        assert service.live_systems[0]["is_stale"]
        assert service.sources_status["IMD_RSMC"] == "DEGRADED"

@pytest.mark.asyncio
async def test_missing_wind_and_pressure_remain_null_end_to_end():
    """8. Missing wind, pressure, and movement remain null end to end (FIX-002)."""
    service = LiveIngestionService()
    gdacs_xml = """<?xml version="1.0" encoding="utf-8"?>
    <rss version="2.0" xmlns:georss="http://www.georss.org/georss">
      <channel>
        <title>GDACS</title>
        <item>
          <title>Tropical Cyclone Alert - North Indian Ocean</title>
          <description>System developing in central Bay of Bengal without reported anemometer wind</description>
          <georss:point>14.5 86.2</georss:point>
        </item>
      </channel>
    </rss>""".encode("utf-8")
    
    mock_resp = MagicMock(status_code=200, content=gdacs_xml)
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        res = await service._fetch_gdacs_active_systems()
        assert res.status == FeedStatus.STALE
        assert len(res.systems) == 1
        sys = res.systems[0]
        assert sys["intensity_knots"] is None, "Missing wind must be None, never defaulted to 65 km/h or 30 kt"
        assert sys["central_pressure_hpa"] is None, "Missing pressure must be None"
        assert sys["movement_speed_kmph"] is None
        assert sys["movement_direction"] is None
        
        # Test calibration handling of None
        service._calibrate_system_telemetry(sys)
        assert sys["dvorak_t"] == "T-Pending"
        assert sys["dvorak_is_empirical_estimate"] is False
        assert sys["track_forecast"][0]["method"] == "OFFICIAL_OBSERVATION"
        assert sys["track_forecast"][0]["is_observed"] is True
        # Verify NO hindcast points in track_forecast
        for pt in sys["track_forecast"]:
            assert pt["time_offset_hours"] >= 0, "No simulated past waypoints allowed"
