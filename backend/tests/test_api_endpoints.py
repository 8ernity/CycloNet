import pytest
import httpx
from app.main import app

@pytest.mark.anyio
async def test_root_and_health():
    """Verify root and health endpoints return 200 OK."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        r_root = await client.get("/")
        assert r_root.status_code == 200
        assert r_root.json()["status"] == "ok"
        
        r_health = await client.get("/health")
        assert r_health.status_code == 200
        # Legacy health must reflect the full readiness contract, not DB-only health.
        assert r_health.json()["status"] == "ready"
        assert r_health.json()["authentication_configured"] is True

@pytest.mark.anyio
async def test_ingest_status():
    """Verify live ingestion status endpoint returns operational metadata."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/ingest/status")
        assert res.status_code == 200
        data = res.json()
        assert "status" in data
        assert "sources_status" in data
        assert "IMD_RSMC" in data["sources_status"]

@pytest.mark.anyio
async def test_active_systems_simulation():
    """Verify active systems endpoint returns valid track forecast when simulated."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/active-systems?simulate=true&cyclone_id=BOB03-2020")
        assert res.status_code == 200
        data = res.json()
        assert len(data) > 0
        sys = data[0]
        assert "Amphan" in sys["name"]
        assert "track_forecast" in sys
        assert len(sys["track_forecast"]) > 0

@pytest.mark.anyio
async def test_history_search():
    """Verify search endpoint retrieves historical storms."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/history/search?query=Fani")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "Fani" in data[0]["name"]

@pytest.mark.anyio
async def test_reports_bulletins():
    """Verify RSMC bulletins endpoint."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/reports/bulletins?simulate=true&cyclone_id=BOB03-2020")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert "bulletins" in data
        assert "port_signals" in data
        assert "cap_xml" in data
