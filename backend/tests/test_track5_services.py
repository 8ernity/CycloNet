import pytest
import io
from PIL import Image
import httpx
from app.main import app
from app.services.gee_service import gee_service
from app.services.surge_service import surge_service
from app.services.chat_service import chat_service

def test_gee_service_layers():
    layers = gee_service.get_available_layers()
    assert len(layers) >= 4
    layer_ids = [layer["id"] for layer in layers]
    assert "sentinel1_sar_flood" in layer_ids
    assert "srtm_dem_elevation" in layer_ids

def test_gee_flood_inundation_geojson():
    geojson = gee_service.get_flood_inundation_zones(18.2, 84.8, 90)
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) >= 2
    assert geojson["intensity_knots"] == 90
    assert geojson["features"][0]["properties"]["water_depth_m"] > 0

def test_gee_rainfall_pathways():
    pathways = gee_service.get_catchment_rainfall_pathways(18.2, 84.8, 300.0)
    assert len(pathways) >= 2
    assert "substations_at_risk" in pathways[0]
    assert len(pathways[0]["coordinates"]) >= 3

def test_hydrodynamic_surge_calculation():
    # Severe Cyclone (Amphan-like 130kt in BoB)
    res = surge_service.calculate_surge(
        intensity_knots=130.0,
        central_pressure_hpa=925.0,
        forward_speed_kmh=22.0,
        approach_angle_deg=80.0,
        astronomical_tide_m=1.5,
        basin="Bay of Bengal"
    )
    assert res["peak_surge_height_m"] >= 4.0
    assert res["severity_level"] in ["SEVERE_SURGE", "CATASTROPHIC_INUNDATION"]
    assert res["inland_penetration_km"] > 2.0
    assert res["inverted_barometer_m"] > 0.5

def test_coastal_surge_profile():
    sectors = surge_service.generate_coastal_surge_profile("Cyclone Mocha", 19.5, 92.5, 120)
    assert len(sectors) == 3
    assert sectors[0]["risk_rating"] == "EXTREME"
    assert "400kV" in " ".join(sectors[0]["critical_assets"])

def test_gemini_37_pre_landfall_briefing():
    storm_data = {
        "name": "Cyclone Biparjoy",
        "category": "Extremely Severe Cyclonic Storm",
        "intensity_knots": 90,
        "wind_kmh": 165,
        "surge_m": 3.2,
        "basin": "Arabian Sea"
    }
    briefing = chat_service.generate_pre_landfall_briefing(storm_data, {})
    assert "executive_summary" in briefing
    assert "action_checklist" in briefing
    assert len(briefing["action_checklist"]) >= 3

@pytest.mark.anyio
async def test_api_gee_endpoints():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        r1 = await client.get("/api/gee/layers")
        assert r1.status_code == 200
        assert r1.json()["status"] == "success"

        r2 = await client.get("/api/gee/flood-inundation?lat=19.2&lon=85.1&knots=100")
        assert r2.status_code == 200
        assert r2.json()["type"] == "FeatureCollection"

        r3 = await client.get("/api/gee/rainfall-pathways?lat=19.2&lon=85.1&rain_mm=250")
        assert r3.status_code == 200
        assert len(r3.json()["pathways"]) >= 2

@pytest.mark.anyio
async def test_api_surge_endpoints():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        r1 = await client.get("/api/surge/calculate?knots=100&pressure_hpa=950&basin=Bay%20of%20Bengal")
        assert r1.status_code == 200
        assert r1.json()["peak_surge_height_m"] > 2.5

        r2 = await client.get("/api/surge/profile?name=Cyclone%20Fani&lat=19.8&lon=85.8&knots=115")
        assert r2.status_code == 200
        assert len(r2.json()["sectors"]) == 3

@pytest.mark.anyio
async def test_api_ai_multimodal_endpoint():
    # Synthetic small JPEG buffer created properly with PIL (SEC-08)
    img = Image.new("RGB", (64, 64), color=(30, 60, 90))
    fake_img = io.BytesIO()
    img.save(fake_img, format="JPEG")
    files = {"file": ("cyclone_satellite.jpg", fake_img.getvalue(), "image/jpeg")}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/ai/analyze-multimodal", files=files)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "success"
        assert "analysis" in data
        assert "dvorak_t_number" in data["analysis"]

@pytest.mark.anyio
async def test_api_alert_dispatch_endpoint():
    payload = {
        "region": "Sundarbans Coastal Belt",
        "risk_level": "CRITICAL",
        "surge": 3.4,
        "wind": 125.0,
        "channels": ["CAP", "SMS", "SACHET", "SIREN", "VHF"],
        "cyclone_name": "Cyclone Amphan"
    }
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Unauthenticated request MUST fail with 401 (SEC-04, AI-04)
        r_unauth = await client.post("/api/alerts/dispatch", json=payload)
        assert r_unauth.status_code == 401

        # Authenticated request with admin key succeeds (SEC-04, AI-04)
        from app.core.auth import ADMIN_API_KEY
        r = await client.post(
            "/api/alerts/dispatch",
            json=payload,
            headers={"X-Admin-Key": ADMIN_API_KEY}
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "SIMULATED_DISPATCH_COMPLETE"
        assert "cap_xml" in data
        assert "sms_payload" in data
        assert "sachet_payload" in data
        assert "siren_payload" in data
        assert "vhf_payload" in data
        assert "municipal_briefing" in data
        assert len(data["municipal_briefing"]) >= 3
        assert "CAP" in data["channels_delivered"]
        assert "SMS" in data["channels_delivered"]

