import io
import time
import pytest
import datetime
import jwt
from PIL import Image
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core import auth
from app.core.auth import decode_token_payload, verify_admin_key, require_authenticated_user, make_test_token
from app.services.report_service import report_service
from app.services.gee_service import gee_service
from app.services.surge_service import surge_service
from app.services.best_tracks import get_cyclone_trajectory, REAL_CYCLONE_TRACKS
from app.services.live_ingestion import live_ingestion_service

# ── 1. Security Regressions (SEC-01, SEC-02, SEC-03, SEC-04, SEC-08, SEC-11, SEC-12, SEC-13) ──

@pytest.mark.asyncio
async def test_sec01_forged_admin_token_rejected():
    """SEC-01: Reject forged, unsigned or unverified tokens attempting to escalate privileges."""
    forged_token = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlzX2FkbWluIjp0cnVlfQ."
    claims = decode_token_payload(forged_token)
    assert claims is None, "Forged algorithm=none token must be rejected"

    tampered_token = make_test_token(sub="normal_user", role="member")
    # Mutate signature
    tampered = tampered_token[:-4] + "XXXX"
    assert decode_token_payload(tampered) is None, "Tampered token signature must fail verification"

@pytest.mark.asyncio
async def test_sec01_expired_token_rejected():
    """SEC-01: Expired tokens must be strictly rejected."""
    expired_payload = {
        "sub": "user_expired",
        "exp": datetime.datetime.utcnow() - datetime.timedelta(seconds=10),
        "iat": datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    }
    expired_token = jwt.encode(expired_payload, auth.JWT_SECRET_KEY, algorithm="HS256")
    assert decode_token_payload(expired_token) is None, "Expired token must be rejected"

def test_sec02_missing_admin_secret_fails_closed():
    """SEC-02: If ADMIN_API_KEY is not configured or None, admin auth must fail closed."""
    orig_key = auth.ADMIN_API_KEY
    try:
        auth.ADMIN_API_KEY = None
        assert auth.is_valid_admin_key(None) is False
        assert auth.is_valid_admin_key("random_guess") is False
        assert auth.is_valid_admin_key("") is False
    finally:
        auth.ADMIN_API_KEY = orig_key

@pytest.mark.asyncio
async def test_sec03_spoofed_x_user_id_header_ignored():
    """SEC-03: Arbitrary X-User-Id header must not grant identity or bypass quotas."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/history/classifications",
            headers={"X-User-Id": "victim_officer_id"}
        )
        # Without verified Bearer token, it must return 401 Unauthorized
        assert res.status_code == 401

@pytest.mark.asyncio
async def test_sec04_sensitive_routes_require_authentication():
    """SEC-04: Ingestion sync and sensitive routes return 401 for anonymous clients."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r1 = await ac.post("/api/ingest/sync")
        assert r1.status_code == 401

        r2 = await ac.post("/api/ingest/test-inject")
        assert r2.status_code == 401

        r3 = await ac.post("/api/alerts/dispatch", json={"region": "Test"})
        assert r3.status_code == 401

@pytest.mark.asyncio
async def test_sec08_malformed_upload_rejected():
    """SEC-08: Corrupt, non-image or oversized uploads return 400 or 413, not 500."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Non-image MIME type
        res_text = await ac.post(
            "/api/ai/analyze-multimodal",
            files={"file": ("exploit.sh", b"#!/bin/bash\necho hi", "text/plain")}
        )
        assert res_text.status_code == 400

        # 2. Corrupted bytes disguised as image/jpeg
        res_corrupt = await ac.post(
            "/api/ai/analyze-multimodal",
            files={"file": ("corrupt.jpg", b"NOT_A_REAL_JPEG_DATA_HERE", "image/jpeg")}
        )
        assert res_corrupt.status_code == 400

@pytest.mark.asyncio
async def test_sec11_input_validation_bounds():
    """SEC-11: Strict validation on coordinates, wind speeds and numerical ranges."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Impossible latitude (> 90)
        res_bad_lat = await ac.get("/api/surge/profile?lat=999.0&lon=85.0&knots=80")
        assert res_bad_lat.status_code == 422

        # Negative wind speed
        res_neg_wind = await ac.get("/api/surge/calculate?knots=-50")
        assert res_neg_wind.status_code == 422

def test_sec12_cap_xml_proper_escaping():
    """SEC-12: CAP XML generation uses proper ElementTree serialization and escapes markup."""
    malicious_input = "<script>alert('xss')</script> & 'quoted' \"test\""
    advisory = report_service.dispatch_multi_channel_advisory(
        region=malicious_input,
        risk_level="HIGH",
        surge=2.0,
        wind=90.0,
        channels=["CAP"],
        cyclone_name="Test <Cyclone>"
    )
    cap_xml = advisory.get("cap_xml", "")
    assert cap_xml.startswith("<?xml")
    assert "<script>" not in cap_xml
    assert "&lt;script&gt;" in cap_xml
    assert "&lt;Cyclone&gt;" in cap_xml
    # Explicit exercise status preserved
    assert "<status>Exercise</status>" in cap_xml

# ── 2. Meteorological and Data Regressions (DATA-02, DATA-03, DATA-04, LIVE-07, LIVE-09, GEO-02, GEO-04) ──

@pytest.mark.asyncio
async def test_data03_unknown_cyclone_returns_404():
    """DATA-03: Unknown cyclone ID returns 404 instead of silently falling back to Biparjoy."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/active-systems?simulate=true&cyclone_id=NONEXISTENT_STORM_9999")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

def test_data04_historical_points_not_labelled_as_forecasts():
    """DATA-04: Historical observations occurring after peak intensity must not be marked as forecasts."""
    track_data = get_cyclone_trajectory("BOB03-2020", "Amphan", "Bay of Bengal", "Super Cyclonic Storm")
    track = track_data["track_forecast"]
    assert len(track) > 0
    # All verified historical best track points must have is_forecast=False
    for pt in track:
        assert pt.get("is_forecast") is False, f"Historical point {pt} incorrectly marked as forecast"
        assert pt.get("is_observed") is True

def test_data02_uncatalogued_track_labelled_as_simulation():
    """DATA-02: Dynamically generated tracks for uncatalogued IDs must carry simulation markers."""
    track_data = get_cyclone_trajectory("UNKNOWN-VORTEX-XYZ", "Illustrative Storm", "Bay of Bengal", "Severe Cyclonic Storm")
    track = track_data["track_forecast"]
    assert len(track) > 0
    assert track_data.get("is_simulation") is True
    for pt in track:
        assert pt.get("origin_type") == "ILLUSTRATIVE_SIMULATION"

def test_live09_synthetic_injection_isolation():
    """LIVE-09: Demo test injections carry is_simulation=True and do not pollute permanent history."""
    injected = live_ingestion_service.inject_test_system()
    assert injected.get("is_simulation") is True
    assert injected.get("source_type") == "DEMO"
    assert injected.get("origin_type") == "OPERATIONAL_DRILL"

def test_geo02_gee_simulated_mode_honesty():
    """GEO-02: SAR inundation without active GEE credentials must return SIMULATED_EXTENT, not LIVE_GEE."""
    result = gee_service.get_flood_inundation_zones(19.5, 85.0, 85)
    assert result["mode"] == "SIMULATED_EXTENT"
    assert result.get("sar_backscatter_db") is None

def test_geo04_surge_no_negative_penetration():
    """GEO-04: Inland penetration must never be artificially negative or arbitrary."""
    surge_res = surge_service.calculate_surge(
        intensity_knots=40,
        central_pressure_hpa=1005,
        forward_speed_kmh=10,
        approach_angle_deg=45,
        astronomical_tide_m=0.5,
        basin="Arabian Sea"
    )
    assert surge_res["inland_penetration_km"] >= 0.0
    assert "total_storm_tide_m" in surge_res
    assert "meteorological_surge_m" in surge_res
